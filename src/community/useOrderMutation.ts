import {useEffect,useRef,useState} from 'react';

export function useOrderMutation(accountName:string|undefined,onTimeout:()=>void){
  const pending=useRef<{controller:AbortController;timer:number}|null>(null);
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    setBusy(false);
    return ()=>{
      const attempt=pending.current;
      if(!attempt)return;
      pending.current=null;
      window.clearTimeout(attempt.timer);
      attempt.controller.abort();
    };
  },[accountName]);

  function start(){
    if(pending.current)return;
    const controller=new AbortController();
    const timer=window.setTimeout(()=>{
      pending.current=null;
      controller.abort();
      setBusy(false);
      onTimeout();
    },15_000);
    pending.current={controller,timer};
    setBusy(true);
    return controller.signal;
  }

  function finish(signal:AbortSignal){
    if(pending.current?.controller.signal!==signal)return;
    window.clearTimeout(pending.current.timer);
    pending.current=null;
    setBusy(false);
  }
  return {busy,start,finish};
}
