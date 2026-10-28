import {BoxGeometry,DoubleSide,Ray,Vector3} from 'three';
import {expect,it} from 'vitest';
import {bakeMetalOcclusion,createMountGeometry} from './mountGeometry';
it('keeps mount hits in world space and owns only its acceleration copy',()=>{
  const metal=new BoxGeometry(1,1,1);metal.translate(0,2,0);const mount=createMountGeometry([metal]);
  const hit=mount.tree.raycastFirst(new Ray(new Vector3(0,2,3),new Vector3(0,0,-1)),DoubleSide);
  expect(hit?.distance).toBeCloseTo(2.5);let disposed=0;metal.addEventListener('dispose',()=>disposed++);
  const ao=bakeMetalOcclusion(metal,mount.tree);expect([...ao].every(v=>Number.isFinite(v)&&v>=0.25&&v<=1)).toBe(true);
  expect([...ao].every(v=>v>0.99)).toBe(true);mount.dispose();mount.dispose();expect(disposed).toBe(0);metal.dispose();
});
it('detects nearby occluders rather than darkening every metal vertex',()=>{
  const base=new BoxGeometry(1,0.1,1),lid=new BoxGeometry(2,0.1,2);lid.translate(0,0.13,0);
  const mount=createMountGeometry([base,lid]),ao=bakeMetalOcclusion(base,mount.tree,0.2,16);
  const p=base.getAttribute('position'),n=base.getAttribute('normal');const top:number[]=[],bottom:number[]=[];
  for(let i=0;i<p.count;i++){if(n.getY(i)>0.9)top.push(ao[i]);if(n.getY(i)<-0.9)bottom.push(ao[i]);}
  expect(Math.min(...top)).toBeLessThan(0.8);expect(Math.min(...bottom)).toBeGreaterThan(0.99);mount.dispose();base.dispose();lid.dispose();
});
