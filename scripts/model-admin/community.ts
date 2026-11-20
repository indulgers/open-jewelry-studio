import {verifyDesignBasis,type PublishedReleaseReader} from './design-basis.ts';
import type {DesignBasis} from '../../src/community/design-basis.ts';
import {createHash,randomUUID} from 'node:crypto';
import {parseReferenceDesign} from '../../src/stone-first/reference/design.ts';
import {parseDesign} from '../../src/stone-first/ring02/model.ts';
import {RequestError,uuid} from './templates.ts';
import type {CommunityStore} from './community-store.ts';
import {accountAction,communityRoot,digest,fail,getJson,memberOf,putJson,reply} from './community-account.ts';
import {confirmOrder,manageOrder,orderSummary,type Order} from './community-orders.ts';
import {previewJpeg} from './community-image.ts';

type SavedDesign={id:string;title:string;author:string;templateId?:string;revision?:string;design?:object;basis?:DesignBasis;details?:{label:string;value:string}[];createdAt:string};
type PublicWork=Pick<SavedDesign,'id'|'title'|'author'|'createdAt'> & {image:string;published:boolean};
type Published={owner:string;work:PublicWork};
const rootPath='/api/model-admin/community/';
const jsonKey=(owner:string,id:string)=>'designs/'+owner+'/'+id+'.json';
const publicKey=(id:string)=>'published/'+id+'.json';
const imageKey=(id:string)=>communityRoot+'images/'+id+'.jpg';
const authorFor=(admin:boolean)=>admin?'相言工作室':'消费者';

export async function inputOf(req:Request,max=1450000){
  if(req.headers.get('content-type')?.split(';')[0]!=='application/json')return fail(415,'请提交 JSON。');
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
async function readInBatches<T, R>(items: T[], read: (item: T) => Promise<R>) {
  const results: R[] = [];
  for (let offset = 0; offset < items.length; offset += 8)
    results.push(...await Promise.all(items.slice(offset, offset + 8).map(read)));
  return results;
}
async function list<T>(store:CommunityStore,prefix:string){
  const keys=await store.list(communityRoot+prefix);
  const result=await readInBatches(keys.filter(key=>key.endsWith('.json')),async key=>(await store.get(key))?.json() as Promise<T>|undefined);
  return result.filter((item):item is Awaited<T>=>item!==undefined);
}
const newest=<T extends {createdAt:string}>(all:T[])=>all.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));

function snapshot(input:Record<string,unknown>){
  const {title,templateId,revision,design}=input;
  if(typeof title!=='string'||!title.trim()||title.trim().length>80)return fail(422,'作品名需要 1–80 个字符。');
  if(templateId!==undefined&&(typeof templateId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(templateId)))return fail(422,'款式标识无效。');
  if(revision!==undefined&&(typeof revision!=='string'||!/^[a-zA-Z0-9._:-]{1,128}$/.test(revision)))return fail(422,'设计版本无效。');
  if((revision===undefined)!==(design===undefined)||design!==undefined&&!templateId)return fail(422,'设计缺少款式、版本或配置。');
  let details:SavedDesign['details'];
  if(input.details!==undefined){
    if(!design||!Array.isArray(input.details)||input.details.length>32)return fail(422,'保存的配置摘要无效。');
    details=input.details.map(row=>{
      if(!row||typeof row.label!=='string'||row.label.length>64||typeof row.value!=='string'||row.value.length>512)return fail(422,'配置说明过长或缺少文字。');
      return {label:row.label,value:row.value};
    });
  }
  // A previously published part may no longer be in this server's built-in catalog.
  // Its UUID is retained as a reference for manual review; it cannot set a price.
  const partIds=design&&typeof design==='object'
    ?[Reflect.get(design,'headId'),Reflect.get(design,'bandId')].filter((id):id is string=>typeof id==='string'&&uuid.test(id)):[];
  const parsed=design===undefined?undefined:parseReferenceDesign(design,partIds)??parseDesign(design);
  if(parsed===null)return fail(422,'设计配置无效，请回到编辑器重新保存。');
  return {title:title.trim(),...(typeof templateId==='string'?{templateId}:{}),...(typeof revision==='string'?{revision}:{}),...(parsed?{design:parsed}:{}),...(details?{details}:{})};
}
type SaveReservation={id:string;fingerprint:string;createdAt:string};
async function saveDesign(input:Record<string,unknown>,owner:string,admin:boolean,store:CommunityStore,localReader?:PublishedReleaseReader){
  if(typeof input.requestId!=='string'||!uuid.test(input.requestId))return fail(422,'保存请求编号无效，请重新打开保存窗口。');
  const snapshotData=snapshot(input),image=previewJpeg(input.image);
  const basis=snapshotData.design?await verifyDesignBasis(store,input.basis,snapshotData.templateId!,snapshotData.design,localReader):undefined;
  if(!snapshotData.design&&input.basis!==undefined)return fail(422,'独立图片作品不能指定模型版本。');
  const data={...snapshotData,basis};
  const canonical=JSON.stringify(data,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)
    ?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);
  const fingerprint=createHash('sha256').update(canonical).update(image).digest('hex');
  const key='saves/'+owner+'/'+input.requestId+'.json';
  const initial:SaveReservation={id:randomUUID(),createdAt:new Date().toISOString(),fingerprint};
  const reservation=await putJson(store,key,initial,{etag:null})?initial:await getJson<SaveReservation>(store,key);
  if(!reservation)return fail(503,'保存状态尚未就绪，请重试。');
  if(reservation.fingerprint!==fingerprint)return reply({error:'这个请求编号已用于其他作品，请重新保存。',code:'REQUEST_CONFLICT'},409);
  // A failed metadata write leaves a reusable reservation. A retry completes
  // the same image and metadata keys without exposing a partial design.
  const {id,createdAt}=reservation;
  const item:SavedDesign={...data,id,createdAt,author:authorFor(admin)};
  await store.put(imageKey(id),image,'image/jpeg',{etag:null});
  const created=await putJson(store,jsonKey(owner,id),item,{etag:null});
  return reply({...item,...publicWork(item,!created&&!!await getJson(store,publicKey(id)))},created?201:200);
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

