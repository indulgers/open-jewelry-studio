import {describe,it,expect} from 'vitest';
import {Mesh,MeshBasicMaterial,Raycaster,DoubleSide,Vector3} from 'three';
import {buildStoneLayout,recipeDesign} from '../recipe';
import {metalSetting} from '../geometry';
import {solidPetalGeometry} from './fusionInput';

describe('micro pavé support contact geometry',()=>{
 it('locates the gold directly beneath each small bead, not at the stone-center height',()=>{
  const d=recipeDesign('floral-pave'),sites=buildStoneLayout(d);
  const site=sites.find(s=>s.zone==='petal'&&s.leaf===0);
  expect(site).toBeDefined();
  const surface=solidPetalGeometry(d,0);
  const material=new MeshBasicMaterial({side:DoubleSide});
  const mesh=new Mesh(surface,material);
  mesh.updateMatrixWorld(true);
  const parts=metalSetting(d,site!).filter(p=>p.name.startsWith('pave-anchored-bead'));
  const values:{name:string;hitCount:number;beadY:number;goldY:number|null;beadX:number;beadZ:number;penetration:number|null}[]=[];
  try{
   for(const part of parts){
    part.geometry.computeBoundingSphere();
    const c=part.geometry.boundingSphere!.center.clone();
    c.add(new Vector3(site!.x,site!.y,site!.z));
    const ray=new Raycaster(c.clone().add(new Vector3(0,2,0)),new Vector3(0,-1,0));
    const hits=ray.intersectObject(mesh,false);
    const goldY=hits[0]?.point.y??null;
    values.push({name:part.name,hitCount:hits.length,beadY:c.y,goldY,beadX:c.x,beadZ:c.z,
      penetration:goldY===null?null:goldY-(c.y-part.geometry.boundingSphere!.radius)});
   }

   expect(parts).toHaveLength(4);
   expect(values.every(v=>v.hitCount>0)).toBe(true);
   expect(values.every(v=>v.penetration!==null&&v.penetration>0)).toBe(true);
  }finally{parts.forEach(p=>p.geometry.dispose());surface.dispose();material.dispose();}
 });
});
