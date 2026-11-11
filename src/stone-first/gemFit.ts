import {type BufferGeometry} from 'three';
import {normalizeLooseGem} from '../geometry/productGeometry';

/**
 * The designer's stone site refers to the GIRDLE plane, not the mesh bounding-box
 * center. A brilliant stone is asymmetric about its height: centring at the bounding
 * box is exactly why its pavilion floats above an uncut ring in prior demos.
 *
 * Input GLBs are Y-up and closed per the repo's gem asset contract. The widest
 * near-horizontal perimeter is the best accessible approximation of the girdle
 * without loading an unconstrained CAD cutter.
 */
export function prepareGirdleGem(source:BufferGeometry){
  const geometry=normalizeLooseGem(source);
  const p=geometry.getAttribute('position');
  if(!p||p.count<8){geometry.dispose();throw new Error('Missing gemstone perimeter');}
  let rMax=0;
  for(let i=0;i<p.count;i++)rMax=Math.max(rMax,Math.hypot(p.getX(i),p.getZ(i)));
  if(rMax<1e-5){geometry.dispose();throw new Error('Missing gemstone girdle');}
  const y:number[]=[];
  for(let i=0;i<p.count;i++){
    if(Math.hypot(p.getX(i),p.getZ(i))>=rMax*0.965)y.push(p.getY(i));
  }
  if(y.length<4){geometry.dispose();throw new Error('Not enough gemstone girdle vertices');}
  y.sort((a,b)=>a-b);
  const girdle=(y[Math.floor((y.length-1)/2)]+y[Math.floor(y.length/2)])/2;
  geometry.translate(0,-girdle,0);
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return {geometry,girdleOffset:girdle,vertexCount:y.length};
}
