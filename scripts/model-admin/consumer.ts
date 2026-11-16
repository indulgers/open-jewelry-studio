import {parsePersonalImage} from '../../src/stone-first/reference/personalization.ts';
import {createHash,randomUUID} from 'node:crypto';
import type {CloudStore} from './cloud-store.ts';
import {RequestError,uuid} from './templates.ts';
import {combinationQuote,isMoney,type PriceBook} from '../../src/stone-first/pricing.ts';
import {STONE_APPEARANCES} from '../../src/viewer/stoneAppearance.ts';
import {engravingProblem} from '../../src/stone-first/ring02/engraving.ts';
import {PAVE_DIAMETERS,PAVE_LENGTHS} from '../../src/stone-first/reference/pave-options.ts';
import type {CatalogRing} from '../../src/stone-first/catalog.ts';
import type {ReferenceAssets} from '../../src/stone-first/reference/part-library.ts';
import type {ConfigurationCheck,DesignInput,SavedDesign,DesignRequest,FormalQuote,LetteringReview} from '../../src/stone-first/consumer-types.ts';

type Storefront={catalog:CatalogRing[];parts:Record<string,ReferenceAssets>;prices:PriceBook};
const root='studio/v1/consumer/';
const fail=(status:number,message:string):never=>{throw new RequestError(status,message);};
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function consumerBody(request:Request,limit=128*1024){
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json')fail(400,'请提交 JSON。');
  if(Number(request.headers.get('content-length'))>limit)fail(413,'提交内容过大。');
  const bytes=await request.arrayBuffer();
  if(bytes.byteLength>limit)fail(413,'提交内容过大。');
  let value:unknown;
  try{value=JSON.parse(new TextDecoder().decode(bytes));}catch{fail(400,'提交内容无效。');}
  if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'提交内容必须为对象。');
  return value as Record<string,any>;
}
function owner(request:Request){
  const token=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization')??'')?.[1];
  return token?hash(token):fail(401,'请先创建游客恢复码，或输入已有恢复码。');
}
function input(value:any):DesignInput{
  if(!value||!uuid.test(value.id??'')||!uuid.test(value.revision??'')||!(value.expectedRevision===null||uuid.test(value.expectedRevision??'')))fail(422,'设计版本无效，请重新打开编辑器。');
  if(typeof value.templateId!=='string'||value.templateId.length>128)fail(422,'款式无效。');
  for(const part of [value.head,value.band])if(!part||typeof part.id!=='string'||typeof part.revision!=='string'||part.id.length>128||part.revision.length>128)fail(422,'部件版本无效。');
  const d=value.design;
  if(!d||d.kind!=='reference'||['center','halo','shoulder'].some(key=>typeof d[key]!=='string'||!Object.hasOwn(STONE_APPEARANCES,d[key])))fail(422,'宝石选择无效。');
  if(typeof d.engraving!=='string'||d.engraving!==d.engraving.trim()||engravingProblem(d.engraving))fail(422,'请确认刻字文字，勿包含未支持的字符或首尾空格。');
  if(d.headId!==undefined&&d.headId!==value.head.id||d.bandId!==undefined&&d.bandId!==value.band.id)fail(422,'部件选择与配置不一致。');
  if((d.paveDiameter!==undefined&&!PAVE_DIAMETERS.includes(d.paveDiameter))||(d.paveLength!==undefined&&!PAVE_LENGTHS.includes(d.paveLength)))fail(422,'排钻参数无效。');
  if(d.requestNote!==undefined&&(typeof d.requestNote!=='string'||d.requestNote.length>1000))fail(422,'制作要求不能超过 1000 个字符。');
  const image=d.image===undefined?undefined:parsePersonalImage(d.image);
  if(image===null)fail(422,'个性化图片信息无效。');
  const thumbnail=value.thumbnail;
  if(thumbnail!==undefined&&(typeof thumbnail!=='string'||thumbnail.length>110*1024||!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(thumbnail)))fail(422,'方案截图无效，请重新生成。');
  return {id:value.id,revision:value.revision,expectedRevision:value.expectedRevision,templateId:value.templateId,head:{id:value.head.id,revision:value.head.revision},band:{id:value.band.id,revision:value.band.revision},
    design:{kind:'reference',...(typeof d.requestNote==='string'?{requestNote:d.requestNote}:{}),...(image?{image}:{}),center:d.center,halo:d.halo,shoulder:d.shoulder,engraving:d.engraving,...(d.headId?{headId:d.headId}:{}),...(d.bandId?{bandId:d.bandId}:{}),...(d.paveDiameter!==undefined?{paveDiameter:d.paveDiameter}:{}),...(d.paveLength!==undefined?{paveLength:d.paveLength}:{})},...(thumbnail?{thumbnail}:{})};
}
export function checkConfiguration(design:DesignInput,storefront:Storefront){
  const {catalog,prices,parts}=storefront;
  const template=catalog.find(item=>item.id===design.templateId&&item.listed);
  if(!template)fail(409,'原款式已下架，请重新选款。');
  const head=catalog.find(item=>item.id===design.head.id&&item.listed),band=catalog.find(item=>item.id===design.band.id&&item.listed);
  if(!head||!band)fail(409,'戒头或戒圈已下架，请重新选款。');
  if(head!.revision!==design.head.revision||band!.revision!==design.band.revision)fail(409,'戒头或戒圈版本已更新，请刷新后重新核对配置。');
  if((design.design.headId??design.templateId)!==head!.id||(design.design.bandId??design.templateId)!==band!.id)fail(422,'款式与部件配置不一致。');
  if((design.design.paveDiameter??100)!==100||(design.design.paveLength??100)!==100){
    if(!band!.zones.includes('shoulder')||band!.automaticPave===false)fail(422,'该戒圈不支持自动排钻，请恢复原款参数。');
  }
  const headAssets=parts[head!.headSourceId??head!.id],bandAssets=parts[band!.bandSourceId??band!.id];
  if(!headAssets||!bandAssets)fail(422,'部件素材版本缺失，请联系管理员。');
  const issues=[{field:'material',message:'实物材质及表面工艺待确认。'},{field:'size',message:'圈号标准、尺寸及制作公差待确认。'},{field:'head',message:'当前组合的接合与镶嵌工艺待复核。'}];
  if(design.design.engraving)issues.push({field:'engraving',message:'刻字字体、可刻区域、字高与生产文件待确认。'});
  if(design.design.image)issues.push({field:'image',message:'图片位置、线宽、尺寸及生产文件待工艺人员确认。'});
  const missingSize=template!.workflow?.requireSizeNote&&!design.design.requestNote?.trim();
  if(missingSize)issues.unshift({field:'size',message:'请填写并确认尺寸与制作要求；不清楚圈号时可以注明请协助测量。'});
  const check:ConfigurationCheck={revision:design.revision,state:missingSize?'incomplete':'manual',issues,quote:combinationQuote(head!,band!,design.design,prices),purchasable:false};
  return {check,assets:{head:headAssets,band:bandAssets},templates:{head:head!,band:band!},name:head!.name+(band!.id!==head!.id?' × '+band!.name:'')};
}

