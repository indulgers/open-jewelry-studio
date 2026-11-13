import {execFile} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,readdir,rename,rm,stat,writeFile} from 'node:fs/promises';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {homedir} from 'node:os';
import {basename,dirname,join,resolve,sep} from 'node:path';
import {promisify} from 'node:util';
import {loadEnv,normalizePath,type Plugin} from 'vite';

import {createR2} from './r2.ts';
import {createTemplateLibrary,RequestError,uuid} from './templates.ts';

const exec=promisify(execFile);
const maxUpload=25*1024*1024;
const partFile=/^parts\/(heads|bands|stones)\/ring(?:-(?:head|pave|adapter))?-[a-f0-9]{12}\.glb$/;

async function receive(req:IncomingMessage,limit:number){
  if(Number(req.headers['content-length'])>limit){
    req.resume();
    throw new RequestError(413,'上传内容超过大小限制。');
  }
  let size=0;
  const chunks:Buffer[]=[];
  for await(const chunk of req.iterator({destroyOnReturn:false})){
    size+=chunk.length;
    if(size>limit){
      req.resume();
      throw new RequestError(413,'上传内容超过大小限制。');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks,size);
}

const json=(res:ServerResponse,status:number,value:unknown)=>{
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify(value));
};
const readJson=async(file:string)=>JSON.parse(await readFile(file,'utf8'));

