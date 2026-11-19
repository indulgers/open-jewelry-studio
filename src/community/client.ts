import type {DesignBasis} from './design-basis';
import type {OrderQuote,OrderStatus} from './order-quote';
export type Account = {name:string};
export type Work = {
  id:string; title:string; image:string; author:string; published:boolean; createdAt:string;
  templateId?:string; revision?:string; design?:object; basis?:DesignBasis; details?:{label:string;value:string}[];
};
export type Order = {
  id:string; workId:string; title:string; status:OrderStatus; templateId?:string; basis?:DesignBasis; createdAt:string;
  quote?:OrderQuote; orderedAt?:string;
};

export function quoteAmount(quote:OrderQuote){
  return new Intl.NumberFormat('zh-CN',{style:'currency',currency:quote.currency}).format(quote.amountFen/100);
}

export const CUSTOMER_SESSION_CHANGED='xiangyan:consumer-session-change';
export function notifyLocalAccountChange(){
  window.dispatchEvent(new Event(CUSTOMER_SESSION_CHANGED));
}
export class CommunityAccountChanged extends Error {}
export class CommunityRequestError extends Error {
  constructor(message:string,readonly status:number){super(message);}
}

export async function communityRequest<T>(path:string, body?:object, signal?:AbortSignal,expectedReader?:string,deferLocalAccountNotice=false):Promise<T> {
  const response=await fetch('/api/model-admin/community/'+path,{
    method:body?'POST':'GET', credentials:'same-origin', cache:'no-store', signal,
    headers:{...(body && {'Content-Type':'application/json'}),...(expectedReader && {'X-Expected-Account':expectedReader})},
    ...(body && {body:JSON.stringify(body)}),
  });
  const result=await response.json().catch(()=>null);
  if(!response.ok && result?.code==='ACCOUNT_CHANGED')throw new CommunityAccountChanged(result.error);
  if(!response.ok || result===null)throw new CommunityRequestError(result?.error || '社区服务暂时不可用，请稍后重试。',response.status);
  if(body&&['register','login','logout'].includes(path)){
    // Storage events reach the other windows without persisting customer identity.
    try{localStorage.setItem(CUSTOMER_SESSION_CHANGED,crypto.randomUUID());}catch{/* Same-tab notification still works. */}
    if(!deferLocalAccountNotice)notifyLocalAccountChange();
  }
  return result as T;
}
export function errorText(error:unknown) {
  return error instanceof Error?error.message:'操作失败，请重试。';
}
