import type {BufferGeometry} from 'three';
import {packMetal,type MountData} from './mountPreparationData';

// Each loaded finished-ring source has one fixed normalization; reuse completed CPU data.
const completed=new WeakMap<object,MountData>();
export function prepareMount(source:object,geometries:BufferGeometry[]){
  const cached=completed.get(source);
  if(cached)return {result:Promise.resolve(cached),cancel(){}};
  let worker:Worker|undefined,settled=false,rejectJob:(error:Error)=>void=()=>{};
  const result=new Promise<MountData>((resolve,reject)=>{
    rejectJob=reject;
    worker=new Worker(new URL('./mountPreparation.worker.ts',import.meta.url),{type:'module'});
    worker.onmessage=(event:MessageEvent<{type:'ready';data:MountData}|{type:'error';message:string}>)=>{
      if(settled)return;settled=true;worker!.terminate();
      if(event.data.type==='ready'){completed.set(source,event.data.data);resolve(event.data.data)}
      else reject(new Error(event.data.message));
    };
    worker.onerror=()=>{if(settled)return;settled=true;worker!.terminate();reject(new Error('戒托准备失败，请重新加载模型。'))};
    const inputs=geometries.map(packMetal);
    worker.postMessage(inputs,inputs.flatMap(input=>[input.position.buffer,...(input.normal?[input.normal.buffer]:[]),...(input.index?[input.index.buffer]:[])]) as ArrayBuffer[]);
  });
  return {result,cancel(){if(settled)return;settled=true;worker?.terminate();rejectJob(new Error('戒托准备已取消'))}};
}
