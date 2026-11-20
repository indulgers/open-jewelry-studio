import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';

export const hostedAdminCookie='__Host-xiangyan-admin';
export const localAdminCookie='xiangyan-local-community-admin';
export const sameSecret=(a:string,b:string)=>timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
function signature(password:string,claims:string,name:string){
  const hmac=createHmac('sha256',password);
  // Retain the deployed cookie format, but isolate local privileges even if a
  // developer reuses the configured password between environments.
  if(name===localAdminCookie)hmac.update('local-community-session:');
  return hmac.update(claims).digest('base64url');
}
const lifetime=8*60*60;
export function adminSessionValid(request:Request,password:string,name=hostedAdminCookie){
  const session=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);
  const match=/^(\d{10,13}\.[0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/.exec(session??'');
  return !!match&&Number(match[1].split('.')[0])>Date.now()&&sameSecret(signature(password,match[1],name),match[2]);
}
export function adminSessionCookie(password:string,name=hostedAdminCookie){
  const claims=(Date.now()+lifetime*1000)+'.'+randomUUID();
  const scope=name===hostedAdminCookie?'Path=/; Secure':'Path=/api/model-admin/community';
  return name+'='+claims+'.'+signature(password,claims,name)+'; '+scope+'; Max-Age='+lifetime+'; HttpOnly; SameSite=Strict';
}
