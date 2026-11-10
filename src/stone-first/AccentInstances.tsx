import {useCallback} from 'react';
import {Euler,InstancedMesh,Matrix4,Quaternion,Vector3,type BufferGeometry} from 'three';
import type {Site} from './recipe';

/** Bind transforms to the actual R3F mesh mount, not to its parent's async
 * CSG effect. A newly constructed InstancedMesh contains identity transforms;
 * drawing it even once renders normalized 20 mm stones at the ring origin. */
export function AccentInstances({geometry,sites}:{geometry:BufferGeometry;sites:Site[]}){
 const attach=useCallback((mesh:InstancedMesh|null)=>{
  if(!mesh)return;
  mesh.count=0;
  const matrix=new Matrix4(),p=new Vector3(),q=new Quaternion(),s=new Vector3();
  for(let i=0;i<sites.length;i++){
   const site=sites[i];
   if(![site.x,site.y,site.z,site.tilt,site.diameter].every(Number.isFinite)||site.diameter<=0)
    throw new Error('Invalid accent gemstone transform: '+site.id);
   p.set(site.x,site.y,site.z);
   q.setFromEuler(new Euler(0,0,-site.tilt));
   s.setScalar(site.diameter/2);
   mesh.setMatrixAt(i,matrix.compose(p,q,s));
  }
  mesh.count=sites.length;
  mesh.instanceMatrix.needsUpdate=true;
  mesh.computeBoundingBox();mesh.computeBoundingSphere();
 },[geometry,sites]);
 return <instancedMesh name="accent-gems" ref={attach} args={[geometry,undefined,sites.length]} dispose={null}>
   <meshPhysicalMaterial color="#f6f8fc" metalness={0} roughness={0.015} transmission={0.93} thickness={0.5} ior={2.42} envMapIntensity={2.1}/>
 </instancedMesh>;
}
