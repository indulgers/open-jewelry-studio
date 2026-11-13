import {randomUUID} from 'node:crypto';
import {copyFile,mkdir,readFile,readdir,rename,rm,stat,writeFile} from 'node:fs/promises';
import {basename,join} from 'node:path';
import {RING_CATALOG} from '../../src/stone-first/catalog.ts';
import stockParts from '../../src/stone-first/reference/part-assets.json' with {type:'json'};
import type {ReferenceAssets} from '../../src/stone-first/reference/part-library.ts';
import type {LibrarySource,ManagedTemplate,PublishedTemplate,TemplateDraft,TemplateSelection} from '../../src/stone-first/reference/managed-types.ts';

export const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
export class RequestError extends Error{
  constructor(public status:number,message:string){super(message);}
}
const prefix='/api/model-admin';
export const assetKeys=['head','band','headStones','pave','adapter'] as const;
const readJson=async<T>(path:string)=>JSON.parse(await readFile(path,'utf8')) as T;

async function replaceJson(file:string,value:unknown){
  const temp=file+'.'+randomUUID();
  try{
    await writeFile(temp,JSON.stringify(value,null,2)+'\n');
    await rename(temp,file);
  }finally{await rm(temp,{force:true});}
}
function modelIds(names:string[]){return names.filter(name=>uuid.test(name));}

export const stockSources:LibrarySource[]=RING_CATALOG.map(ring=>({
    id:ring.id,name:ring.name,revision:ring.revision,stock:true,
    assets:stockParts[ring.id as keyof typeof stockParts],model:ring.model,
    source:prefix+'/stock/'+ring.id,editor:ring.editor,
  }));

export function selectTemplate(draft:TemplateDraft,options:LibrarySource[]):ManagedTemplate{
    const head=options.find(item=>item.id===draft.head);
    const band=options.find(item=>item.id===draft.band);
    if(!head||!band||!head.assets.headStones||!band.assets.band||!head.assets.head){
      throw new RequestError(422,'请选择可用的戒头、戒圈和戒头宝石。');
    }
    // The measured stone seats and beads belong to the same component revision as their mounting.
    if(draft.headStones!==head.id||draft.pave!==(band.assets.pave?band.id:'')){
      throw new RequestError(422,'配钻必须和镶座来自同一个部件版本。请重新选择配套宝石。');
    }
    const library:Record<string,ReferenceAssets>={
      [head.id]:{...head.assets,band:'',pave:undefined},
      [band.id]:{...band.assets,head:'',headStones:''},
    };
    if(head.id===band.id)library[head.id]=head.assets;
    return {id:draft.id,revision:draft.revision,name:draft.name,headName:head.name,bandName:band.name,
      headId:head.id,bandId:band.id,library,review:draft.review};
}

export function validateTemplateInput(input:unknown){
  if(!input||typeof input!=='object')throw new RequestError(400,'模板数据无效。');
  const {name:label,id,expectedRevision,head,headStones,band,pave,review}=input as Record<string,unknown>;
  const name=typeof label==='string'?label.trim():'';
  if(!name||name.length>60||typeof head!=='string'||typeof headStones!=='string'||typeof band!=='string'||typeof pave!=='string'){
    throw new RequestError(422,'请填写款式名并选好所需部件。');
  }
  if(id!==undefined&&(typeof id!=='string'||!uuid.test(id))){
    throw new RequestError(400,'模板编号无效。');
  }
  let checked:TemplateSelection['review'];
  if(review!==undefined){
    if(!review||typeof review!=='object')throw new RequestError(422,'工艺复核内容无效。');
    const {status,minDiameter,maxDiameter,step,note}=review as Record<string,unknown>;
    if((status!=='pending'&&status!=='approved'&&status!=='rejected')||typeof note!=='string'||note.length>2000){
      throw new RequestError(422,'请选择复核状态，备注最多 2000 字。');
    }
    const range=[minDiameter,maxDiameter,step];
    const empty=range.every(value=>value===null);
    if(!empty&&(!range.every(value=>typeof value==='number'&&Number.isFinite(value)&&value>0)||
      (minDiameter as number)>(maxDiameter as number))){
      throw new RequestError(422,'请完整填写有效的内径上下限和档位步长，或全部留空。');
    }
    if(status==='approved'&&(empty||!note.trim()))throw new RequestError(422,'通过复核前，请填写尺寸范围和工艺依据。');
    checked={status,minDiameter:minDiameter as number|null,maxDiameter:maxDiameter as number|null,step:step as number|null,note:note.trim()};
  }
  return {id,expectedRevision,selection:{name,head,headStones,band,pave,review:checked} satisfies TemplateSelection};
}

