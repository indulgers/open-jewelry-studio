import {buildMountData,type MetalInput} from './mountPreparationData';
self.onmessage=(event:MessageEvent<MetalInput[]>)=>{
  try{
    const data=buildMountData(event.data);
    const transfer=[data.position.buffer,data.tree.index.buffer,...data.tree.roots,...data.occlusion.map(a=>a.buffer)] as ArrayBuffer[];
    self.postMessage({type:'ready',data},{transfer});
  }catch(error){self.postMessage({type:'error',message:error instanceof Error?error.message:'无法准备戒托'})}
};
