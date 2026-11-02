import type {Matrix4} from 'three';

export function movedSinceSample(current:Matrix4,lastSample:Matrix4){
  // Orbit damping keeps changing the matrix long after the shift is subpixel.
  return current.elements.some((value,index)=>Math.abs(value-lastSample.elements[index])>0.00005);
}

export type RefinementState={stableFrames:number;samples:number};
export function nextRefinement(previous:RefinementState,changed:boolean){
  if(changed)return {state:{stableFrames:0,samples:0},reset:true,accumulate:false,requestFrame:true};
  const stableFrames=previous.stableFrames+1,accumulate=stableFrames>=2;
  const samples=accumulate?Math.min(32,previous.samples+1):0;
  return {state:{stableFrames,samples},reset:false,accumulate,requestFrame:samples<32};
}
