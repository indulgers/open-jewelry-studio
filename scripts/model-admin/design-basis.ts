import type {DesignBasis,VersionRef} from '../../src/community/design-basis.ts';
import {RING_CATALOG} from '../../src/stone-first/catalog.ts';
import {RING02_TEMPLATE} from '../../src/stone-first/ring02/assets.ts';
import {fail} from './community-account.ts';
import type {CommunityStore} from './community-store.ts';
import {uuid} from './templates.ts';

type SourceRelease={id:string;revision:string;catalogId?:string;headId:string;bandId:string};
export type PublishedReleaseReader=(ref:VersionRef)=>Promise<SourceRelease|undefined>;

async function cloudRelease(store:CommunityStore,ref:VersionRef):Promise<SourceRelease|undefined>{
  const publication=await store.get('studio/v1/published/'+ref.id+'.json');
  if(!publication)return;
  const {revisions}=await publication.json() as {revisions:string[]};
  if(!revisions.includes(ref.revision))return;
  const saved=await store.get('studio/v1/releases/'+ref.id+'/'+ref.revision+'/template.json');
  return saved?.json() as Promise<SourceRelease>|undefined;
}

export async function verifyDesignBasis(store:CommunityStore,input:unknown,templateId:string,design:object,localReader?:PublishedReleaseReader):Promise<DesignBasis>{
  if(!input||typeof input!=='object')return fail(422,'设计缺少模型版本，请重新打开编辑器并保存。');
  const templateRef=Reflect.get(input,'template');
  const releases=new Map<string,Promise<SourceRelease|undefined>>();
  async function resolve(key:'template'|'head'|'band',catalogId:unknown){
    const raw=Reflect.get(input as object,key);
    if(!raw||typeof raw!=='object')return fail(422,'请提供完整的模板与部件版本。');
    const {id,revision}=raw;
    if(typeof id!=='string'||typeof revision!=='string')return fail(422,'模型版本无效。');
    if(uuid.test(id)&&uuid.test(revision)){
      const cacheKey=id+'/'+revision;
      let pending=releases.get(cacheKey);
      if(!pending){
        pending=localReader?localReader({id,revision}):cloudRelease(store,{id,revision});
        releases.set(cacheKey,pending);
      }
      const release=await pending;
      if(!release||release.id!==id||release.revision!==revision)return fail(422,'无法查到这个发布版本。');
      const sourceId=key==='band'?release.bandId:release.headId;
      // Managed preview stores the physical part ID; the combination editor stores the catalog ID.
      const fixedSlot=key!=='template'&&templateRef?.id===id&&templateRef?.revision===revision&&catalogId===sourceId;
      if((release.catalogId??id)!==catalogId&&!fixedSlot)return fail(422,'该款式或部件与保存的发布版本不符。');
      if(typeof sourceId!=='string'||!(/^[a-zA-Z0-9-]{1,100}$/).test(sourceId))return fail(422,'发布版缺少部件来源。');
      return {id,revision,sourceId};
    }
    const stock=RING_CATALOG.find(ring=>ring.id===id&&ring.revision===revision);
    if(!stock||id!==catalogId)return fail(422,'原款模型版本不存在。');
    return {id,revision,sourceId:id};
  }
  const reference=Reflect.get(design,'kind')==='reference';
  const [template,head,band]=await Promise.all([
    resolve('template',templateId),resolve('head',reference?(Reflect.get(design,'headId')??templateId):templateId),
    resolve('band',reference?(Reflect.get(design,'bandId')??templateId):templateId),
  ]);
  if(!reference&&[template,head,band].some(part=>part.id!=='ring-02'||part.revision!==RING02_TEMPLATE.revision))
    return fail(422,'精调模式只能使用指定的围钻模型版本。');
  return {template:{id:template.id,revision:template.revision},head,band};
}
