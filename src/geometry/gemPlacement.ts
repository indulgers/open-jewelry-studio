import {Box3,Vector3} from 'three';
import type {StoneSize} from '../configuration/configuration';
export const stoneScale=(size:StoneSize)=>({small:0.85,medium:1,large:1.15})[size];
export function getGemPlacement(bounds:Box3,size:StoneSize):{scale:number;position:[number,number,number]}{
  const extent=bounds.getSize(new Vector3());
  const widest=Math.max(extent.x,extent.z);
  if(bounds.isEmpty()||![extent.x,extent.y,extent.z].every(Number.isFinite)||widest<=0||extent.y<=0)
    throw new Error('Invalid gemstone bounds');
  return {scale:0.65*stoneScale(size)/widest,position:[0,1.5,0]};
}
