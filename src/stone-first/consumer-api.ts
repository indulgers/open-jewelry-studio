const KEY='xiangyan:guest-recovery';
export class ConsumerError extends Error{constructor(public status:number,message:string){super(message);}}
export function guestToken(){
  let token=localStorage.getItem(KEY);
  if(!token){token=Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');localStorage.setItem(KEY,token);}
  if(!/^[a-f0-9]{64}$/.test(token))throw new Error('游客恢复码无效，请在「我的方案」重新输入。');
  return token;
}
export const recoveryCode=()=> 'XY-'+guestToken();
export function restoreGuest(code:string){
  const token=code.trim().replace(/^XY-/i,'').toLowerCase();
  if(!/^[a-f0-9]{64}$/.test(token))throw new Error('请输入完整的 XY- 恢复码。');
  localStorage.setItem(KEY,token);
}
export async function consumerRequest<T>(path:string,data?:unknown,signal?:AbortSignal):Promise<T>{
  const response=await fetch('/api/model-admin/consumer/'+path,{signal,headers:{Authorization:'Bearer '+guestToken(),...(data!==undefined?{'Content-Type':'application/json'}:{})},...(data!==undefined?{method:'POST',body:JSON.stringify(data)}:{})});
  const value=await response.json().catch(()=>undefined);
  if(!response.ok)throw new ConsumerError(response.status,value?.error??'方案服务暂不可用，请稍后重试。');
  return value;
}

export async function downloadProduction(id:string,name:string){
  const response=await fetch('/api/model-admin/consumer/requests/'+id+'/file',{headers:{Authorization:'Bearer '+guestToken()}});
  if(!response.ok)throw new Error('生产文件暂不可用，请稍后重试。');
  const url=URL.createObjectURL(await response.blob());
  const link=document.createElement('a');link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
