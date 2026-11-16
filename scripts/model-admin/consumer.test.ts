// @vitest-environment node
import {createHash,randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {consumerLibrary} from './consumer.ts';
import {cloudAdmin} from './cloud-admin.ts';
import type {CloudStore} from './cloud-store.ts';
import {RING_CATALOG} from '../../src/stone-first/catalog.ts';
import parts from '../../src/stone-first/reference/part-assets.json';
import {ORIGINAL_REFERENCE} from '../../src/stone-first/reference/design.ts';
const token='a'.repeat(64),other='b'.repeat(64),origin='https://studio.invalid';
const thumbnail='data:image/jpeg;base64,/9j/2Q==';
function fixture(){
 const objects=new Map<string,{bytes:ArrayBuffer;type:string;etag:string}>();
 const store:CloudStore={
  async get(key){const value=objects.get(key);return value&&new Response(value.bytes,{headers:{'Content-Type':value.type,ETag:value.etag}});},
  async put(key,body,type,condition){if(condition&&(objects.get(key)?.etag??null)!==condition.etag)return false;const bytes=await new Response(body).arrayBuffer();objects.set(key,{bytes,type,etag:'"'+createHash('sha256').update(new Uint8Array(bytes)).digest('hex')+'"'});return true;},
  async list(prefix){return [...objects.keys()].filter(key=>key.startsWith(prefix));},async remove(key){objects.delete(key);},async sign(key){return 'https://bucket.invalid/'+key;},
 };
 const catalog=structuredClone(RING_CATALOG),library=consumerLibrary(store,async()=>({catalog,parts,prices:{revision:'test',bases:{},components:{}}}));
 const template=catalog.find(item=>item.id==='ring-starlight')!;
 const data={id:randomUUID(),revision:randomUUID(),expectedRevision:null as string|null,templateId:template.id,head:{id:template.id,revision:template.revision},band:{id:template.id,revision:template.revision},design:{...ORIGINAL_REFERENCE,engraving:'A & B'},thumbnail};
 function request(path:string,body?:unknown,key=token){return library.handle(new Request(origin+'/api/model-admin/consumer/'+path,{headers:{Authorization:'Bearer '+key,Origin:origin,...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{method:'POST',body:JSON.stringify(body)}:{})}),path.split('/'));}
 return {store,objects,catalog,library,data,request};
}
it('isolates guest records, keeps revisions immutable and rejects stale edits',async()=>{
 const f=fixture();
 const saved=await (await f.request('designs',f.data)).json();
 expect(saved.check).toMatchObject({state:'manual',purchasable:false,revision:f.data.revision});
 expect(saved.check.issues.map((i:any)=>i.field)).toContain('engraving');
 expect(await (await f.request('designs')).json()).toHaveLength(1);
 expect(await (await f.request('designs',undefined,other)).json()).toEqual([]);
 await expect(f.request('designs/'+f.data.id+'/'+f.data.revision,undefined,other)).rejects.toMatchObject({status:404});
 expect((await (await f.request('designs',f.data)).json()).savedAt).toBe(saved.savedAt);
 await expect(f.request('designs',{...f.data,design:{...f.data.design,center:'ruby'}})).rejects.toMatchObject({status:409});
 const next={...f.data,revision:randomUUID(),expectedRevision:f.data.revision,design:{...f.data.design,center:'ruby'}};
 await f.request('designs',next);
 await expect(f.request('designs',{...next,revision:randomUUID(),expectedRevision:f.data.revision})).rejects.toMatchObject({status:409});
 expect((await (await f.request('designs/'+f.data.id+'/'+f.data.revision)).json()).design.center).toBe('diamond');
});
it('rejects hidden/stale parts, mismatched selections, invalid engraving and automatic pavé',async()=>{
 const f=fixture();
 await expect(f.request('check',{...f.data,head:{...f.data.head,revision:'stale'}})).rejects.toMatchObject({status:409});
 await expect(f.request('check',{...f.data,design:{...f.data.design,headId:'ring-floral'}})).rejects.toMatchObject({status:422});
 await expect(f.request('check',{...f.data,design:{...f.data.design,engraving:' 中文 '}})).rejects.toMatchObject({status:422});
 await expect(f.request('check',{...f.data,design:{...f.data.design,paveDiameter:200}})).rejects.toMatchObject({status:422});
 f.catalog.find(item=>item.id===f.data.head.id)!.listed=false;
 await expect(f.request('check',f.data)).rejects.toMatchObject({status:409});
});
it('submits a revision once, allows a later screenshot, tracks review and confirms only a valid formal quote',async()=>{
 const f=fixture();
 await f.request('designs',{...f.data,thumbnail:undefined});
 const path='designs/'+f.data.id+'/'+f.data.revision+'/submit';
 const submitted=await (await f.request(path,{thumbnail})).json();
 const retried=await (await f.request(path,{thumbnail})).json();
 expect(retried.id).toBe(submitted.id);expect((await f.library.requests()).length).toBe(1);
 expect(await (await f.request('requests',undefined,other)).json()).toEqual([]);
 await expect(f.request('requests/'+submitted.id+'/confirm',{expectedRevision:submitted.stateRevision})).rejects.toMatchObject({status:422});
 await expect(f.library.review(submitted.id,{expectedRevision:submitted.stateRevision,status:'quoted',reviewer:'测试复核员',note:'测试说明'})).rejects.toMatchObject({status:422});
 const attached=await (await f.library.adminFile(submitted.id,new Request(origin,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:submitted.stateRevision,reviewer:'测试复核员',name:'fixture.txt',base64:Buffer.from('test-only production fixture').toString('base64')})}),'file')).json();
 const quoted=await f.library.review(submitted.id,{expectedRevision:attached.stateRevision,status:'quoted',reviewer:'测试复核员',note:'仅用于自动化测试',manufacturingConfirmed:true,quote:{amount:2800,leadTime:'测试交期',productionRequirements:'测试工艺要求，非真实生产参数',lettering:{fontId:'test-font',fontVersion:'test-1',licenseEvidence:'test-only',position:'inner-band',alignment:'center',direction:'forward',heightMm:1,minHeightMm:.5,textWidthMm:3,areaWidthMm:5},validUntil:new Date(Date.now()+3600000).toISOString()}});
 await expect(f.request('requests/'+submitted.id+'/confirm',{expectedRevision:submitted.stateRevision})).rejects.toMatchObject({status:409});
 await expect(f.request('requests/'+submitted.id+'/confirm',{expectedRevision:quoted.stateRevision},other)).rejects.toMatchObject({status:404});
 const confirmed=await (await f.request('requests/'+submitted.id+'/confirm',{expectedRevision:quoted.stateRevision})).json();
 expect(confirmed.status).toBe('confirmed');expect(confirmed.design.revision).toBe(f.data.revision);
 expect(confirmed.history.map((h:any)=>h.status)).toEqual(['pending','pending','quoted','confirmed']);
 expect((await (await f.request('requests/'+submitted.id+'/confirm',{expectedRevision:quoted.stateRevision})).json()).confirmedAt).toBe(confirmed.confirmedAt);
 await expect(f.library.review(submitted.id,{expectedRevision:quoted.stateRevision,status:'declined',reviewer:'测试',note:'修改'})).rejects.toMatchObject({status:409});
 const next={...f.data,revision:randomUUID(),expectedRevision:f.data.revision,design:{...f.data.design,center:'ruby'}};
 await f.request('designs',next);
 const fresh=await (await f.request('designs/'+next.id+'/'+next.revision+'/submit',{thumbnail})).json();
 expect(fresh.id).not.toBe(submitted.id);expect(fresh.status).toBe('pending');expect(fresh.quote).toBeUndefined();
});
it('enforces the public origin and guest identity boundary and keeps admin review private',async()=>{
 const f=fixture();
 const password='test-only-admin-password-at-least-32-characters';
 const invoke=(path:string,headers:Record<string,string>,body?:unknown)=>cloudAdmin(new Request(origin+'/api/model-admin/'+path,{headers,...(body?{method:'POST',body:JSON.stringify(body)}:{})}),f.store,password);
 expect((await invoke('consumer/designs',{})).status).toBe(401);
 expect((await invoke('consumer/designs',{Origin:'https://other.invalid',Authorization:'Bearer '+token,'Content-Type':'application/json'},f.data)).status).toBe(403);
 expect((await invoke('consumer/designs',{Authorization:'Bearer '+token})).status).toBe(200);
 expect((await invoke('design-requests',{Authorization:'Bearer '+token})).status).toBe(401);
});

