import {useEffect,useRef,useState} from 'react';

/** Retain the editor and its imported meshes while switching workspaces. */
export function ModuleStudio({active}:{active:boolean}){
  const frame=useRef<HTMLIFrameElement>(null);
  const [loaded,setLoaded]=useState(false);
  const [height,setHeight]=useState(1100);
  const [src]=useState(()=>{
    const design=new URLSearchParams(window.location.hash.split('?')[1]??'').get('design');
    return `${import.meta.env.BASE_URL}forme/index.html?embedded=1${design?'#design='+encodeURIComponent(design):''}`;
  });
  useEffect(()=>{
    frame.current?.contentWindow?.postMessage({type:'open-jewelry:forme-visibility',active},window.location.origin);
  },[active,loaded]);
  useEffect(()=>{
    const resize=(event:MessageEvent)=>{
      if(event.origin!==window.location.origin||event.source!==frame.current?.contentWindow||event.data?.type!=='forme:size')return;
      if(Number.isFinite(event.data.height))setHeight(Math.max(600,Math.min(6000,Math.ceil(event.data.height))));
    };
    window.addEventListener('message',resize);return()=>window.removeEventListener('message',resize);
  },[]);
  return <div className="module-studio">
    {!loaded&&<p className="module-loading" role="status">正在准备模组设计工作台…</p>}
    <iframe ref={frame} title="FORME 模组 DIY 设计工作台" src={src} style={{height}} onLoad={()=>setLoaded(true)} allow="clipboard-write"/>
  </div>;
}
