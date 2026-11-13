import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename,join} from 'node:path';
import {Readable} from 'node:stream';
import {cloudStore,type CloudStore} from './cloud-store.ts';
import {processModel} from './process.mjs';
import {assetKeys,RequestError,selectTemplate,stockSources,uuid,validateTemplateInput} from './templates.ts';
import {RING_CATALOG} from '../../src/stone-first/catalog.ts';
import {SEAT_Y,referencePartRole} from '../../src/stone-first/reference/parts.ts';
import type {ReferenceAssets} from '../../src/stone-first/reference/part-library.ts';
import type {LibrarySource,ManagedTemplate,PublishedTemplate,TemplateDraft} from '../../src/stone-first/reference/managed-types.ts';

const prefix='/api/model-admin';
const root='studio/v1/';
const maxUpload=25*1024*1024;
const cookieName='__Host-xiangyan-admin';
const sessionSeconds=8*60*60;
const partFile=/^parts\/(heads|bands|stones)\/ring(?:-(?:head|pave|adapter))?-[a-f0-9]{12}\.glb$/;
type Job={id:string;filename:string;createdAt:string;size:number};
type Version={id:string;createdAt:string;parts:ReferenceAssets;profileId?:string};
type Intent={filename:string;size:number;hash:string;expires:number};
type Release=ManagedTemplate&{publishedAt:string;files:string[]};
type Publication={current:PublishedTemplate;revisions:string[]};

const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(status:number,message:string):never=>{throw new RequestError(status,message);};
const modelKey=(id:string)=>root+'models/'+id+'/';
const releaseKey=(id:string,revision:string)=>root+'releases/'+id+'/'+revision+'/';
const publicPath=(id:string,revision:string)=>prefix+'/public/'+id+'/'+revision+'/';
const same=(a:string,b:string)=>timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
const signature=(password:string,claims:string)=>createHmac('sha256',password).update(claims).digest('base64url');