it('keeps required input incomplete, allows saving and refuses submission until supplied',async()=>{
 const f=fixture();f.catalog.find(item=>item.id===f.data.templateId)!.workflow={firstStep:'shank',requireSizeNote:true};
 expect((await (await f.request('check',f.data)).json()).state).toBe('incomplete');
 await f.request('designs',f.data);
 await expect(f.request('designs/'+f.data.id+'/'+f.data.revision+'/submit',{thumbnail})).rejects.toMatchObject({status:422});
 const next={...f.data,revision:randomUUID(),expectedRevision:f.data.revision,design:{...f.data.design,requestNote:'请协助确认尺寸'}};
 await f.request('designs',next);
 expect((await (await f.request('designs/'+next.id+'/'+next.revision+'/submit',{thumbnail})).json()).status).toBe('pending');
 await expect(f.request('designs',{...f.data,expectedRevision:next.revision})).rejects.toMatchObject({status:409});
});
it('keeps uploaded images private and rejects malformed image and JSON bodies',async()=>{
 const f=fixture();
 for(const image of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/jpeg;base64,/9j/2Q==', 'data:image/jpeg;base64,'+Buffer.from([255,216,...Array(16).fill(255),255,217]).toString('base64')]){
   await expect(f.request('images',{image})).rejects.toMatchObject({status:422});
 }
 await expect(f.request('images',null)).rejects.toMatchObject({status:400});
 const {readFile}=await import('node:fs/promises');
 const bytes=await readFile(new URL('../../public/media/diy/ring-starlight.jpg',import.meta.url));
 const image=await (await f.request('images',{image:'data:image/jpeg;base64,'+bytes.toString('base64')})).json();
 expect((await f.request('images/'+image.id)).headers.get('content-type')).toBe('image/jpeg');
 await expect(f.request('images/'+image.id,undefined,other)).rejects.toMatchObject({status:404});
 await expect(f.request('designs',{...f.data,design:{...f.data.design,image:{id:image.id,name:'sample.jpg',position:'inner-band'}}},other)).rejects.toMatchObject({status:422});
});
it('preserves the design when customers supply requested information and protects production files',async()=>{
 const f=fixture();await f.request('designs',f.data);
 const record=await (await f.request('designs/'+f.data.id+'/'+f.data.revision+'/submit',{thumbnail})).json();
 const needed=await f.library.review(record.id,{expectedRevision:record.stateRevision,status:'needs-information',reviewer:'测试人员',note:'请说明尺寸标准'});
 await expect(f.request('requests/'+record.id+'/reply',{expectedRevision:needed.stateRevision,note:'测试答复'},other)).rejects.toMatchObject({status:404});
 const reply=await (await f.request('requests/'+record.id+'/reply',{expectedRevision:needed.stateRevision,note:'请协助测量'})).json();
 expect(reply.design).toEqual(record.design);expect(reply.status).toBe('pending');expect(reply.history.at(-1).note).toBe('请协助测量');
 await expect(f.request('requests/'+record.id+'/reply',{expectedRevision:needed.stateRevision,note:'重复提交'})).rejects.toMatchObject({status:409});
 const upload=(name:string,expectedRevision:string)=>f.library.adminFile(record.id,new Request(origin,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision,reviewer:'测试人员',name,base64:Buffer.from('test-only').toString('base64')})}),'file');
 await expect(upload('unsafe.svg',reply.stateRevision)).rejects.toMatchObject({status:422});
 const attached=await (await upload('test.txt',reply.stateRevision)).json();
 expect(await (await f.request('requests/'+record.id+'/file')).text()).toBe('test-only');
 await expect(f.request('requests/'+record.id+'/file',undefined,other)).rejects.toMatchObject({status:404});
 const quote={amount:1000,leadTime:'test',productionRequirements:'test only',validUntil:new Date(Date.now()+3600000).toISOString(),lettering:{fontId:'test',fontVersion:'1',licenseEvidence:'test only',position:'inner-band',alignment:'center',direction:'forward',heightMm:1,minHeightMm:.5,textWidthMm:4,areaWidthMm:3}};
 await expect(f.library.review(record.id,{expectedRevision:attached.stateRevision,status:'quoted',reviewer:'测试人员',note:'test',manufacturingConfirmed:true,quote})).rejects.toMatchObject({status:422});
 const quoted=await f.library.review(record.id,{expectedRevision:attached.stateRevision,status:'quoted',reviewer:'测试人员',note:'test',manufacturingConfirmed:true,quote:{...quote,lettering:{...quote.lettering,areaWidthMm:5}}});
 await f.request('requests/'+record.id+'/confirm',{expectedRevision:quoted.stateRevision});
 await expect(upload('replacement.txt',quoted.stateRevision)).rejects.toMatchObject({status:409});
});
it('retries an interrupted pointer write without replacing an immutable design version',async()=>{
 const f=fixture(),put=f.store.put;let interrupt=true;
 f.store.put=async(key,...args)=>{if(key.endsWith('latest.json')&&interrupt){interrupt=false;throw new Error('simulated interrupted write');}return put(key,...args);};
 await expect(f.request('designs',f.data)).rejects.toThrow('simulated');
 expect(await (await f.request('designs')).json()).toEqual([]);
 const versionKey=[...f.objects.keys()].find(key=>key.endsWith(f.data.revision+'.json'))!;
 const before=f.objects.get(versionKey)!.etag;
 await f.request('designs',f.data);
 expect(f.objects.get(versionKey)!.etag).toBe(before);
 expect(await (await f.request('designs')).json()).toHaveLength(1);
});

