import {createContext,useContext,useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {ShopState} from '../../components/ShopState';
import {communityRequest,CUSTOMER_SESSION_CHANGED} from '../../community/client';
import type {FitScope} from './profile';

const Scope=createContext<FitScope>(null);
export const useFitScope=()=>useContext(Scope);
export function FitSession({children}:{children:ReactNode}){
  const [scope,setScope]=useState<FitScope|undefined>();
  const [checking,setChecking]=useState(true);
  const [unavailable,setUnavailable]=useState(false);
  const surface=useRef<HTMLDivElement>(null);
  const [attempt,retry]=useState(0);
  useEffect(()=>{
    let active:AbortController|undefined;
    async function verify(){
      active?.abort();
      const request=new AbortController();
      active=request;
      setChecking(true);
      const timeout=window.setTimeout(()=>request.abort(),8000);
      let next:FitScope=null;
      try{
        const data=await communityRequest<{account:null|{name:string};localProfileId?:string}>('session',undefined,
          request.signal);
        if(data.account===null)next='guest';
        else if(data.account&&data.localProfileId&&/^[0-9a-f]{32}$/.test(data.localProfileId))next=`member:${data.localProfileId}`;
      }catch{/* Keep private storage locked until the server identifies this browser. */}
      window.clearTimeout(timeout);
      if(active!==request)return;
      // Keep an already-open editor mounted and locked until its owner is verified again.
      setScope(previous=>next??previous??null);
      setUnavailable(next===null);
      setChecking(false);
    }
    const changed=(event:StorageEvent)=>{
      if(event.key===CUSTOMER_SESSION_CHANGED||event.key===null)void verify();
    };
    const visible=()=>{if(document.visibilityState==='visible')void verify();};
    void verify();
    window.addEventListener('storage',changed);
    window.addEventListener(CUSTOMER_SESSION_CHANGED,verify);
    window.addEventListener('focus',verify);
    window.addEventListener('pageshow',verify);
    window.addEventListener('online',verify);
    document.addEventListener('visibilitychange',visible);
    return ()=>{
      active?.abort();active=undefined;
      window.removeEventListener('storage',changed);
      window.removeEventListener(CUSTOMER_SESSION_CHANGED,verify);
      window.removeEventListener('focus',verify);
      window.removeEventListener('pageshow',verify);
      window.removeEventListener('online',verify);
      document.removeEventListener('visibilitychange',visible);
    };
  },[attempt]);
  const locked=checking||(unavailable&&scope!=null);
  useLayoutEffect(()=>{
    if(!locked)return;
    // A modal escapes ancestor inertness and otherwise makes the retry button unreachable.
    const dialogs=Array.from(surface.current?.querySelectorAll<HTMLDialogElement>('dialog[open]')??[]);
    dialogs.forEach(dialog=>dialog.close());
    return ()=>dialogs.forEach(dialog=>{if(dialog.isConnected&&!dialog.open)dialog.showModal();});
  },[locked]);
  return <>
    {checking&&(scope===undefined?<ShopState kind="loading" title="正在确认当前佩戴资料…"/>:<p role="status" className="sr-only">正在确认当前佩戴资料…</p>)}
    {!checking&&unavailable&&<p role="status">暂时无法确认账号，佩戴资料已锁定。<button type="button" onClick={()=>retry(n=>n+1)}>重新读取</button></p>}
    {scope!==undefined&&<div ref={surface} inert={locked} aria-hidden={locked||undefined} style={{display:'contents',visibility:locked?'hidden':undefined}}>
      <Scope.Provider key={scope??'unverified'} value={scope}>{children}</Scope.Provider>
    </div>}
  </>;
}
