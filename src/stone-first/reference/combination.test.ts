// @vitest-environment node
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {Box3,Matrix4,Vector3,type BufferGeometry} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {jewelryModelLoader} from '../../viewer/modelLoader';
import {RING_CATALOG} from '../catalog';
import {combineReferenceRings,prepareReferenceRing} from './model';

it('mounts each of the five heads on every original band finish',async()=>{
  const rings=await Promise.all(RING_CATALOG.map(async template=>{
    const bytes=Uint8Array.from(readFileSync('public'+template.model)).buffer;
    const {scene}=await jewelryModelLoader().parseAsync(bytes,'');
    return prepareReferenceRing(scene,template.id);
  }));
  const bvh=new Map<BufferGeometry,MeshBVH>();
  const failures:string[]=[];
  try{
    for(const head of rings)for(const band of rings){
      const ring=combineReferenceRings(head,band);
      const label=head.id+' × '+band.id;
      expect(ring.stones.filter(stone=>stone.zone!=='shoulder')).toHaveLength(head.stones.filter(stone=>stone.zone!=='shoulder').length);
      expect(ring.stones.filter(stone=>stone.zone==='shoulder')).toHaveLength(band.stones.filter(stone=>stone.zone==='shoulder').length);
      if(head===band)continue;
      const baskets=ring.metal.filter(part=>part.name.startsWith('head:'));
      const bandParts=ring.metal.filter(part=>!part.name.startsWith('head:'));
      const hit=(first:typeof ring.metal[number],second:typeof ring.metal[number],matrix:Matrix4)=>{
        if(!first.geometry.boundingBox!.intersectsBox(new Box3().copy(second.geometry.boundingBox!).applyMatrix4(matrix)))return false;
        for(const part of [first,second]){
          if(!bvh.has(part.geometry)){
            const tree=new MeshBVH(part.geometry);
            bvh.set(part.geometry,tree);
            Object.assign(part.geometry,{boundsTree:tree});
          }
        }
        return bvh.get(first.geometry)!.intersectsGeometry(second.geometry,matrix);
      };
      const offset=baskets[0].offsetY!;
      const translation=new Matrix4().makeTranslation(0,offset,0);
      const mounted=baskets.some(basket=>bandParts.some(part=>hit(part,basket,translation)));
      const headCollision=ring.stones.filter(stone=>stone.zone!=='shoulder')
        .some(stone=>bandParts.some(part=>hit(part,stone,stone.matrix)));
      const shoulderCollision=ring.stones.filter(stone=>stone.zone==='shoulder')
        .some(stone=>baskets.some(part=>hit(stone,part,translation)));
      const frame=ring.frames.overall;
      expect(new Vector3(...frame.target).toArray().every(Number.isFinite),label).toBe(true);
      if(!mounted||headCollision||shoulderCollision)failures.push(label+JSON.stringify({mounted,headCollision,shoulderCollision}));
    }
    expect(failures).toEqual([]);
  }finally{rings.forEach(ring=>ring.dispose());}
});
