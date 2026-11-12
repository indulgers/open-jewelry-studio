// @vitest-environment node
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {Box3,Matrix4,Vector3,type BufferGeometry} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {jewelryModelLoader} from '../../viewer/modelLoader';
import {RING_CATALOG} from '../catalog';
import {combineReferenceRings,prepareReferenceRing} from './model';
import {applyReferencePave} from './pave';
import {PAVE_DIAMETERS,PAVE_LENGTHS} from './pave-options';

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

it('repacks shoulders when diameter or length changes without resetting framing',async()=>{
  const template=RING_CATALOG.find(ring=>ring.id==='ring-petal')!;
  const bytes=Uint8Array.from(readFileSync('public'+template.model)).buffer;
  const {scene}=await jewelryModelLoader().parseAsync(bytes,'');
  const source=prepareReferenceRing(scene,template.id);
  try{
    const stock=combineReferenceRings(source,source);
    const smaller=applyReferencePave(stock,source,80,100);
    const shorter=applyReferencePave(stock,source,80,70);
    const larger=applyReferencePave(stock,source,100,70);
    expect(applyReferencePave(stock,source,100,100).stones).toBe(source.stones);
    expect(smaller.pave!.count).toBeGreaterThan(shorter.pave!.count);
    expect(shorter.pave!.count).toBeGreaterThan(larger.pave!.count);
    expect(shorter.pave!.minGap).toBeGreaterThan(0);
    expect(shorter.frames).toBe(source.frames);
  }finally{source.dispose();}
});

it('keeps regenerated shoulder stones clear of the shank, head and other stones',async()=>{
  const rings=await Promise.all(RING_CATALOG.map(async template=>{
    const bytes=Uint8Array.from(readFileSync('public'+template.model)).buffer;
    const {scene}=await jewelryModelLoader().parseAsync(bytes,'');
    return prepareReferenceRing(scene,template.id);
  }));
  const trees=new Map<BufferGeometry,MeshBVH>();
  const options={indirect:true,setBoundingBox:false};
  const failures:string[]=[];
  const inverse=new Matrix4(),relative=new Matrix4(),bounds=new Box3(),otherBounds=new Box3();
  type Ring=ReturnType<typeof applyReferencePave>;
  const hits=(gem:Ring['stones'][number],geometry:BufferGeometry,matrix:Matrix4)=>{
    bounds.copy(gem.geometry.boundingBox!).applyMatrix4(gem.matrix);
    otherBounds.copy(geometry.boundingBox!).applyMatrix4(matrix);
    if(!bounds.intersectsBox(otherBounds))return false;
    for(const item of [gem.geometry,geometry]){
      if(trees.has(item))continue;
      const tree=new MeshBVH(item,options);
      trees.set(item,tree);
      Object.assign(item,{boundsTree:tree});
    }
    inverse.copy(gem.matrix).invert();
    return trees.get(gem.geometry)!.intersectsGeometry(geometry,relative.multiplyMatrices(inverse,matrix));
  };
  try{
    for(const band of rings.filter(ring=>ring.stones.some(stone=>stone.zone==='shoulder')))for(const head of rings){
      const stock=combineReferenceRings(head,band);
      for(const diameter of PAVE_DIAMETERS)for(const length of PAVE_LENGTHS){
        if(diameter===100&&length===100)continue;
        const ring=applyReferencePave(stock,band,diameter,length);
        const shoulders=ring.stones.filter(stone=>stone.zone==='shoulder');
        const rowCounts=new Map<string,number>();
        for(const stone of shoulders){
          const row=stone.name.split('_')[3];
          rowCounts.set(row,(rowCounts.get(row)??0)+1);
        }
        expect(rowCounts.size).toBe(band.id==='ring-crown'?4:2);
        expect(new Set(rowCounts.values()).size).toBe(1);
        expect(ring.pave!.count).toBe(shoulders.length);
        const retained=ring.metal.filter(part=>part.name!=='metal_pave_seats');
        const seats=ring.metal.find(part=>part.name==='metal_pave_seats')!;
        const transform=new Matrix4();
        const seatsHitHead=ring.stones.filter(stone=>stone.zone!=='shoulder').some(stone=>hits(stone,seats.geometry,transform));
        if(seatsHitHead)failures.push([head.id,band.id,diameter,length,'seat touches head gem'].join(' '));
        for(const gem of shoulders){
          const metal=retained.find(part=>hits(gem,part.geometry,transform.makeTranslation(0,part.offsetY??0,0)));
          const stone=ring.stones.find(other=>other!==gem&&hits(gem,other.geometry,other.matrix));
          if(metal||stone){
            failures.push([head.id,band.id,diameter,length,gem.name,metal?.name,stone?.name].join(' '));
            break;
          }
        }
      }
    }
    expect(failures).toEqual([]);
  }finally{rings.forEach(ring=>ring.dispose());}
},15000);
