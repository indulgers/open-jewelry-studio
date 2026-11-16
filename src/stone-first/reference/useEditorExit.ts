import {useLayoutEffect,useRef,useState} from 'react';
import {BEFORE_ROUTE_CHANGE,type RouteChangeEvent} from '../../navigation';

export function useEditorExit(unsaved:boolean){
  const [destination,setDestination]=useState<string>();
  const bypass=useRef(false);
  const traversing=useRef(false);
  useLayoutEffect(()=>{
    if(!unsaved)return;
    function beforeUnload(event:BeforeUnloadEvent){
      if(bypass.current)return;
      event.preventDefault();event.returnValue='';
    }
    function click(event:MouseEvent){
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const link=(event.target as Element).closest<HTMLAnchorElement>('a[href]');
      if(!link||link.target==='_blank'||link.hasAttribute('download')||link.href===location.href)return;
      if(!['http:','https:'].includes(new URL(link.href).protocol))return;
      event.preventDefault();traversing.current=false;setDestination(link.href);
    }
    function routeChange(event:Event){
      if(bypass.current)return;
      event.preventDefault();
      const {oldURL,newURL}=(event as RouteChangeEvent).detail;
      // Reinsert the editor after the destination without overwriting that history entry.
      history.pushState(null,'',oldURL);
      traversing.current=true;setDestination(newURL);
    }
    window.addEventListener('beforeunload',beforeUnload);
    document.addEventListener('click',click,true);
    window.addEventListener(BEFORE_ROUTE_CHANGE,routeChange);
    return ()=>{
      window.removeEventListener('beforeunload',beforeUnload);
      document.removeEventListener('click',click,true);
      window.removeEventListener(BEFORE_ROUTE_CHANGE,routeChange);
    };
  },[unsaved]);
  return {destination,go:(url:string)=>{bypass.current=true;location.assign(url);},cancel:()=>setDestination(undefined),leave:()=>{
    if(!destination)return;
    bypass.current=true;
    if(traversing.current)history.back();else location.assign(destination);
    setDestination(undefined);
  }};
}