it('refuses expired quotes and a new purchase after the selected part is delisted',async()=>{
 const f=fixture();const data={...f.data,design:{...f.data.design,engraving:''}};
 await f.request('designs',data);const record=await (await f.request('designs/'+data.id+'/'+data.revision+'/submit',{thumbnail})).json();
 const quoted=await f.library.review(record.id,{expectedRevision:record.stateRevision,status:'quoted',reviewer:'测试人员',note:'测试',manufacturingConfirmed:true,quote:{amount:1000,leadTime:'测试交期',productionRequirements:'仅测试',validUntil:new Date(Date.now()+3600000).toISOString()}});
 const key='studio/v1/consumer/requests/'+record.id+'.json';
 const stored=await (await f.store.get(key))!.json();
 await f.store.put(key,JSON.stringify({...stored,quote:{...stored.quote,validUntil:new Date(Date.now()-1000).toISOString()}}),'application/json');
 await expect(f.request('requests/'+record.id+'/confirm',{expectedRevision:quoted.stateRevision})).rejects.toThrow('过期');
 await f.store.put(key,JSON.stringify(stored),'application/json');
 f.catalog.find(item=>item.id===data.band.id)!.listed=false;
 await expect(f.request('requests/'+record.id+'/confirm',{expectedRevision:quoted.stateRevision})).rejects.toMatchObject({status:409});
 expect((await f.library.requests())[0].status).toBe('quoted');
});
