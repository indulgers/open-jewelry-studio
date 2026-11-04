import {useEffect} from 'react';
import {useThree} from '@react-three/fiber';

/** Wait for the actual renderer (including postprocessing), not a separate shader variant. */
export function SceneReady({prepared,onReady}:{prepared:boolean;onReady:()=>void}){
  const {gl,invalidate}=useThree();
  useEffect(()=>{
    if(!prepared)return;
    let cancelled=false,frame=0;
    const before=gl.info.render.frame;
    const presented=()=>{
      if(cancelled)return;
      if(gl.info.render.frame>before)onReady();
      else{invalidate();frame=requestAnimationFrame(presented)}
    };
    invalidate();frame=requestAnimationFrame(presented);
    return ()=>{cancelled=true;cancelAnimationFrame(frame)};
  },[prepared,gl,invalidate,onReady]);
  return null;
}
