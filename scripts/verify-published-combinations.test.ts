// @vitest-environment node
import {readFileSync,writeFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {Box3,Matrix4} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {createReferenceLibrary} from '../src/stone-first/reference/part-library';
import {applyReferencePave} from '../src/stone-first/reference/pave';
const folder=process.env.JEWELRY_PART_FIXTURES;
const sources=folder?JSON.parse(readFileSync(folder+'/library.json','utf8')):{};
it.skipIf(!folder)('checks published combinations, all pavé settings, contact and gemstone clearance',async()=>{
 const lib=createReferenceLibrary(async url=>Uint8Array.from(readFileSync(folder+'/'+url)).buffer,sources),trees=new Map();const failures=[];let tested=0;
 const hit=(gem:any,part:any,matrix:any)=>{
 const inverse=gem.matrix.clone().invert(),relative=new Matrix4().multiplyMatrices(inverse,matrix);
 if(!gem.geometry.boundingBox.intersectsBox(part.geometry.boundingBox.clone().applyMatrix4(relative)))return false;
 for(const p of [gem,part])if(!trees.has(p.geometry)){const tree=new MeshBVH(p.geometry,{indirect:true});trees.set(p.geometry,tree);p.geometry.boundsTree=tree;}
 return trees.get(gem.geometry).intersectsGeometry(part.geometry,relative);
 };
 try{for(const h of Object.keys(sources))for(const b of Object.keys(sources)){
  const {stock,band}=await lib.load(h,b);
  for(const [d,l] of [80,90,100].flatMap(d=>[70,85,100].map(l=>[d,l]))){
   const ring=applyReferencePave(stock,band,d as any,l as any);tested++;
   if(h!==b){const baskets=ring.metal.filter(p=>p.name.startsWith('head:')),base=ring.metal.filter(p=>!p.name.startsWith('head:'));if(baskets.length&&!baskets.some(p=>base.some(other=>hit({geometry:other.geometry,matrix:new Matrix4()},p,new Matrix4().makeTranslation(0,p.offsetY??0,0)))))failures.push({h,b,d,l,unmounted:true,offset:baskets[0]?.offsetY});}

   for(const gem of ring.stones){
    const opposite=ring.metal.filter(p=>(d!==100||l!==100)&&gem.zone==='shoulder'?p.name!=='metal_pave_seats':gem.zone==='shoulder'?p.name.startsWith('head:'):!p.name.startsWith('head:')&&(sources[h].profileId??h)!==(sources[b].profileId??b));
    const collision=opposite.find(p=>hit(gem,p,new Matrix4().makeTranslation(0,p.offsetY??0,0)));
    if((d!==100||l!==100)&&gem.zone==='shoulder'){
      const other=ring.stones.find(other=>other!==gem&&hit(gem,other,other.matrix));
      if(other)failures.push({h,b,d,l,gem:gem.name,other:other.name});
    }
    if(gem.zone!=='shoulder'){
      const seats=ring.metal.find(part=>part.name==='metal_pave_seats');
      if(seats&&hit(gem,seats,new Matrix4()))failures.push({h,b,d,l,seatsHitHead:true});
    }
    if(collision){failures.push({h,b,d,l,gem:gem.name,part:collision.name});break;}
   }
  }
 }}finally{lib.dispose();}
 writeFileSync(folder+'/audit.json',JSON.stringify({tested,failures},null,2));expect(failures).toEqual([]);
},120000);
