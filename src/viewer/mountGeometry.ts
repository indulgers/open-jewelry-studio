import {BufferGeometry,DoubleSide,Float32BufferAttribute,Ray,Vector3} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH,MeshBVHUniformStruct,SAH} from 'three-mesh-bvh';

/** Static world-space metal only. Shared by all stones, never rebuilt for camera/finish changes. */
export function createMountGeometry(sources:BufferGeometry[]){
  const copies=sources.map(source=>{const copy=source.clone();for(const key of Object.keys(copy.attributes))if(key!=='position')copy.deleteAttribute(key);copy.clearGroups();return copy;});
  const geometry=mergeGeometries(copies,false);copies.forEach(g=>g.dispose());
  if(!geometry)throw new Error('Cannot combine metal geometry');
  const tree=new MeshBVH(geometry,{strategy:SAH}),bvh=new MeshBVHUniformStruct();bvh.updateFrom(tree);
  let disposed=false;return {tree,bvh,dispose(){if(disposed)return;disposed=true;bvh.dispose();geometry.dispose();}};
}

/** Small local hemisphere bake. This is indirect metal self-occlusion, not a shadow on the gem. */
export function bakeMetalOcclusion(geometry:BufferGeometry,tree:MeshBVH,radius=0.12,samples=12){
  const p=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');
  const data=new Float32Array(p.count).fill(1);if(!normals)return data;
  const point=new Vector3(),normal=new Vector3(),tangent=new Vector3(),bitangent=new Vector3(),ray=new Ray();
  const up=new Vector3(0,1,0),right=new Vector3(1,0,0),cache=new Map<string,number>();
  for(let i=0;i<p.count;i++){
    point.fromBufferAttribute(p,i);normal.fromBufferAttribute(normals,i).normalize();
    const key=[...point.toArray(),...normal.toArray()].map(v=>Math.round(v*1e5)).join('/');
    const previous=cache.get(key);if(previous!==undefined){data[i]=previous;continue;}
    tangent.crossVectors(Math.abs(normal.y)<0.9?up:right,normal).normalize();bitangent.crossVectors(normal,tangent);
    ray.origin.copy(point).addScaledVector(normal,0.0008);let blocked=0;
    for(let s=0;s<samples;s++){
      const r=Math.sqrt((s+0.5)/samples),phi=s*2.399963229728653;
      ray.direction.copy(tangent).multiplyScalar(r*Math.cos(phi)).addScaledVector(bitangent,r*Math.sin(phi)).addScaledVector(normal,Math.sqrt(1-r*r)).normalize();
      const hit=tree.raycastFirst(ray,DoubleSide,0.001,radius);
      if(hit)blocked+=1-hit.distance/radius;
    }
    const ao=Math.max(0.25,1-blocked/samples);data[i]=ao;cache.set(key,ao);
  }
  geometry.setAttribute('localOcclusion',new Float32BufferAttribute(data,1));return data;
}
