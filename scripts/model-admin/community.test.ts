// @vitest-environment node
import {expect,it} from 'vitest';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {cloudAdmin} from './cloud-admin.ts';
import {communityApi} from './community.ts';
import {localCommunityStore} from './community-store.ts';

it('keeps drafts private and freezes idempotent orders across withdrawal',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'studio-community-'));
  try{
    const store=localCommunityStore(dir);
    const origin='http://localhost';
    const api=(path:string,data?:object,cookie='',admin=false)=>communityApi(new Request(origin+'/api/model-admin/community/'+path,{
      method:data?'POST':'GET',headers:{origin,cookie,'content-type':'application/json'},body:data?JSON.stringify(data):undefined,
    }),path,store,admin);
    const register=async(name:string)=>{
      const res=await api('register',{name,password:'story-test-12345'});
      expect(res.status).toBe(201);return res.headers.get('set-cookie')!.split(';')[0];
    };
    const author=await register('designer01'),buyer=await register('customer02');
    expect(await (await api('session',undefined,author)).json()).toEqual({account:{name:'designer01'}});
    expect((await api('login',{name:'designer01',password:'wrong-password'})).status).toBe(401);
    const image='data:image/jpeg;base64,'+(await readFile('public/media/diy/ring-floral.jpg')).toString('base64');
    const input={title:'花环',image,revision:'ring-floral-source-1',templateId:'ring-floral',
      design:{kind:'reference',center:'diamond',halo:'diamond',shoulder:'diamond',engraving:'PERSONAL'}};
    const res=await api('designs',input,author);expect(res.status).toBe(201);
    const {id}=await res.json();
    expect(await (await api('works')).json()).toEqual([]);
    expect((await api('works/'+id+'/image')).status).toBe(404);
    expect((await api('works/'+id+'/image',undefined,author)).status).toBe(200);
    expect((await api('designs/'+id+'/publish',{},buyer)).status).toBe(404);
    expect((await api('designs/'+id+'/publish',{},author)).status).toBe(200);
    const works=await (await api('works')).json();
    expect(works[0]).toMatchObject({title:'花环',published:true});
    expect(works[0]).not.toHaveProperty('design');
    expect(JSON.stringify(works)).not.toContain('designer01');
    expect((await api('works/'+id+'/orders',{})).status).toBe(401);
    const [first,retry]=await Promise.all([api('works/'+id+'/orders',{},buyer),api('works/'+id+'/orders',{},buyer)]);
    const receipt=await first.json();expect(receipt.status).toBe('待人工核价');expect((await retry.json()).id).toBe(receipt.id);
    expect((await api('admin/orders',undefined,buyer)).status).toBe(401);
    const orders=await (await api('admin/orders',undefined,'',true)).json();
    expect(orders).toHaveLength(1);expect(JSON.stringify(orders)).not.toContain('PERSONAL');
    const receiptPath=orders[0].image.replace('/api/model-admin/community/','').replace('/image','/status');
    expect((await api(receiptPath,{expected:'待人工核价',status:'已受理'},buyer)).status).toBe(401);
    expect((await api(receiptPath,{expected:'待人工核价',status:'已受理'},'',true)).status).toBe(200);
    expect((await api(receiptPath,{expected:'待人工核价',status:'已关闭'},'',true)).status).toBe(409);
    expect(await (await api('orders',undefined,buyer)).json()).toMatchObject([{status:'已受理'}]);
    expect((await api('designs/'+id+'/unpublish',{},author)).status).toBe(200);
    expect(await (await api('works')).json()).toEqual([]);
    expect((await api('works/'+id+'/image')).status).toBe(404);
    expect((await api('orders/'+receipt.id+'/image',undefined,buyer)).status).toBe(200);
    expect((await api('orders/'+receipt.id+'/image',undefined,author)).status).toBe(404);
    expect(await (await api('orders',undefined,buyer)).json()).toHaveLength(1);
    expect((await api('admin/designs',input,'',true)).status).toBe(201);
    expect((await api('logout',{},author)).status).toBe(200);
    expect(await (await api('session',undefined,author)).json()).toEqual({account:null});
  }finally{await rm(dir,{recursive:true,force:true});}
});

it('routes hosted admin uploads through the existing admin session and strips JPEG metadata',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'studio-community-cloud-'));
  try {
    const store={...localCommunityStore(dir),async sign(){return '';}};
    const origin='https://studio.invalid',password='community-test-password-long-enough-for-admin';
    const request=(path:string,body?:object,cookie='',otherOrigin=origin)=>cloudAdmin(new Request(origin+'/api/jewelry-admin?path='+path,{
      method:body?'POST':'GET',headers:{origin:otherOrigin,cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined,
    }),store,password);
    const login=await request('session',{password}),admin=login.headers.get('set-cookie')!.split(';')[0];
    const bytes=await readFile('public/media/diy/ring-floral.jpg');
    const payload=Buffer.from('GPS-should-not-ship'),marker=Buffer.from([0xff,0xe1,0,payload.length+2]);
    const jpeg=Buffer.concat([bytes.subarray(0,2),marker,payload,bytes.subarray(2)]);
    const input={title:'圆戒',image:'data:image/jpeg;base64,'+jpeg.toString('base64')};
    expect((await request('community/admin/designs',input)).status).toBe(401);
    expect((await request('community/admin/designs',input,admin,'https://elsewhere.invalid')).status).toBe(403);
    const saved=await request('community/admin/designs',input,admin);
    expect(saved.status).toBe(201);
    const {id}=await saved.json();
    expect((await request('community/works/'+id+'/image')).status).toBe(404);
    expect((await request('community/admin/designs/'+id+'/publish',{},admin)).status).toBe(200);
    expect(await (await request('community/works')).json()).toMatchObject([{id,author:'相言工作室'}]);
    const served=await request('community/works/'+id+'/image');
    expect( served.headers.get('content-type')).toBe('image/jpeg');
    expect(Buffer.from(await served.arrayBuffer()).includes(payload)).toBe(false);
    expect((await request('community/admin/designs',{...input,image:'data:image/jpeg;base64,MTIzNA=='},admin)).status).toBe(422);
  }finally{await rm(dir,{recursive:true,force:true});}
});
