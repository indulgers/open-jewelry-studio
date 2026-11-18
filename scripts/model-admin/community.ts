import {randomUUID} from 'node:crypto';
import {parseReferenceDesign} from '../../src/stone-first/reference/design.ts';
import {parseDesign} from '../../src/stone-first/ring02/model.ts';
import {RequestError,uuid} from './templates.ts';
import type {CommunityStore} from './community-store.ts';
import {accountAction,communityRoot,digest,fail,getJson,memberOf,putJson,reply} from './community-account.ts';
import {previewJpeg} from './community-image.ts';

type SavedDesign={id:string;title:string;author:string;templateId?:string;revision?:string;design?:object;createdAt:string};
type PublicWork=Pick<SavedDesign,'id'|'title'|'author'|'createdAt'> & {image:string;published:boolean};
type Published={owner:string;work:PublicWork};
type Order={id:string;title:string;workId:string;owner:string;accountName:string;status:'待人工核价'|'已受理'|'已关闭';createdAt:string;templateId?:string;revision?:string;design?:object};
const rootPath='/api/model-admin/community/';
const jsonKey=(owner:string,id:string)=>'designs/'+owner+'/'+id+'.json';
const publicKey=(id:string)=>'published/'+id+'.json';
const imageKey=(id:string)=>communityRoot+'images/'+id+'.jpg';
const authorFor=(admin:boolean)=>admin?'相言工作室':'消费者';

async function inputOf(req:Request){
  if(req.headers.get('content-type')?.split(';')[0]!=='application/json')return fail(415,'请提交 JSON。');
  const max=1450000;
  if(Number(req.headers.get('content-length'))>max)return fail(413,'图片或设置过大。');
  const reader=req.body?.getReader();if(!reader)return fail(400,'内容为空。');
  const chunks:Uint8Array[]=[];let length=0;
  for(;;){
    const {done,value}=await reader.read();if(done)break;
    length+=value.length;if(length>max){await reader.cancel();return fail(413,'图片或设置过大。');}
    chunks.push(value);
  }
  try{
    const input:unknown=JSON.parse(Buffer.concat(chunks).toString());
    if(input&&typeof input==='object'&&!Array.isArray(input))return input as Record<string,unknown>;
  }catch{/* report invalid input below */}
  return fail(400,'内容格式无效。');
}

function publicWork(item:SavedDesign,published:boolean):PublicWork{
  return {id:item.id,title:item.title,author:item.author,createdAt:item.createdAt,image:rootPath+'works/'+item.id+'/image',published};
}
async function list<T>(store:CommunityStore,prefix:string){
  const keys=await store.list(communityRoot+prefix);
  const result=await Promise.all(keys.filter(key=>key.endsWith('.json')).map(async key=>(await store.get(key))?.json() as Promise<T>|undefined));
  return result.filter((item):item is Awaited<T>=>item!==undefined);
}
const newest=<T extends {createdAt:string}>(all:T[])=>all.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));

