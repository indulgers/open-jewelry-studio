import {useEffect,useRef,useState} from 'react';

/** A quiet "drag to rotate" cue that retires after the visitor first touches the stage. */
export function StageHint(){
  const ref=useRef<HTMLDivElement>(null);
  const [hidden,setHidden]=useState(false);
  useEffect(()=>{
    const stage=ref.current?.parentElement;
    if(!stage)return;
    const retire=()=>setHidden(true);
    const timer=window.setTimeout(retire,9000);
    stage.addEventListener('pointerdown',retire,{once:true});
    stage.addEventListener('wheel',retire,{once:true,passive:true});
    return ()=>{window.clearTimeout(timer);stage.removeEventListener('pointerdown',retire);stage.removeEventListener('wheel',retire);};
  },[]);
  return <div ref={ref} className="stage-hint" aria-hidden="true" data-hidden={hidden?'':undefined}>
    <svg viewBox="0 0 22 14"><path d="M1 7h20M5 3 1 7l4 4M17 3l4 4-4 4"/></svg>拖动旋转 · 滚轮缩放
  </div>;
}
