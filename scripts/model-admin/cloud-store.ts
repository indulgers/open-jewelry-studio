import {AwsClient} from 'aws4fetch';

const setting=(key:string)=>process.env['XIANGYAN_R2_'+key];

export function cloudStore(){
  const [account,bucket,accessKeyId,secretAccessKey]=['ACCOUNT_ID','BUCKET','ACCESS_KEY_ID','SECRET_ACCESS_KEY'].map(setting);
  if(!account||!bucket||!accessKeyId||!secretAccessKey)return;
  if(!/^[a-f0-9]{32}$/i.test(account)||!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket))throw new Error('R2 configuration invalid');
  const aws=new AwsClient({accessKeyId,secretAccessKey,service:'s3',region:'auto',retries:1});
  const bucketUrl='https://'+account+'.r2.cloudflarestorage.com/'+bucket;
  const url=(key:string)=>bucketUrl+'/'+key.split('/').map(encodeURIComponent).join('/');
  async function get(key:string,method='GET'){
    // Keep the strong object ETag for conditional writes; compression can weaken it.
    const response=await aws.fetch(url(key),{method,headers:{'Accept-Encoding':'identity'}});
    if(response.status===404)return undefined;
    if(!response.ok)throw new Error('R2 read failed');
    return response;
  }
  async function put(key:string,body:BodyInit,contentType:string,condition?:{etag:string|null}){
    const headers=new Headers({'content-type':contentType});
    if(condition)headers.set(condition.etag?'if-match':'if-none-match',condition.etag??'*');
    const response=await aws.fetch(url(key),{method:'PUT',body,headers});
    if(response.status===412&&condition)return false;
    if(!response.ok)throw new Error('R2 write failed');
    return true;
  }
  async function list(prefix:string){
    const keys:string[]=[];
    let token:string|undefined;
    do{
      const endpoint=new URL(bucketUrl);
      endpoint.searchParams.set('list-type','2');
      endpoint.searchParams.set('prefix',prefix);
      if(token)endpoint.searchParams.set('continuation-token',token);
      const response=await aws.fetch(endpoint);
      if(!response.ok)throw new Error('R2 list failed');
      const xml=await response.text();
      keys.push(...Array.from(xml.matchAll(/<Key>([^<]+)<\/Key>/g),match=>match[1]));
      token=/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml)?.[1]
        .replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>');
    }while(token);
    return keys;
  }
  async function sign(key:string,method:'GET'|'PUT'){
    const endpoint=new URL(url(key));
    endpoint.searchParams.set('X-Amz-Expires','300');
    const request=await aws.sign(endpoint,{method,aws:{signQuery:true,allHeaders:method==='PUT'},
      ...(method==='PUT'?{headers:{'content-type':'application/octet-stream'}}:{})});
    return request.url;
  }
  return {get,put,list,sign,async remove(key:string){
    const response=await aws.fetch(url(key),{method:'DELETE'});
    if(!response.ok&&response.status!==404)throw new Error('R2 delete failed');
  }};
}
export type CloudStore=NonNullable<ReturnType<typeof cloudStore>>;
