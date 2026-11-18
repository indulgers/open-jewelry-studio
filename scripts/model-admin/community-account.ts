import {randomBytes,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import type {CommunityStore} from './community-store.ts';
import {RequestError} from './templates.ts';

const derive=promisify(scrypt);
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export const communityRoot='studio/v1/community/';
export const fail=(status:number,message:string):never=>{throw new RequestError(status,message);};
export const reply=(data:unknown,status=200,headers?:Record<string,string>)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
export const getJson=async <T>(store:CommunityStore,key:string):Promise<T|undefined>=>(await store.get(communityRoot+key))?.json();
export const putJson=(store:CommunityStore,key:string,value:unknown,condition?:{etag:string|null})=>store.put(communityRoot+key,JSON.stringify(value),'application/json',condition);
export type Member={id:string;name:string};
type PasswordRecord=Member&{hash:string;salt:string};
const cookie='xiangyan-customer';
const tokenOf=(req:Request)=>req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookie+'='))?.slice(cookie.length+1);
const sessionMax=7*24*60*60;
const sessionCookie=(req:Request,value:string,seconds:number)=>cookie+'='+value+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+seconds+(new URL(req.url).protocol==='https:'?'; Secure':'');
export async function memberOf(req:Request,store:CommunityStore){
  const token=tokenOf(req);
  if(!token||!/^[0-9a-f]{64}$/.test(token))return;
  const sess=await getJson<{expires:number;member:Member}>(store,'sessions/'+digest(token));
  return sess&&sess.expires>Date.now()?sess.member:undefined;
}
async function countAttempt(store:CommunityStore,key:string){
  for(let i=0;i<5;i++){
    const old=await store.get(communityRoot+key);
    const record=old?await old.json() as {count:number;until:number}:undefined;
    const current=record&&record.until>Date.now()?record:{count:0,until:Date.now()+10*60_000};
    if(current.count>=12)return fail(429,'尝试次数过多，请十分钟后再试。');
    if(await putJson(store,key,{...current,count:current.count+1},{etag:old?.headers.get('etag')??null}))return;
  }
  return fail(429,'登录请求较多，请稍后再试。');
}
export async function accountAction(req:Request,store:CommunityStore,op:string,input:Record<string,unknown>){
  if(op==='logout'){
    const token=tokenOf(req);
    if(token&&/^[0-9a-f]{64}$/.test(token))await store.remove(communityRoot+'sessions/'+digest(token));
    return reply({account:null},200,{'Set-Cookie':sessionCookie(req,'',0)});
  }
  const {name,password}=input;
  if(typeof name!=='string'||!/^[a-z0-9_]{3,32}$/i.test(name)||typeof password!=='string'||password.length<10||password.length>128)
    return fail(422,'账号使用 3–32 位字母、数字或下划线，密码使用 10–128 个字符。');
  const key='accounts/'+digest(name.toLowerCase()),throttle='attempts/'+digest(name.toLowerCase());
  await countAttempt(store,throttle);
  let user=await getJson<PasswordRecord>(store,key);
  if(op==='register'){
    if(user)return fail(409,'该账号名已被使用。');
    const salt=randomBytes(16).toString('hex');
    user={id:randomBytes(16).toString('hex'),name,salt,hash:((await derive(password,salt,64)) as Buffer).toString('hex')};
    if(!await putJson(store,key,user,{etag:null}))return fail(409,'该账号名已被使用。');
  }else{
    const hash=(await derive(password,user?.salt??'unregistered-customer',64)) as Buffer;
    if(!user||!timingSafeEqual(hash,Buffer.from(user.hash,'hex')))return fail(401,'账号或密码不正确。');
  }
  const member={id:user.id,name:user.name};
  const token=randomBytes(32).toString('hex');
  await putJson(store,'sessions/'+digest(token),{member,expires:Date.now()+sessionMax*1000},{etag:null});
  await store.remove(communityRoot+throttle);
  return reply({account:{name:member.name}},op==='register'?201:200,{'Set-Cookie':sessionCookie(req,token,sessionMax)});
}