export function consumerLibrary(store:CloudStore,getStorefront:()=>Promise<Storefront>){
  async function read<T>(key:string){const res=await store.get(key);return res?{value:await res.json() as T,etag:res.headers.get('etag')}:undefined;}
  const put=(key:string,value:unknown,etag?:string|null)=>store.put(key,JSON.stringify(value),'application/json; charset=utf-8',etag===undefined?undefined:{etag});
  const draftRoot=(owner:string,id:string)=>root+'designs/'+owner+'/'+id+'/';
  type Pointer={revision:string;revisions:string[];savedAt:string;name:string};
  type StoredRequest=DesignRequest&{owner:string};
  const requestKey=(id:string)=>root+'requests/'+id+'.json';
  const requestId=(owner:string,id:string,revision:string)=>hash(owner+':'+id+':'+revision).slice(0,24);
  async function snapshot(who:string,id:string,revision:string){
    if(!uuid.test(id)||!uuid.test(revision))fail(404,'找不到设计版本。');
    const base=draftRoot(who,id),pointer=await read<Pointer>(base+'latest.json');
    if(!pointer?.value.revisions.includes(revision))fail(404,'找不到设计版本。');
    return (await read<SavedDesign>(base+revision+'.json'))?.value??fail(404,'找不到设计版本。');
  }
  async function save(who:string,raw:unknown){
    const data=input(raw),base=draftRoot(who,data.id),prior=await read<Pointer>(base+'latest.json');
    if(prior?.value.revision===data.revision){
      const saved=await snapshot(who,data.id,data.revision);
      if(JSON.stringify(saved.design)!==JSON.stringify(data.design)||JSON.stringify(saved.head)!==JSON.stringify(data.head)||JSON.stringify(saved.band)!==JSON.stringify(data.band)||saved.templateId!==data.templateId)fail(409,'该修订已经保存了不同内容，请生成新修订。');
      return saved;
    }
    if((prior?.value.revision??null)!==data.expectedRevision)fail(409,'服务器设计已被修改。请保留本机内容，查看服务器版本后再处理。');
    if(!prior&&(await store.list(root+'designs/'+who+'/')).filter(key=>key.endsWith('/latest.json')).length>=30)fail(422,'已保存 30 份游客方案，请使用已有方案继续编辑。');
    if(prior?.value.revisions.includes(data.revision))fail(409,'恢复历史方案请生成新修订，不能改写历史版本。');
    if(prior&&prior.value.revisions.length>=100)fail(422,'该方案已保存 100 个版本，请另存为新方案。');
    if(data.design.image&&!await store.get(root+'images/'+who+'/'+data.design.image.id+'.jpg','HEAD'))fail(422,'找不到当前游客上传的图片，请重新上传。');
    const checked=checkConfiguration(data,await getStorefront());
    const {expectedRevision,...fields}=data;
    let saved:SavedDesign={...fields,...checked,savedAt:new Date().toISOString()};
    const versionKey=base+data.revision+'.json';
    if(!await put(versionKey,saved,null)){
      const existing=(await read<SavedDesign>(versionKey))!.value;
      if(JSON.stringify(existing.design)!==JSON.stringify(data.design)||JSON.stringify(existing.head)!==JSON.stringify(data.head)||JSON.stringify(existing.band)!==JSON.stringify(data.band)||existing.templateId!==data.templateId)fail(409,'该修订已有不同内容，请生成新修订。');
      saved=existing;
    }
    if(!await put(base+'latest.json',{revision:data.revision,revisions:[...(prior?.value.revisions??[]),data.revision],savedAt:saved.savedAt,name:saved.name},prior?.etag??null))fail(409,'其他页面已更新方案，请保留本机内容并重新读取服务器版本。');
    return saved;
  }
  async function submit(who:string,id:string,revision:string,thumbnail?:unknown){
    const ticket=requestId(who,id,revision),existing=await read<StoredRequest>(requestKey(ticket));
    if(existing)return existing.value;
    const design=await snapshot(who,id,revision);
    if(thumbnail!==undefined&&(typeof thumbnail!=='string'||thumbnail.length>110*1024||!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(thumbnail)))fail(422,'方案截图无效。');
    if(!design.thumbnail&&!thumbnail)fail(422,'请先生成当前方案的截图，再提交人工确认。');
    const checked=checkConfiguration({...design,expectedRevision:null},await getStorefront());
    if(checked.check.state==='incomplete')fail(422,'请完成必填项后再提交。');
    if(checked.check.quote.amount!==design.check.quote.amount||checked.check.quote.version!==design.check.quote.version)fail(409,'参考报价已更新，请生成新修订并重新确认。');
    const now=new Date().toISOString();
    const record:StoredRequest={id:ticket,owner:who,design:{...design,...(typeof thumbnail==='string'?{thumbnail}:{})},status:'pending',stateRevision:randomUUID(),createdAt:now,updatedAt:now,note:'',history:[{at:now,status:'pending',reviewer:'游客提交',note:''}]};
    if(!await put(requestKey(ticket),record,null))return (await read<StoredRequest>(requestKey(ticket)))!.value;
    return record;
  }
  async function requests(who?:string){
    const keys=await store.list(root+'requests/');
    const records=await Promise.all(keys.filter(key=>key.endsWith('.json')).map(async key=>(await read<StoredRequest>(key))!.value));
    return records.filter(item=>!who||item.owner===who).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(({owner,...item})=>item);
  }
  async function review(id:string,data:any){
    if(!/^[a-f0-9]{24}$/.test(id))fail(404,'找不到申请。');
    const prior=await read<StoredRequest>(requestKey(id));
    if(!prior)fail(404,'找不到申请。');
    if(data?.expectedRevision!==prior!.value.stateRevision)fail(409,'申请状态已更新，请重新读取。');
    if(!['pending','needs-information','declined','quoted'].includes(data.status)||typeof data.note!=='string'||!data.note.trim()||data.note.length>4000||typeof data.reviewer!=='string'||!data.reviewer.trim()||data.reviewer.length>80)fail(422,'请填写处理人、处理状态和说明。');
    if(prior!.value.status==='confirmed')fail(409,'该版本已由客户确认，不能改写确认记录。');
    let quote:FormalQuote|undefined;
    if(data.status==='quoted'){
      if(!isMoney(data.quote?.amount)||data.quote.amount<=0||typeof data.quote.validUntil!=='string'||!Number.isFinite(Date.parse(data.quote.validUntil))||Date.parse(data.quote.validUntil)<=Date.now()||typeof data.quote.leadTime!=='string'||!data.quote.leadTime.trim()||data.quote.leadTime.length>120||typeof data.quote.productionRequirements!=='string'||!data.quote.productionRequirements.trim()||data.quote.productionRequirements.length>8000||data.manufacturingConfirmed!==true)fail(422,'正式报价须填写价格、交期和制作要求，并确认工艺信息已经人工核对。');
      if((prior!.value.design.design.engraving||prior!.value.design.design.image)&&!prior!.value.productionFile)fail(422,'个性化方案须先关联本设计版本的生产文件。');
      let lettering:LetteringReview|undefined;
      if(prior!.value.design.design.engraving){
        const v=data.quote.lettering;
        if(!v||['fontId','fontVersion','licenseEvidence'].some(key=>typeof v[key]!=='string'||!v[key].trim()||v[key].length>300)||v.position!=='inner-band'||!['left','center','right'].includes(v.alignment)||!['forward','reverse'].includes(v.direction)||['heightMm','minHeightMm','textWidthMm','areaWidthMm'].some(key=>typeof v[key]!=='number'||!Number.isFinite(v[key])||v[key]<=0||v[key]>1000)||v.heightMm<v.minHeightMm||v.textWidthMm>v.areaWidthMm)fail(422,'请填写字体与授权依据、位置方向、实际字高和字宽。字高不得小于工艺下限，字宽不得超出可刻区域。');
        lettering={fontId:v.fontId.trim(),fontVersion:v.fontVersion.trim(),licenseEvidence:v.licenseEvidence.trim(),position:'inner-band',alignment:v.alignment,direction:v.direction,heightMm:v.heightMm,minHeightMm:v.minHeightMm,textWidthMm:v.textWidthMm,areaWidthMm:v.areaWidthMm};
      }
      quote={...(lettering?{lettering}:{}),amount:data.quote.amount,currency:'CNY',validUntil:new Date(data.quote.validUntil).toISOString(),leadTime:data.quote.leadTime.trim(),productionRequirements:data.quote.productionRequirements.trim(),reviewer:data.reviewer.trim()};
    }
    const now=new Date().toISOString(),{quote:oldQuote,...rest}=prior!.value;
    const next:StoredRequest={...rest,status:data.status,stateRevision:randomUUID(),updatedAt:now,note:data.note.trim(),...(quote?{quote}:{}),history:[...prior!.value.history,{at:now,status:data.status,reviewer:data.reviewer.trim(),note:data.note.trim()}]};
    if(!await put(requestKey(id),next,prior!.etag??null))fail(409,'申请已被其他人处理，请重新读取。');
    const {owner,...result}=next;return result;
  }
  async function handle(request:Request,path:string[]){
    const who=owner(request),[action,id,revision,verb]=path,method=request.method;
    if(action==='images'&&!id&&method==='POST'){
      const value=await consumerBody(request,1500*1024);
      const match=typeof value.image==='string'&&/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value.image);
      const bytes=match?Buffer.from(match[1],'base64'):undefined;
      if(!bytes||bytes.length>1024*1024||!validJpeg(bytes))fail(422,'请上传处理后不超过 1 MB、边长不超过 1600 像素的 JPEG 图片。');
      const imageId=createHash('sha256').update(bytes!).digest('hex');
      const imageRoot=root+'images/'+who+'/';
      if((await store.list(imageRoot)).length>=30&&!await store.get(imageRoot+imageId+'.jpg','HEAD'))fail(422,'该游客已上传 30 张图片，请复用已有图片。');
      await store.put(imageRoot+imageId+'.jpg',new Uint8Array(bytes!),'image/jpeg',{etag:null});
      return json({id:imageId},201);
    }
    if(action==='images'&&/^[a-f0-9]{64}$/.test(id??'')&&!revision&&method==='GET'){
      const response=await store.get(root+'images/'+who+'/'+id+'.jpg');
      if(!response)fail(404,'找不到图片。');
      return new Response(response!.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    }
    if(action==='check'&&method==='POST')return json(checkConfiguration(input(await consumerBody(request)),await getStorefront()).check);
    if(action==='designs'&&!id&&method==='GET'){
      const keys=await store.list(root+'designs/'+who+'/');
      const records=await Promise.all(keys.filter(key=>key.endsWith('/latest.json')).map(async key=>{const p=(await read<Pointer>(key))!.value;return {id:key.split('/').at(-2),...p};}));
      return json(records.sort((a,b)=>b.savedAt.localeCompare(a.savedAt)));
    }
    if(action==='designs'&&!id&&method==='POST')return json(await save(who,await consumerBody(request)),201);
    if(action==='designs'&&id&&revision&&!verb&&method==='GET')return json(await snapshot(who,id,revision));
    if(action==='designs'&&id&&revision&&verb==='submit'&&method==='POST'){
      const {owner,...record}=await submit(who,id,revision,(await consumerBody(request)).thumbnail);return json(record,201);
    }
    if(action==='requests'&&!id&&method==='GET')return json(await requests(who));
    if(action==='requests'&&id&&revision==='reply'&&!verb&&method==='POST'){
      if(!/^[a-f0-9]{24}$/.test(id))fail(404,'找不到申请。');
      const prior=await read<StoredRequest>(requestKey(id));
      if(!prior||prior.value.owner!==who)fail(404,'找不到申请。');
      const data=await consumerBody(request);
      if(data.expectedRevision!==prior!.value.stateRevision)fail(409,'申请已更新，请重新读取。');
      if(prior!.value.status!=='needs-information'||typeof data.note!=='string'||!data.note.trim()||data.note.length>4000)fail(422,'请在待补充资料的申请中填写说明。');
      const now=new Date().toISOString(),next:StoredRequest={...prior!.value,status:'pending',stateRevision:randomUUID(),updatedAt:now,note:'客户已补充说明，等待复核。',history:[...prior!.value.history,{at:now,status:'pending',reviewer:'游客补充',note:data.note}]};
      if(!await put(requestKey(id),next,prior!.etag??null))fail(409,'申请已更新，请重新读取。');
      const {owner,...result}=next;return json(result);
    }
    if(action==='requests'&&id&&revision==='file'&&!verb&&method==='GET'){
      if(!/^[a-f0-9]{24}$/.test(id))fail(404,'找不到申请。');
      const record=await read<StoredRequest>(requestKey(id));
      if(!record||record.value.owner!==who)fail(404,'找不到申请。');
      return downloadFile(record!.value);
    }
    if(action==='requests'&&id&&revision==='confirm'&&!verb&&method==='POST'){
      if(!/^[a-f0-9]{24}$/.test(id))fail(404,'找不到申请。');
      const prior=await read<StoredRequest>(requestKey(id));
      if(!prior||prior.value.owner!==who)fail(404,'找不到申请。');
      const data=await consumerBody(request);
      if(data.expectedRevision!==prior!.value.stateRevision)fail(409,'报价或制作要求已更新，请重新核对。');
      if(prior!.value.status==='confirmed'){const {owner,...item}=prior!.value;return json(item);}
      if(prior!.value.status!=='quoted'||!prior!.value.quote)fail(422,'该方案尚未完成正式报价，不能确认购买。');
      if(Date.parse(prior!.value.quote!.validUntil)<=Date.now())fail(409,'正式报价已过期，请联系工作人员重新报价。');
      if(checkConfiguration({...prior!.value.design,expectedRevision:null},await getStorefront()).check.state==='incomplete')fail(409,'款式要求已更新，请重新核对方案。');
      const now=new Date().toISOString(),next={...prior!.value,status:'confirmed' as const,confirmedAt:now,updatedAt:now,history:[...prior!.value.history,{at:now,status:'confirmed' as const,reviewer:'游客确认',note:'确认本版本制作要求、正式报价与交期'}]};
      if(!await put(requestKey(id),next,prior!.etag??null))fail(409,'报价已更新，请重新核对。');
      const {owner,...result}=next;return json(result);
    }
    return json({error:'找不到该操作。'},404);
  }
  async function downloadFile(record:StoredRequest){
    if(!record.productionFile)fail(404,'尚未关联生产文件。');
    const response=await store.get(root+'production/'+record.id+'/'+record.productionFile!.id);
    if(!response)fail(404,'找不到生产文件。');
    return new Response(response!.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(record.productionFile!.name),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  async function adminFile(id:string,request:Request,kind:'file'|'image'){
    if(!/^[a-f0-9]{24}$/.test(id))fail(404,'找不到申请。');
    const prior=await read<StoredRequest>(requestKey(id));
    if(!prior)fail(404,'找不到申请。');
    if(kind==='image'&&request.method==='GET'){
      const image=prior!.value.design.design.image;
      const response=image&&await store.get(root+'images/'+prior!.value.owner+'/'+image.id+'.jpg');
      if(!response)fail(404,'找不到参考图片。');
      return new Response(response!.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    }
    if(kind==='file'&&request.method==='GET')return downloadFile(prior!.value);
    if(kind==='file'&&request.method==='POST'){
      if(prior!.value.status==='confirmed')fail(409,'客户已确认的版本不能替换生产文件。');
      const data=await consumerBody(request,4200*1024);
      if(data.expectedRevision!==prior!.value.stateRevision)fail(409,'申请已更新，请重新读取。');
      if(typeof data.name!=='string'||data.name.length>120||/[\/\\\x00-\x1f]/.test(data.name)||!/^.+\.(pdf|dxf|step|stp|txt)$/i.test(data.name)||typeof data.base64!=='string'||! /^[A-Za-z0-9+/]+={0,2}$/.test(data.base64)||typeof data.reviewer!=='string'||!data.reviewer.trim()||data.reviewer.length>80)fail(422,'请填写处理人并上传 PDF、DXF、STEP 或 TXT 生产文件。');
      const bytes=Buffer.from(data.base64,'base64');
      if(!bytes.length||bytes.length>3*1024*1024)fail(413,'生产文件不能超过 3 MB。');
      const fileId=randomUUID(),now=new Date().toISOString();
      const fileKey=root+'production/'+id+'/'+fileId;
      await store.put(fileKey,new Uint8Array(bytes),'application/octet-stream',{etag:null});
      const {quote:oldQuote,...record}=prior!.value;
      const next:StoredRequest={...record,status:'pending',stateRevision:randomUUID(),updatedAt:now,productionFile:{id:fileId,name:data.name,sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length,uploadedAt:now},history:[...record.history,{at:now,status:'pending',reviewer:data.reviewer.trim(),note:'关联生产文件 '+data.name+'，需重新复核与报价'}]};
      if(!await put(requestKey(id),next,prior!.etag??null)){await store.remove(fileKey);fail(409,'申请已被修改，请重新读取。');}
      const {owner,...result}=next;return json(result,201);
    }
    return json({error:'找不到操作。'},404);
  }
  return {handle,requests,review,adminFile};
}

function validJpeg(bytes:Buffer){
  if(bytes.length<12||bytes.readUInt16BE(0)!==0xffd8||bytes.readUInt16BE(bytes.length-2)!==0xffd9)return false;
  let at=2;
  while(at+4<bytes.length){
    if(bytes[at++]!==0xff)return false;
    while(bytes[at]===0xff)at++;
    const marker=bytes[at++];
    if(at+2>bytes.length)return false;
    if(marker===0xda||marker===0xd9)return false;
    const length=bytes.readUInt16BE(at);
    if(length<2||at+length>bytes.length)return false;
    if([0xc0,0xc1,0xc2].includes(marker)){
      if(length<8||bytes[at+2]!==8)return false;
      const height=bytes.readUInt16BE(at+3),width=bytes.readUInt16BE(at+5);
      return height>0&&height<=1600&&width>0&&width<=1600;
    }
    at+=length;
  }
  return false;
}
