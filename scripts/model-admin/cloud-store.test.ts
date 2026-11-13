// @vitest-environment node
import {expect,it,vi} from 'vitest';
import {cloudStore} from './cloud-store';

it('preserves a strong object ETag for compare-and-swap writes',async()=>{
  for(const [key,value] of Object.entries({ACCOUNT_ID:'a'.repeat(32),BUCKET:'test-bucket',ACCESS_KEY_ID:'test',SECRET_ACCESS_KEY:'test'})){
    vi.stubEnv('XIANGYAN_R2_'+key,value);
  }
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
    const request=input as Request;
    if(request.method==='GET')return new Response('{}',{headers:{ETag:request.headers.get('accept-encoding')==='identity'?'"object-version"':'W/"object-version"'}});
    return new Response(null,{status:request.headers.get('if-match')==='"object-version"'?200:412});
  }));
  try{
    const store=cloudStore()!;
    const prior=await store.get('draft.json');
    expect(await store.put('draft.json','{}','application/json',{etag:prior!.headers.get('etag')})).toBe(true);
    expect(await store.put('draft.json','{}','application/json',{etag:'"stale-version"'})).toBe(false);
  }finally{vi.unstubAllGlobals();vi.unstubAllEnvs();}
});
