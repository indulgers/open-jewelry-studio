import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {adminSessionCookie,adminSessionValid,localAdminCookie,sameSecret} from './admin-session.ts';
import {communityApi,inputOf} from './community.ts';
import {reply} from './community-account.ts';
import {localCommunityStore} from './community-store.ts';
import {RequestError} from './templates.ts';

export function localCommunity(directory:string,configuredPassword?:string){
  const store=localCommunityStore(join(directory,'community'));
  function password(){
    if(configuredPassword)return configuredPassword;
    const path=join(directory,'community-admin-password');
    try{return readFileSync(path,'utf8').trim();}
    catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
    const initial=randomBytes(32).toString('base64url');
    try{writeFileSync(path,initial+'\n',{mode:0o600,flag:'wx'});return initial;}
    catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;return readFileSync(path,'utf8').trim();}
  }
  return async(req:Request,path:string)=>{
    const gate=path==='local-admin-session';
    const signed=req.headers.get('cookie')?.split(';').some(c=>c.trim().startsWith(localAdminCookie+'='));
    if(!gate&&!signed)return communityApi(req,path,store,false);
    try{
      const secret=password();
      if(secret.length<32)return reply({error:'本机社区管理员口令至少需要 32 个字符。'},503);
      const admin=adminSessionValid(req,secret,localAdminCookie);
      if(!gate)return communityApi(req,path,store,admin);
      if(req.method==='GET')return reply({admin,generated:!configuredPassword});
      if(req.method!=='POST')return reply({error:'请求方法无效。'},405);
      if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'请从本站后台操作。'},403);
      const input=await inputOf(req,4096);
      if(typeof input.password!=='string'||!sameSecret(secret,input.password))return reply({error:'管理员口令不正确。'},401);
      return reply({admin:true},200,{'Set-Cookie':adminSessionCookie(secret,localAdminCookie)});
    }catch(e){
      if(e instanceof RequestError)return reply({error:e.message},e.status);
      return reply({error:'无法读取本机社区管理员口令。'},503);
    }
  };
}
