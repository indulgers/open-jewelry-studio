// @vitest-environment node
import {randomUUID} from 'node:crypto';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect,it} from 'vitest';
import {localCommunity} from './local-community.ts';

it('requires an independent admin login locally while keeping consumer sessions and drafts private',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'local-studio-'));
  try{
    const request=localCommunity(dir),origin='http://localhost:5173';
    const api=(path:string,body?:object,cookie='',site=origin)=>request(new Request(origin+'/api/model-admin/community/'+path,{
      method:body?'POST':'GET',headers:{origin:site,cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined,
    }),path);
    const customer=await api('register',{name:'customer',password:'regular-customer-password'});
    const userCookie=customer.headers.get('set-cookie')!.split(';')[0];
    expect((await api('admin/orders',undefined,userCookie)).status).toBe(401);
    expect((await api('local-admin-session',undefined,userCookie)).status).toBe(200);
    const info=await (await api('local-admin-session')).json();
    expect(info).toEqual({admin:false,generated:true});
    const file=join(dir,'community-admin-password');
    const password=(await readFile(file,'utf8')).trim();
    expect((await stat(file)).mode&0o777).toBe(0o600);
    expect((await api('local-admin-session',{password},'','http://another.invalid')).status).toBe(403);
    expect((await api('local-admin-session',{password:'regular-customer-password'},userCookie)).status).toBe(401);
    const login=await api('local-admin-session',{password});
    expect(login.status).toBe(200);
    const admin=login.headers.get('set-cookie')!.split(';')[0];
    expect(admin).not.toBe(userCookie);
    expect((await api('admin/orders',undefined,admin)).status).toBe(200);
    expect(await (await api('session',undefined,admin)).json()).toEqual({account:null});
    const image='data:image/jpeg;base64,'+(await readFile('public/media/diy/ring-floral.jpg')).toString('base64');
    const {id}=await (await api('admin/designs',{title:'后台草案',requestId:randomUUID(),image},admin)).json();
    expect((await api('works/'+id+'/image',undefined,userCookie)).status).toBe(404);
    expect((await api('works/'+id+'/image',undefined,admin)).status).toBe(200);
  }finally{await rm(dir,{recursive:true,force:true});}
});
