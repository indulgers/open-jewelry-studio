export type Account = {name:string};
export type Work = {
  id:string; title:string; image:string; author:string; published:boolean; createdAt:string;
  templateId?:string; revision?:string; design?:object;
};
export type Order = {id:string; workId:string; title:string; status:string; createdAt:string};

export class CommunityAccountChanged extends Error {}

export async function communityRequest<T>(path:string, body?:object, signal?:AbortSignal,expectedReader?:string):Promise<T> {
  const response=await fetch('/api/model-admin/community/'+path,{
    method:body?'POST':'GET', credentials:'same-origin', cache:'no-store', signal,
    headers:{...(body && {'Content-Type':'application/json'}),...(expectedReader && {'X-Expected-Account':expectedReader})},
    ...(body && {body:JSON.stringify(body)}),
  });
  const result=await response.json().catch(()=>null);
  if(!response.ok && result?.code==='ACCOUNT_CHANGED')throw new CommunityAccountChanged(result.error);
  if(!response.ok || result===null)throw new Error(result?.error || '社区服务暂时不可用，请稍后重试。');
  return result as T;
}
export function errorText(error:unknown) {
  return error instanceof Error?error.message:'操作失败，请重试。';
}