function sessionIsValid(request:Request,password:string){
  const session=request.headers.get('cookie')?.split(';').map(value=>value.trim()).find(value=>value.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  const match=/^(\d{10,13}\.[0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/.exec(session??'');
  return !!match&&Number(match[1].split('.')[0])>Date.now()&&same(signature(password,match[1]),match[2]);
}
async function body(request:Request,limit=16*1024){
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json')fail(400,'请提交 JSON。');
  if(Number(request.headers.get('content-length'))>limit)fail(413,'提交内容超过大小限制。');
  const bytes=await request.arrayBuffer();
  if(bytes.byteLength>limit)fail(413,'提交内容超过大小限制。');
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail(400,'提交内容无效。');}
}
function imageBytes(image:unknown){
  const encoded=typeof image==='string'&&/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(image)?.[1];
  const bytes=encoded?Buffer.from(encoded,'base64'):undefined;
  if(!bytes||bytes.length<4||bytes.readUInt16BE(0)!==0xffd8||bytes.readUInt16BE(bytes.length-2)!==0xffd9){
    return fail(422,'请从当前编辑器预览生成款式图。');
  }
  return new Uint8Array(bytes);
}
async function scratch<T>(work:(directory:string)=>Promise<T>){
  const directory=await mkdtemp(join(tmpdir(),'xiangyan-model-'));
  try{return await work(directory);}finally{await rm(directory,{recursive:true,force:true});}
}
async function processFile(action:'analyze'|'export',job:string,output?:string){
  try{await processModel(action,job,output,{catalog:RING_CATALOG,seatHeights:SEAT_Y,referencePartRole,root:process.cwd()});}
  catch(error){if(error instanceof Error&&(error as NodeJS.ErrnoException).code)throw error;
    fail(422,error instanceof Error?error.message:'模型无法处理。');}
}

function cloudLibrary(store:CloudStore){
  async function optional<T>(key:string){
    const response=await store.get(key);
    if(!response)return;
    return {value:await response.json() as T,etag:response.headers.get('etag')};
  }
  async function required<T>(key:string){
    const result=await optional<T>(key);
    return result??fail(404,'找不到该记录或版本。');
  }
  const putJson=(key:string,value:unknown,condition?:{etag:string|null})=>
    store.put(key,JSON.stringify(value),'application/json; charset=utf-8',condition);

  async function sources(){
    const all=await store.list(root+'models/');
    const jobs=await Promise.all(all.filter(key=>key.endsWith('/job.json')).map(async key=>(await required<Job>(key)).value));
    const uploads=await Promise.all(all.filter(key=>key.endsWith('/manifest.json')).map(async key=>{
      const job=jobs.find(item=>key.startsWith(modelKey(item.id)));
      if(!job)return;
      const {value:version}=await required<Version>(key);
      const base=prefix+'/'+job.id+'/export/'+version.id+'/';
      const assets={...version.parts,classified:true,profileId:version.profileId};
      for(const kind of assetKeys){
        if(assets[kind])assets[kind]=base+assets[kind].replace('/models/parts/','parts/');
      }
      return {id:version.id,name:job.filename,revision:version.id,stock:false,assets,source:prefix+'/'+job.id+'/source',model:base+'ring.glb'} satisfies LibrarySource;
    }));
    return [...stockSources,...uploads.filter((item):item is NonNullable<typeof item>=>!!item)];
  }
  async function records<T>(folder:string){
    const keys=await store.list(root+folder+'/');
    return Promise.all(keys.filter(key=>key.endsWith('.json')).map(async key=>(await required<T>(key)).value));
  }
  const published=async()=>(await records<Publication>('published')).map(item=>item.current);
  const publicationKey=(id:string)=>root+'published/'+id+'.json';
  const draftKey=(id:string)=>root+'drafts/'+id+'.json';

  async function save(input:unknown){
    const {id,expectedRevision,selection}=validateTemplateInput(input);
    const prior=id?await required<TemplateDraft>(draftKey(id)):undefined;
    if(prior&&prior.value.revision!==expectedRevision)fail(409,'草稿已更新，请重新打开后再编辑。');
    const draft:TemplateDraft={id:id??randomUUID(),revision:randomUUID(),updatedAt:new Date().toISOString(),...selection};
    selectTemplate(draft,await sources());
    if(!await putJson(draftKey(draft.id),draft,{etag:prior?.etag??null}))fail(409,'草稿已更新，请重新打开后再编辑。');
    return draft;
  }
  async function preview(id:string,revision:string){
    const {value:draft}=await required<TemplateDraft>(draftKey(id));
    if(draft.revision!==revision)fail(409,'草稿已更新，请打开最新版本预览。');
    return selectTemplate(draft,await sources());
  }
  async function publish(id:string,revision:string,image:Uint8Array<ArrayBuffer>){
    const template=await preview(id,revision);
    const release=releaseKey(id,revision);
    const base=publicPath(id,revision);
    const recordKey=publicationKey(id);
    const prior=await optional<Publication>(recordKey);
    if(prior?.value.current.revision===revision)return prior.value.current;
    const files=['cover.jpg'];
    const existing=await optional<Release>(release+'template.json');
    if(!existing){
      for(const assets of Object.values(template.library)){
        for(const kind of assetKeys){
          const url=assets[kind];
          if(!url||url.startsWith('/models/parts/'))continue;
          const match=/^\/api\/model-admin\/([a-f0-9-]+)\/export\/([a-f0-9-]+)\/(parts\/.+)$/.exec(url);
          if(!match||!uuid.test(match[1])||!uuid.test(match[2])||!partFile.test(match[3]))fail(422,'部件地址无效。');
          const [,job,version,part]=match!;
          const file=basename(part);
          const response=await store.get(modelKey(job)+'versions/'+version+'/'+part);
          if(!response)fail(422,'部件文件缺失，请重新入库。');
          await store.put(release+file,await response!.arrayBuffer(),'model/gltf-binary',{etag:null});
          assets[kind]=base+file;
          files.push(file);
        }
      }
      await store.put(release+'cover.jpg',image,'image/jpeg',{etag:null});
      await putJson(release+'template.json',{...template,publishedAt:new Date().toISOString(),files},{etag:null});
    }
    if((await required<TemplateDraft>(draftKey(id))).value.revision!==revision)fail(409,'草稿已更新，请打开最新版本预览。');
    const published={id,revision,name:template.name,headName:template.headName,bandName:template.bandName,
      url:base+'template.json',image:base+'cover.jpg'};
    const record={current:published,revisions:[...(prior?.value.revisions??[]),revision]};
    if(!await putJson(recordKey,record,{etag:prior?.etag??null})){
      if((await optional<Publication>(recordKey))?.value.current.revision!==revision)fail(409,'已有其他版本发布，请刷新后台。');
    }
    return published;
  }
  return {optional,required,putJson,sources,records,published,publicationKey,save,preview,publish};
}

function redirect(url:string){
  return new Response(null,{status:302,headers:{Location:url,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}

export async function cloudAdmin(request:Request,storeOverride?:CloudStore,passwordOverride?:string):Promise<Response>{
  try{
    const url=new URL(request.url);
    const route=(url.searchParams.get('path')??url.pathname.slice(prefix.length)).replace(/^\/|\/$/g,'');
    if(!/^(?:[a-zA-Z0-9.-]+\/)*[a-zA-Z0-9.-]*$/.test(route)||route.split('/').some(segment=>segment==='.'||segment==='..')){
      return json({error:'找不到该操作。'},404);
    }
    const [id,action,revision,...rest]=route.split('/');
    const method=request.method;
    const store=storeOverride??cloudStore();
    const password=passwordOverride??process.env.XIANGYAN_ADMIN_PASSWORD;
    if(id==='public'&&method==='GET'){
      if(!store)return json({error:'发布目录未配置。'},503);
      const library=cloudLibrary(store);
      if(action==='index.json'&&!revision)return json(await library.published());
      if(uuid.test(action??'')&&uuid.test(revision??'')&&rest.length===1){
        const {value:publication}=await library.required<Publication>(library.publicationKey(action));
        if(!publication.revisions.includes(revision))fail(404,'找不到已发布版本。');
        const key=releaseKey(action,revision);
        const {value:release}=await library.required<Release>(key+'template.json');
        if(rest[0]==='template.json'){
          const {files,...template}=release;
          return json(template);
        }
        if(release.files.includes(rest[0]))return redirect(await store.sign(key+rest[0],'GET'));
      }
      return json({error:'找不到已发布版本。'},404);
    }
    if(!store||!password||password.length<32)return json({error:'线上后台尚未配置 R2 或管理员密码。'},503);
    if(method==='POST'&&request.headers.get('origin')!==url.origin)fail(403,'请从本站后台操作。');
    if(id==='session'&&!action&&method==='POST'){
      const input=await body(request);
      if(typeof input?.password!=='string'||!same(input.password,password))fail(401,'管理员密码错误。');
      const claims=(Date.now()+sessionSeconds*1000)+'.'+randomUUID();
      return new Response(null,{status:204,headers:{'Cache-Control':'no-store',
        'Set-Cookie':cookieName+'='+claims+'.'+signature(password,claims)+'; Path=/; Max-Age='+sessionSeconds+'; HttpOnly; Secure; SameSite=Strict'}});
    }
    if(!sessionIsValid(request,password))return json({error:'请先登录后台。'},401);
    if(id==='session'&&!action&&method==='GET')return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
    const library=cloudLibrary(store);
    if(id==='library'&&!action&&method==='GET')return json({sources:await library.sources(),
      drafts:(await library.records<TemplateDraft>('drafts')).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),
      published:await library.published(),cloud:true});
    if(id==='stock'&&method==='GET'&&stockSources.some(item=>item.id===action)){
      const stream=Readable.toWeb(createReadStream(join(process.cwd(),'assets/source',action,'source.obj')));
      return new Response(stream as unknown as ReadableStream,{headers:{'Content-Type':'application/octet-stream',
        'Content-Disposition':'attachment; filename="'+action+'.obj"','Cache-Control':'no-store'}});
    }
    if(id==='templates'){
      if(!action&&method==='POST')return json(await library.save(await body(request)),201);
      if(uuid.test(action??'')&&uuid.test(revision??'')){
        if(!rest.length&&method==='GET')return json(await library.preview(action,revision));
        if(rest[0]==='publish'&&rest.length===1&&method==='POST'){
          const input=await body(request,384*1024);
          if(input?.confirmed!==true)fail(400,'请确认要发布的预览版本。');
          return json(await library.publish(action,revision,imageBytes(input.image)),201);
        }
      }
    }
    if((!id||id==='models')&&!action&&method==='GET'){
      const keys=await store.list(root+'models/');
      const jobs=await Promise.all(keys.filter(key=>key.endsWith('/job.json')).map(async key=>{
        const {value:job}=await library.required<Job>(key);
        return {...job,exported:keys.some(path=>path.startsWith(modelKey(job.id))&&path.endsWith('/manifest.json'))};
      }));
      return json(jobs.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
    }
    if(id==='uploads'&&method==='POST'){
      if(!action){
        const {filename,size,hash}=await body(request)??{};
        if(typeof filename!=='string'||!/^[^/\\\x00-\x1f]{1,180}\.obj$/i.test(filename)||
           !Number.isInteger(size)||size<=0||size>maxUpload||typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash)){
          fail(422,'请选择 25 MB 以内的 OBJ 文件。');
        }
        const job=randomUUID();
        await library.putJson(root+'incoming/'+job+'.json',{filename,size,hash,expires:Date.now()+10*60*1000});
        return json({id:job,url:await store.sign(root+'incoming/'+job+'.obj','PUT')},201);
      }
      if(!revision&&uuid.test(action)){
        const key=modelKey(action);
        const existing=await library.optional<Job>(key+'job.json');
        if(existing)return json(existing.value);
        const ticket=root+'incoming/'+action;
        const {value:intent}=await library.required<Intent>(ticket+'.json');
        if(intent.expires<Date.now())fail(410,'上传已过期，请重新选择文件。');
        const object=await store.get(ticket+'.obj');
        if(!object||Number(object.headers.get('content-length'))!==intent.size)fail(422,'上传文件大小与登记不符。');
        const bytes=new Uint8Array(await object!.arrayBuffer());
        if(bytes.byteLength!==intent.size||createHash('sha256').update(bytes).digest('hex')!==intent.hash){
          fail(422,'上传文件内容与登记不符，请重新选择。');
        }
        return await scratch(async directory=>{
          await writeFile(join(directory,'original.obj'),bytes);
          await processFile('analyze',directory);
          const job={id:action,filename:intent.filename,createdAt:new Date().toISOString(),size:intent.size};
          await store.put(key+'original.obj',bytes,'application/octet-stream');
          await store.put(key+'ring.glb',new Uint8Array(await readFile(join(directory,'ring.glb'))),'model/gltf-binary');
          await store.put(key+'analysis.json',await readFile(join(directory,'analysis.json'),'utf8'),'application/json');
          await library.putJson(key+'job.json',job,{etag:null});
          await store.remove(ticket+'.obj').catch(()=>{});
          await store.remove(ticket+'.json').catch(()=>{});
          return json(job,201);
        });
      }
    }
    if(!uuid.test(id))return json({error:'找不到该操作。'},404);
    const key=modelKey(id);
    const {value:job}=await library.required<Job>(key+'job.json');
    if(!action&&method==='GET'){
      const versions=await store.list(key+'versions/');
      const exports=await Promise.all(versions.filter(path=>path.endsWith('/manifest.json'))
        .map(async path=>(await library.required<Version>(path)).value));
      return json({...job,...(await library.required<object>(key+'analysis.json')).value,
        exports:exports.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
    }
    if(method==='GET'&&action==='source'&&!revision)return redirect(await store.sign(key+'original.obj','GET'));
    if(method==='GET'&&action==='preview'&&!revision)return redirect(await store.sign(key+'ring.glb','GET'));
    if(action==='export'){
      if(method==='POST'&&!revision){
        const input=await body(request,160*1024);
        const object=await store.get(key+'original.obj');
        if(!object)fail(422,'原始模型缺失。');
        const version=randomUUID();
        const destination=key+'versions/'+version+'/';
        return await scratch(async directory=>{
          await writeFile(join(directory,'original.obj'),new Uint8Array(await object!.arrayBuffer()));
          await writeFile(join(directory,'review.json'),JSON.stringify(input));
          await processFile('export',directory,directory);
          const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8')) as Version;
          const parts=assetKeys.flatMap(kind=>manifest.parts[kind]?.replace('/models/parts/','parts/')??[]);
          for(const file of ['ring.glb',...parts])await store.put(destination+file,new Uint8Array(await readFile(join(directory,file))),'model/gltf-binary');
          await library.putJson(destination+'manifest.json',{...manifest,id:version,createdAt:new Date().toISOString()});
          return json({id:version},201);
        });
      }
      if(method==='GET'&&uuid.test(revision??'')){
        const asset=rest.join('/');
        const destination=key+'versions/'+revision+'/';
        const {value:version}=await library.required<Version>(destination+'manifest.json');
        if(asset==='manifest.json')return json(version);
        if(asset==='ring.glb'||partFile.test(asset)&&assetKeys.some(kind=>version.parts[kind]?.replace('/models/parts/','parts/')===asset)){
          return redirect(await store.sign(destination+asset,'GET'));
        }
      }
    }
    return json({error:'找不到该操作。'},404);
  }catch(error){
    if(error instanceof RequestError)return json({error:error.message},error.status);
    return json({error:'模型后台暂不可用。请检查 R2 配置和连接。'},502);
  }
}
