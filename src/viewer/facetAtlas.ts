import {DataTexture,DoubleSide,FloatType,Ray,RGBAFormat,Vector3} from 'three';
import type {MeshBVH} from 'three-mesh-bvh';

// Map radial directions to actual facet planes. Nearest filtering keeps cuts sharp.
export function createFacetAtlas(tree:MeshBVH,center:Vector3,size:number,storeDistance=false){
  const data=new Float32Array(size*size*4),ray=new Ray(center.clone());
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let u=(x+.5)/size*2-1,v=(y+.5)/size*2-1;
    const z=1-Math.abs(u)-Math.abs(v);
    if(z<0){
      const prev=u;
      u=(1-Math.abs(v))*(u>=0?1:-1);
      v=(1-Math.abs(prev))*(v>=0?1:-1);
    }
    ray.direction.set(u,v,z).normalize();
    const hit=tree.raycastFirst(ray,DoubleSide);
    if(!hit?.face)continue;
    const n=hit.face.normal;
    const offset=(y*size+x)*4;
    n.toArray(data,offset);
    data[offset+3]=storeDistance?hit.distance:n.dot(ray.direction)*hit.distance;
  }
  const texture=new DataTexture(data,size,size,RGBAFormat,FloatType);
  texture.needsUpdate=true;
  return texture;
}
