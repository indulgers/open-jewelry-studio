import {BufferAttribute,BufferGeometry,Float32BufferAttribute} from 'three';
import {MeshBVH,MeshBVHUniformStruct,type SerializedBVH} from 'three-mesh-bvh';
import {bakeMetalOcclusion,createMountGeometry} from './mountGeometry';

export type MetalInput={position:Float32Array;normal:Float32Array|null;index:Uint32Array|null};
export type MountData={position:Float32Array;tree:SerializedBVH;occlusion:Float32Array[]};

// Transfer copies: the render geometry must never be detached by a worker message.
export function packMetal(geometry:BufferGeometry):MetalInput{
  const copy=(name:string)=>{
    const attribute=geometry.getAttribute(name);if(!attribute)return null;
    const array=new Float32Array(attribute.count*3);
    for(let i=0;i<attribute.count;i++){array[i*3]=attribute.getX(i);array[i*3+1]=attribute.getY(i);array[i*3+2]=attribute.getZ(i)}
    return array;
  };
  const index=geometry.getIndex();
  return {position:copy('position')!,normal:copy('normal'),index:index?Uint32Array.from(index.array):null};
}

/** Runs in the worker, with the same SAH tree and six-ray bake as the original path. */
export function buildMountData(inputs:MetalInput[]):MountData{
  const sources=inputs.map(input=>{
    const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(input.position,3));
    if(input.normal)geometry.setAttribute('normal',new BufferAttribute(input.normal,3));
    if(input.index)geometry.setIndex(new BufferAttribute(input.index,1));
    return geometry;
  });
  let mount:ReturnType<typeof createMountGeometry>|undefined;
  try{
    mount=createMountGeometry(sources);
    return {position:mount.tree.geometry.getAttribute('position').array as Float32Array,
      tree:MeshBVH.serialize(mount.tree,{cloneBuffers:false}),
      occlusion:sources.map(source=>bakeMetalOcclusion(source,mount!.tree,.14,6))};
  }finally{mount?.dispose();sources.forEach(source=>source.dispose())}
}

export function restoreMountData(data:MountData,sources:BufferGeometry[]){
  const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(data.position,3));
  const tree=MeshBVH.deserialize(data.tree,geometry),bvh=new MeshBVHUniformStruct();
  try{
    bvh.updateFrom(tree);
    sources.forEach((source,index)=>source.setAttribute('localOcclusion',new Float32BufferAttribute(data.occlusion[index],1)));
  }catch(error){bvh.dispose();geometry.dispose();throw error}
  let disposed=false;
  return {tree,bvh,dispose(){if(disposed)return;disposed=true;bvh.dispose();geometry.dispose()}};
}
