// @vitest-environment node
import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import {cloudAdmin} from './cloud-admin.ts';
import type {CloudStore} from './cloud-store.ts';

it('serves only confirmed template revisions while keeping earlier releases readable',async()=>{
  const objects=new Map<string,{bytes:ArrayBuffer;type:string;etag:string}>();
  const store:CloudStore={
    async get(key){
      const object=objects.get(key);
      return object&&new Response(object.bytes,{headers:{'Content-Type':object.type,ETag:object.etag}});
    },
    async put(key,body,type,condition){
      if(condition&&(objects.get(key)?.etag??null)!==condition.etag)return false;
      const bytes=await new Response(body).arrayBuffer();
      objects.set(key,{bytes,type,etag:'"'+createHash('sha256').update(new Uint8Array(bytes)).digest('hex')+'"'});
      return true;
    },
    async list(prefix){return [...objects.keys()].filter(key=>key.startsWith(prefix));},
    async remove(key){objects.delete(key);},
    async sign(key){return 'https://bucket.invalid/'+key;},
  };
  const password='test-only-password-with-at-least-32-characters';
  const origin='https://studio.invalid';
  let cookie:string|undefined;
  function request(path:string,data?:object,authenticated=false){
    const headers=new Headers({Origin:origin});
    if(authenticated&&cookie)headers.set('Cookie',cookie);
    if(data)headers.set('Content-Type','application/json');
    return cloudAdmin(new Request(origin+'/api/model-admin/'+path,{headers,
      ...(data?{method:'POST',body:JSON.stringify(data)}:{})}),store,password);
  }
  expect((await request('library')).status).toBe(401);
  const login=await request('session',{password});
  expect(login.status).toBe(204);
  cookie=login.headers.get('Set-Cookie')!.split(';')[0];
  const selection={name:'新款',head:'ring-02',headStones:'ring-02',band:'ring-solstice',pave:''};
  const save=await request('templates',selection,true);
  expect(save.status).toBe(201);
  const draft=await save.json();
  const path=draft.id+'/'+draft.revision;
  expect((await request('templates/'+path)).status).toBe(401);
  expect((await request('templates/'+path,undefined,true)).status).toBe(200);
  await store.put('studio/v1/releases/'+path+'/template.json','{}','application/json');
  expect((await request('public/'+path+'/template.json')).status).toBe(404);
  await store.remove('studio/v1/releases/'+path+'/template.json');
  expect(await (await request('public/index.json')).json()).toEqual([]);
  const image='data:image/jpeg;base64,'+Buffer.from([0xff,0xd8,0xff,0xd9]).toString('base64');
  expect((await request('templates/'+path+'/publish',{image},true)).status).toBe(400);
  expect((await request('templates/'+path+'/publish',{confirmed:true,image},true)).status).toBe(201);
  expect((await request('public/'+path+'/cover.jpg')).status).toBe(302);
  expect((await request('public/'+path+'/original.obj')).status).toBe(404);
  const update=await request('templates',{...selection,id:draft.id,expectedRevision:draft.revision,name:'新版'},true);
  const next=await update.json();
  expect((await (await request('public/index.json')).json()).map((item:{revision:string})=>item.revision)).toEqual([draft.revision]);
  const nextPath=next.id+'/'+next.revision;
  expect((await request('public/'+nextPath+'/template.json')).status).toBe(404);
  expect((await request('templates/'+nextPath+'/publish',{confirmed:true,image},true)).status).toBe(201);
  expect((await (await request('public/index.json')).json()).map((item:{revision:string})=>item.revision)).toEqual([next.revision]);
  expect((await (await request('public/'+path+'/template.json')).json()).name).toBe('新款');
});