function snapshot(input:Record<string,unknown>){
  const {title,templateId,revision,design}=input;
  if(typeof title!=='string'||!title.trim()||title.trim().length>80)return fail(422,'作品名需要 1–80 个字符。');
  if(templateId!==undefined&&(typeof templateId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(templateId)))return fail(422,'款式标识无效。');
  if(revision!==undefined&&(typeof revision!=='string'||!/^[a-zA-Z0-9._:-]{1,128}$/.test(revision)))return fail(422,'设计版本无效。');
  if((revision===undefined)!==(design===undefined)||design!==undefined&&!templateId)return fail(422,'设计缺少款式、版本或配置。');
  // A previously published part may no longer be in this server's built-in catalog.
  // Its UUID is retained as a reference for manual review; it cannot set a price.
  const partIds=design&&typeof design==='object'
    ?[Reflect.get(design,'headId'),Reflect.get(design,'bandId')].filter((id):id is string=>typeof id==='string'&&uuid.test(id)):[];
  const parsed=design===undefined?undefined:parseReferenceDesign(design,partIds)??parseDesign(design);
  if(parsed===null)return fail(422,'设计配置无效，请回到编辑器重新保存。');
  return {title:title.trim(),...(typeof templateId==='string'?{templateId}:{}),...(typeof revision==='string'?{revision}:{}),...(parsed?{design:parsed}:{})};
}
function orderDesign(design:object|undefined){
  if(!design)return;
  const {engraving:_engraving,engravingStyle:_style,ringSizeUS:_size,...shared}=design as Record<string,unknown>;
  return shared;
}
async function imageResponse(store:CommunityStore,id:string){
  const image=await store.get(imageKey(id));
  if(!image)return fail(404,'找不到作品预览。');
  return new Response(image.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
const orderSummary=(o:Order)=>({id:o.id,workId:o.workId,title:o.title,status:o.status,createdAt:o.createdAt});

export async function communityApi(req:Request,path:string,store:CommunityStore,isAdmin:boolean):Promise<Response>{
  try{
    const segments=path.split('/');
    const admin=segments[0]==='admin';
    if(admin&&!isAdmin)return fail(401,'请先登录管理后台。');
    if(admin)segments.shift();
    const route=segments.join('/');
    const [resource,id,action]=segments;
    const get=req.method==='GET',post=req.method==='POST';
    if(post&&req.headers.get('origin')!==new URL(req.url).origin)return fail(403,'请从本站提交。');
    if(!get&&!post)return fail(405,'请求方法无效。');
    if(!admin&&post&&['register','login','logout'].includes(route))return await accountAction(req,store,route,await inputOf(req));
    const member=await memberOf(req,store);
    if(!admin&&get&&route==='session')return reply({account:member?{name:member.name}:null});
    if(!admin&&get&&route==='works')return reply(newest((await list<Published>(store,'published/')).map(entry=>entry.work)));
    const owner=admin?'studio':member?.id;
    if(!admin&&resource==='works'&&uuid.test(id)&&action==='image'&&segments.length===3&&get){
      if(!await getJson(store,publicKey(id))&&!(member&&await getJson(store,jsonKey(member.id,id)))&&!(isAdmin&&await getJson(store,jsonKey('studio',id))))return fail(404,'找不到作品。');
      return await imageResponse(store,id);
    }
    if(!owner)return fail(401,'请先登录消费者账号。');
    if(post&&route==='designs'){
      const input=await inputOf(req),data=snapshot(input),image=previewJpeg(input.image);
      const id=randomUUID();
      const item:SavedDesign={...data,id,author:authorFor(admin),createdAt:new Date().toISOString()};
      await store.put(imageKey(id),image,'image/jpeg',{etag:null});
      try{await putJson(store,jsonKey(owner,id),item,{etag:null});}
      catch(error){await store.remove(imageKey(id));throw error;}
      return reply({...item,...publicWork(item,false)},201);
    }
    if(get&&route===(admin?'designs':'mine')){
      const items=await list<SavedDesign>(store,'designs/'+owner+'/');
      return reply(newest(await Promise.all(items.map(async item=>({...item,...publicWork(item,!!await getJson(store,publicKey(item.id)))})))));
    }
    if(resource==='designs'&&uuid.test(id)&&segments.length===3&&post&&(action==='publish'||action==='unpublish')){
      const item=await getJson<SavedDesign>(store,jsonKey(owner,id));
      if(!item)return fail(404,'找不到自己的设计。');
      const publish=action==='publish',work=publicWork(item,publish);
      if(publish)await putJson(store,publicKey(id),{owner,work},{etag:null});
      else await store.remove(communityRoot+publicKey(id));
      return reply(work);
    }
    if(!admin&&resource==='works'&&uuid.test(id)&&segments.length===3&&action==='orders'&&post){
      const receiptId=digest(owner+':'+id).slice(0,32);
      const key='orders/'+owner+'/'+receiptId+'.json';
      const prior=await getJson<Order>(store,key);
      if(prior)return reply(orderSummary(prior));
      const published=await getJson<Published>(store,publicKey(id));
      if(!published)return fail(404,'作品已撤回，请重新查看社区。');
      const item=await getJson<SavedDesign>(store,jsonKey(published.owner,id));
      if(!item)return fail(404,'作品不存在。');
      const order:Order={id:receiptId,title:item.title,workId:id,owner,accountName:member!.name,status:'待人工核价',createdAt:new Date().toISOString(),
        templateId:item.templateId,revision:item.revision,design:orderDesign(item.design)};
      if(!await putJson(store,key,order,{etag:null})){
        const winner=await getJson<Order>(store,key);
        if(!winner)return fail(409,'申请状态正在更新，请重试。');
        return reply(orderSummary(winner));
      }
      return reply(orderSummary(order),201);
    }
    if(admin&&post&&resource==='orders'&&segments.length===4&&segments[3]==='status'){
      if(![id,action].every(part=>/^[a-f0-9]{32}$/.test(part)))return fail(404,'申请不存在。');
      const key='orders/'+id+'/'+action+'.json';
      const saved=await store.get(communityRoot+key);
      if(!saved)return fail(404,'申请不存在。');
      const current=await saved.json() as Order;
      const {expected,status}=await inputOf(req);
      if(status!=='已受理'&&status!=='已关闭')return fail(422,'处理状态无效。');
      if(current.status===status)return reply(orderSummary(current));
      if(expected!==current.status||current.status==='已关闭')return fail(409,'申请状态已变更，请刷新。');
      const updated={...current,status} as Order;
      if(!await putJson(store,key,updated,{etag:saved.headers.get('etag')}))return fail(409,'已有其他人更新了此申请，请刷新。');
      return reply(orderSummary(updated));
    }
    if(get&&route==='orders'){
      const orders=newest(await list<Order>(store,admin?'orders/':'orders/'+owner+'/'));
      return reply(orders.map(order=>admin?{...orderSummary(order),accountName:order.accountName,accountId:order.owner,templateId:order.templateId,revision:order.revision,
        design:order.design,image:rootPath+'admin/orders/'+order.owner+'/'+order.id+'/image'}:orderSummary(order)));
    }
    if(get&&resource==='orders'&&segments.at(-1)==='image'){
      const buyer=admin?id:owner,receipt=admin?action:id;
      if(segments.length!==(admin?4:3)||![buyer,receipt].every(x=>/^[a-f0-9]{32}$/.test(x)))return fail(404,'申请不存在。');
      const order=await getJson<Order>(store,'orders/'+buyer+'/'+receipt+'.json');
      if(!order)return fail(404,'申请不存在。');
      return await imageResponse(store,order.workId);
    }
    return fail(404,'找不到该操作。');
  }catch(error){
    if(error instanceof RequestError)return reply({error:error.message},error.status);
    return reply({error:'社区服务暂不可用，请稍后重试。'},503);
  }
}