export function modelAdmin():Plugin{
  const storage=resolve(process.env.XIANGYAN_MODEL_DIR??join(homedir(),'.xiangyan-model-admin'));
  return {
    name:'xiangyan-local-model-admin',
    apply:'serve',
    config(config){
      const deny=config.server?.fs?.deny??['.env','.env.*','*.{crt,pem,key,p12,pfx,cer,der}',
        '.npmrc','.yarnrc.yml','**/.git/**'];
      return {server:{fs:{deny:[...deny,normalizePath(storage),normalizePath(storage)+'/**']}}};
    },
    configureServer(server){
      const {publicDir}=server.config;
      if(publicDir&&(storage===publicDir||storage.startsWith(publicDir+sep))){
        throw new Error('XIANGYAN_MODEL_DIR 必须在网站公共素材目录之外。');
      }
      const worker=join(server.config.root,'scripts/model-admin/run.mjs');
      const templates=createTemplateLibrary(storage,publicDir);
      const r2=createR2(loadEnv(server.config.mode,server.config.envDir,'XIANGYAN_R2_'));
      let busy=false;

      async function mirror(dir:string,object:string,files:string[]){
        if(!r2)return;
        try{
          for(const file of files)await r2.put(object+'/'+file,join(dir,file));
        }catch(error){
          throw new RequestError(502,error instanceof Error?error.message:'R2 暂不可用。');
        }
      }

      async function readLocal(file:string,object?:string){
        try{return await stat(file);}
        catch(error){
          if(!r2||!object||(error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
          const temp=file+'.'+randomUUID();
          try{
            await mkdir(dirname(file),{recursive:true});
            await r2.get(object,temp);
            await rename(temp,file);
            return await stat(file);
          }catch{
            throw new RequestError(502,'无法从 R2 恢复模型文件。请检查桶权限或稍后重试。');
          }finally{await rm(temp,{force:true});}
        }
      }

      async function body(req:IncomingMessage,limit=16*1024){
        if(req.headers['content-type']!=='application/json')throw new RequestError(400,'请提交 JSON。');
        try{return JSON.parse((await receive(req,limit)).toString());}
        catch(error){if(error instanceof RequestError)throw error;throw new RequestError(400,'模板数据无效。');}
      }

      async function processModel(action:string,job:string,output?:string){
        try{
          await exec(process.execPath,[worker,action,job,...(output?[output]:[])],{
            cwd:server.config.root,timeout:50_000,maxBuffer:128*1024,
          });
        }catch(error){
          const result=error as {killed?:boolean;stderr?:string};
          throw new RequestError(422,result.killed?'模型处理超时。请简化网格后重试。':
            result.stderr?.trim().split('\n')[0]?.slice(0,200)||'模型无法处理。请检查 OBJ 格式。');
        }
      }
      async function exclusively<T>(run:()=>Promise<T>){
        if(busy)throw new RequestError(409,'另一份模型正在处理，请稍后重试。');
        busy=true;
        try{return await run();}finally{busy=false;}
      }

      async function route(req:IncomingMessage,res:ServerResponse,path:string){
        const host=req.headers.host??'';
        const origin=req.headers.origin;
        if(!/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host)||
          !['127.0.0.1','::ffff:127.0.0.1','::1'].includes(req.socket.remoteAddress??'')||
          (origin&&origin!=='http://'+host)||(req.method==='POST'&&origin!=='http://'+host)){
          throw new RequestError(403,'模型后台仅允许从本机管理页访问。');
        }
        res.setHeader('Cache-Control','no-store');
        res.setHeader('X-Content-Type-Options','nosniff');
        await mkdir(storage,{recursive:true,mode:0o700});
        const [,id,action,...rest]=path.split('/').slice(2);
        if(id==='library'&&req.method==='GET'&&!action)return json(res,200,{...await templates.list(),cloud:!!r2});
        if(id==='templates'){
          if(req.method==='POST'&&!action)return exclusively(async()=>json(res,201,await templates.save(await body(req))));
          if(action&&uuid.test(action)&&uuid.test(rest[0]??'')){
            const [revision,operation]=rest;
            if(req.method==='GET'&&!operation)return json(res,200,await templates.preview(action,revision));
            if(req.method==='POST'&&operation==='publish')return exclusively(async()=>{
              const input=await body(req,384*1024);
              if(input?.confirmed!==true)throw new RequestError(400,'请确认要发布的预览版本。');
              const base64=typeof input.image==='string'&&/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(input.image)?.[1];
              const image=base64&&Buffer.from(base64,'base64');
              if(!image||image.length<4||image.readUInt16BE(0)!==0xffd8||image.readUInt16BE(image.length-2)!==0xffd9){
                throw new RequestError(422,'请从当前编辑器预览生成款式图。');
              }
              return json(res,201,await templates.publish(action,revision,image));
            });
          }
          throw new RequestError(404,'找不到该模板操作。');
        }
        if(id==='stock'&&req.method==='GET'&&templates.stock.some(ring=>ring.id===action)){
          const file=join(server.config.root,'assets/source',action,'source.obj');
          const {size}=await stat(file);
          res.setHeader('Content-Length',size);
          res.setHeader('Content-Type','application/octet-stream');
          res.setHeader('Content-Disposition','attachment; filename="'+action+'.obj"');
          createReadStream(file).on('error',()=>res.destroy()).pipe(res);
          return;
        }
        if(!id){
          if(req.method==='GET'){
            const entries=(await readdir(storage)).filter(name=>uuid.test(name));
            const jobs=await Promise.all(entries.map(async id=>({
              ...(await readJson(join(storage,id,'job.json'))),
              exported:(await readdir(join(storage,id))).some(name=>uuid.test(name)),
            })));
            return json(res,200,jobs.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
          }
          if(req.method==='POST'){
            let filename='';
            try{filename=decodeURIComponent(String(req.headers['x-model-filename']??''));}catch{}
            if(!/^[^/\\\x00-\x1f]{1,180}\.obj$/i.test(filename)||req.headers['content-type']!=='application/octet-stream'){
              throw new RequestError(400,'请选择一个 .obj 文件。');
            }
            return exclusively(async()=>{
              const bytes=await receive(req,maxUpload);
              if(!bytes.length)throw new RequestError(400,'OBJ 文件为空。');
              const id=randomUUID(),temp=join(storage,'.'+id);
              await mkdir(temp);
              try{
                await writeFile(join(temp,'original.obj'),bytes);
                await processModel('analyze',temp);
                const job={id,filename,createdAt:new Date().toISOString(),size:bytes.length};
                await writeFile(join(temp,'job.json'),JSON.stringify(job));
                await mirror(temp,'models/'+id,['original.obj','ring.glb','analysis.json','job.json']);
                await rename(temp,join(storage,id));
                return json(res,201,job);
              }finally{await rm(temp,{recursive:true,force:true});}
            });
          }
        }
        if(!id||!uuid.test(id))throw new RequestError(404,'找不到该模型。');
        const job=join(storage,id);
        const metadata=await readJson(join(job,'job.json'));
        if(!action&&req.method==='GET'){
          const exports=await Promise.all((await readdir(job)).filter(name=>uuid.test(name)).map(async version=>({
            id:version,createdAt:(await stat(join(job,version))).birthtime.toISOString(),
            ...(await readJson(join(job,version,'manifest.json'))),
          })));
          return json(res,200,{...metadata,...(await readJson(join(job,'analysis.json'))),
            exports:exports.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
        }
        if(action==='export'&&req.method==='POST'){
          if(req.headers['content-type']!=='application/json')throw new RequestError(400,'请提交部件分区和接合点。');
          return exclusively(async()=>{
            const data=await receive(req,160*1024);
            const version=randomUUID(),temp=join(job,'.'+version);
            await readLocal(join(job,'original.obj'),'models/'+id+'/original.obj');
            await mkdir(temp);
            try{
              await writeFile(join(temp,'review.json'),data);
              await processModel('export',job,temp);
              if(r2){
                const manifest=await readJson(join(temp,'manifest.json'));
                const parts=Object.values(manifest.parts).filter((path):path is string=>typeof path==='string')
                  .map(path=>path.replace('/models/parts/','parts/'));
                await mirror(temp,'models/'+id+'/versions/'+version,['ring.glb',...parts,'manifest.json']);
              }
              await rename(temp,join(job,version));
              return json(res,201,{id:version});
            }finally{await rm(temp,{recursive:true,force:true});}
          });
        }
        if(req.method==='GET'){
          let file:string|undefined,download:string|undefined,cloudObject:string|undefined;
          if(action==='preview'&&!rest.length){
            file=join(job,'ring.glb');
            cloudObject='models/'+id+'/ring.glb';
          }
          if(action==='source'&&!rest.length){
            file=join(job,'original.obj');
            download=metadata.filename;
            cloudObject='models/'+id+'/original.obj';
          }
          if(action==='export'&&uuid.test(rest[0]??'')){
            const [version,...segments]=rest;
            const asset=segments.join('/');
            if(['manifest.json','semantic.obj','ring.glb'].includes(asset)||partFile.test(asset)){
              await stat(join(job,version,'review.json'));
              file=join(job,version,asset);
              download=basename(asset);
              if(asset!=='semantic.obj')cloudObject='models/'+id+'/versions/'+version+'/'+asset;
            }
          }
          if(file){
            const {size}=await readLocal(file,cloudObject);
            res.setHeader('Content-Length',size);
            res.setHeader('Content-Type',file.endsWith('.glb')?'model/gltf-binary':'application/octet-stream');
            if(download)res.setHeader('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(download).replaceAll("'",'%27'));
            createReadStream(file).on('error',()=>res.destroy()).pipe(res);
            return;
          }
        }
        throw new RequestError(404,'找不到该操作。');
      }

      server.middlewares.use((req,res,next)=>{
        const path=req.url?.split('?',1)[0];
        if(!path||!/^\/api\/model-admin(?:\/|$)/.test(path))return next();
        // Do not let dot segments or encoded paths reach the local asset store.
        if(!/^\/api\/model-admin(?:\/[a-zA-Z0-9.-]+)*\/?$/.test(path)||path.split('/').some(segment=>segment==='.'||segment==='..')){
          return json(res,404,{error:'找不到该操作。'});
        }
        void route(req,res,path.replace(/\/$/,'')).catch((error:RequestError&{code?:string})=>{
          const status=error.status??(error.code==='ENOENT'?404:500);
          json(res,status,{error:status===500?'本地模型库暂不可用。':error.status?error.message:'找不到该模型或文件。'});
        });
      });
    },
  };
}