export function createTemplateLibrary(storage:string,publicDir:string){
  const draftsDir=join(storage,'templates');
  const publishedDir=join(publicDir,'models/managed');
  const indexFile=join(publishedDir,'index.json');
  const stock=stockSources;

  async function sources():Promise<LibrarySource[]>{
    const jobs=modelIds(await readdir(storage));
    const uploads=await Promise.all(jobs.map(async job=>{
      const dir=join(storage,job);
      const {filename}=await readJson<{filename:string}>(join(dir,'job.json'));
      return Promise.all(modelIds(await readdir(dir)).map(async revision=>{
        const manifest=await readJson<{parts:ReferenceAssets;profileId?:string}>(join(dir,revision,'manifest.json'));
        const route=prefix+'/'+job+'/export/'+revision+'/';
        const assets={...manifest.parts,classified:true,profileId:manifest.profileId};
        for(const key of assetKeys){
          if(assets[key])assets[key]=route+assets[key].replace('/models/parts/','parts/');
        }
        return {id:revision,name:filename,revision,stock:false,assets,source:prefix+'/'+job+'/source',model:route+'ring.glb'};
      }));
    }));
    return [...stock,...uploads.flat()];
  }
  async function index(){
    try{return await readJson<PublishedTemplate[]>(indexFile);}
    catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return [];throw error;}
  }
  async function list(){
    await mkdir(draftsDir,{recursive:true});
    const drafts=await Promise.all((await readdir(draftsDir)).filter(name=>uuid.test(name.slice(0,-5))&&name.endsWith('.json'))
      .map(name=>readJson<TemplateDraft>(join(draftsDir,name))));
    return {sources:await sources(),drafts:drafts.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),published:await index()};
  }
  async function resolveTemplate(draft:TemplateDraft):Promise<ManagedTemplate>{
    const options=await sources();
    return selectTemplate(draft,options);
  }
  const draftPath=(id:string)=>join(draftsDir,id+'.json');
  const draft=(id:string)=>readJson<TemplateDraft>(draftPath(id));
  async function save(input:unknown){
    const {id,expectedRevision,selection}=validateTemplateInput(input);
    if(id&&(await draft(id)).revision!==expectedRevision){
      throw new RequestError(409,'草稿已更新，请重新打开后再编辑。');
    }
    const next:TemplateDraft={id:id??randomUUID(),revision:randomUUID(),updatedAt:new Date().toISOString(),...selection};
    await resolveTemplate(next);
    await mkdir(draftsDir,{recursive:true});
    await replaceJson(draftPath(next.id),next);
    return next;
  }
  async function preview(id:string,revision:string){
    const saved=await draft(id);
    if(saved.revision!==revision)throw new RequestError(409,'草稿已更新，请打开最新版本预览。');
    return resolveTemplate(saved);
  }

  function assetFile(path:string){
    if(path.startsWith('/models/parts/'))return join(publicDir,path.slice(1));
    const match=/^\/api\/model-admin\/([a-f0-9-]+)\/export\/([a-f0-9-]+)\/(parts\/(?:heads|bands|stones)\/ring(?:-(?:head|pave|adapter))?-[a-f0-9]{12}\.glb)$/.exec(path);
    if(!match||!uuid.test(match[1])||!uuid.test(match[2]))throw new Error('Invalid part asset path');
    return join(storage,match[1],match[2],match[3]);
  }

  async function publish(id:string,revision:string,image:Buffer){
    const template=await preview(id,revision);
    if(template.review?.status==='rejected')throw new RequestError(422,'该组合未通过工艺复核，请修改并重新复核。');
    const dir=join(publishedDir,id);
    const release=join(dir,revision);
    const url='/models/managed/'+id+'/'+revision+'/';
    await mkdir(dir,{recursive:true});
    const stage=join(dir,'.'+randomUUID());
    const manifest=join(release,'template.json');
    if(!(await stat(manifest).catch((error:NodeJS.ErrnoException)=>{
      if(error.code!=='ENOENT')throw error;
    }))){
      try{
        await mkdir(stage);
        for(const assets of Object.values(template.library)){
          for(const key of assetKeys){
            const path=assets[key];
            if(!path)continue;
            if(path.startsWith('/models/parts/')){
              await stat(assetFile(path));
              continue;
            }
            const filename=basename(path);
            await copyFile(assetFile(path),join(stage,filename));
            assets[key]=url+filename;
          }
        }
        await writeFile(join(stage,'cover.jpg'),image);
        await writeFile(join(stage,'template.json'),JSON.stringify({...template,publishedAt:new Date().toISOString()},null,2)+'\n');
        await rename(stage,release);
      }finally{await rm(stage,{recursive:true,force:true});}
    }
    const published={id,revision,name:template.name,headName:template.headName,bandName:template.bandName,url:url+'template.json',image:url+'cover.jpg'};
    await replaceJson(indexFile,[published,...(await index()).filter(item=>item.id!==id)]);
    return published;
  }

  return {list,save,preview,publish,stock};
}
