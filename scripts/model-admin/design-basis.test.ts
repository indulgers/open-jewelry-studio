// @vitest-environment node
import {expect,it} from 'vitest';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {communityApi} from './community.ts';
import {localCommunityStore} from './community-store.ts';

it('freezes the published template and mixed component versions into an order before the source is republished',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'studio-frozen-basis-'));
  try{
    const store=localCommunityStore(dir),origin='https://studio.test';
    const api=(path:string,body?:object,cookie='',admin=false)=>communityApi(new Request(origin+'/api/model-admin/community/'+path,{
      method:body?'POST':'GET',headers:{origin,cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined,
    }),path,store,admin);
    const headId=crypto.randomUUID(),v1=crypto.randomUUID(),v2=crypto.randomUUID();
    const write=(key:string,value:object)=>store.put('studio/v1/'+key,JSON.stringify(value),'application/json');
    const release=async(revision:string,source:string,revisions:string[])=>{
      await write('releases/'+headId+'/'+revision+'/template.json',{id:headId,catalogId:'ring-floral',revision,headId:source,bandId:'ring-floral'});
      await write('published/'+headId+'.json',{current:{id:headId,revision},revisions});
    };
    const originalSource=crypto.randomUUID();
    await release(v1,originalSource,[v1]);
    const register=await api('register',{name:'basisbuyer',password:'basis-test-password'});
    const cookie=register.headers.get('set-cookie')!.split(';')[0];
    const image='data:image/jpeg;base64,'+(await readFile('public/media/diy/ring-floral.jpg')).toString('base64');
    const floral={id:headId,revision:v1},band={id:'ring-petal',revision:'ring-petal-source-1'};
    const expectedAccount='basisbuyer';
    const input={expectedAccount,requestId:crypto.randomUUID(),title:'混搭戒指',templateId:'ring-floral',revision:crypto.randomUUID(),design:{kind:'reference',center:'diamond',halo:'diamond',shoulder:'diamond',bandId:band.id,engraving:''},image,
      basis:{template:floral,head:floral,band}};
    expect((await api('designs',{...input,basis:{...input.basis,head:{id:headId,revision:v2}}},cookie)).status).toBe(422);
    expect((await api('designs',{...input,basis:{...input.basis,head:{id:'https://elsewhere.test/a.glb',revision:v1}}},cookie)).status).toBe(422);
    expect((await api('designs',{...input,basis:undefined},cookie)).status).toBe(422);
    const managed={...input,requestId:crypto.randomUUID(),design:{...input.design,headId:originalSource,bandId:'ring-floral'},
      basis:{template:floral,head:floral,band:floral}};
    expect((await api('designs',managed,cookie)).status).toBe(201);
    expect((await api('designs',{...managed,design:{...managed.design,headId:crypto.randomUUID()}},cookie)).status).toBe(422);
    const saved=await api('designs',input,cookie);expect(saved.status).toBe(201);
    const {id}=await saved.json();
    expect((await api('designs/'+id+'/publish',{expectedAccount},cookie)).status).toBe(200);
    await release(v2,crypto.randomUUID(),[v1,v2]);
    expect((await (await api('works')).json())[0]).not.toHaveProperty('basis');
    expect((await api('works/'+id+'/orders',{expectedAccount},cookie)).status).toBe(201);
    const expected={template:floral,head:{...floral,sourceId:originalSource},band:{...band,sourceId:band.id}};
    expect((await (await api('admin/orders',undefined,'',true)).json())[0].basis).toEqual(expected);
    expect((await (await api('orders',undefined,cookie)).json())[0].basis).toEqual(expected);
    expect((await (await api('mine',undefined,cookie)).json()).find((item:{id:string})=>item.id===id).basis).toEqual(expected);
  }finally{await rm(dir,{recursive:true,force:true});}
});