export async function communityApi(req:Request,path:string,store:CommunityStore,isAdmin:boolean,localReader?:PublishedReleaseReader):Promise<Response>{
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
    if(!admin&&post&&['register','login'].includes(route))return await accountAction(req,store,route,await inputOf(req));
    if(!admin&&get&&route==='works')return reply(newest((await list<Published>(store,'published/')).map(entry=>entry.work)));
    const workImage=!admin&&resource==='works'&&uuid.test(id)&&action==='image'&&segments.length===3&&get;
    if(workImage&&await getJson(store,publicKey(id)))return await imageResponse(store,id);
    const member=admin?undefined:await memberOf(req,store);
    if(!admin&&get&&route==='session')return reply(member?{account:{name:member.name},localProfileId:member.id}:{account:null});
    const posted=post?await inputOf(req):{};
    const expected=get?req.headers.get('X-Expected-Account'):posted.expectedAccount;
    const checkAccount=!admin&&(post||(get&&(route==='orders'||route==='mine')&&expected!==null));
    if(checkAccount&&(!member||typeof expected!=='string'||expected.toLowerCase()!==member.name.toLowerCase())){
      return reply({error:'登录账号发生变化，请重新确认当前账号。',code:'ACCOUNT_CHANGED'},member?409:401);
    }
    if(!admin&&post&&route==='logout')return await accountAction(req,store,route,posted);
    const owner=admin?'studio':member?.id;
    if(workImage){
      if(!(member&&await getJson(store,jsonKey(member.id,id)))&&!(isAdmin&&await getJson(store,jsonKey('studio',id))))return fail(404,'找不到作品。');
      return await imageResponse(store,id);
    }
    if(!owner)return fail(401,'请先登录消费者账号。');
    if(post&&route==='designs')return await saveDesign(posted,owner,admin,store,localReader);
    if(get&&route===(admin?'designs':'mine')){
      const items=await list<SavedDesign>(store,'designs/'+owner+'/');
      return reply(newest(await readInBatches(items,async item=>({...item,...publicWork(item,!!await getJson(store,publicKey(item.id)))}))));
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
        templateId:item.templateId,revision:item.revision,design:orderDesign(item.design),basis:item.basis};
      if(!await putJson(store,key,order,{etag:null})){
        const winner=await getJson<Order>(store,key);
        if(!winner)return fail(409,'申请状态正在更新，请重试。');
        return reply(orderSummary(winner));
      }
      return reply(orderSummary(order),201);
    }
    if(admin&&post&&resource==='orders'&&segments.length===4&&['status','quote'].includes(segments[3]))
      return await manageOrder(store,id,action,segments[3],posted);
    if(!admin&&post&&resource==='orders'&&segments.length===3&&action==='confirm')
      return await confirmOrder(store,owner,id,posted);
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
