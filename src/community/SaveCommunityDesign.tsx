import {useEffect,useState} from 'react';
import {ReviewDialog} from '../stone-first/ring02/ReviewDialog';
import {AccountForm} from './AccountForm';
import {useDesignRequestId} from './useDesignRequestId';
import {CommunityAccountChanged,communityRequest,errorText,type Account} from './client';
import './community.css';

type Snapshot={title:string;templateId:string;revision:string;design:object;image:string};
type Props=Omit<Snapshot,'image'>&{capture:()=>string|undefined;disabled?:boolean};

function SaveDialog({snapshot,onClose,onSaved}:{snapshot:Snapshot;onClose:()=>void;onSaved:()=>void}){
  const [account,setAccount]=useState<Account|null>();
  const [title,setTitle]=useState(snapshot.title);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  const requestIdFor=useDesignRequestId();
  const [accountChanged,setAccountChanged]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    communityRequest<{account:Account|null}>('session',undefined,controller.signal).then(result=>{if(!controller.signal.aborted)setAccount(result.account);})
      .catch(cause=>{if(!controller.signal.aborted)setError(errorText(cause));});
    return ()=>controller.abort();
  },[attempt]);
  return <ReviewDialog title="保存设计" onClose={onClose} busy={busy}>
    {!accountChanged&&<img className="community-dialog-preview" alt="本次保存的设计预览" src={snapshot.image}/>}
    {accountChanged?<p role="status">账号已变更。{account?'当前账号为 '+account.name+'。':account===null?'当前已退出登录。':''}请回到编辑器，重新确认要保存的设计。</p>:account===null?<><p>登录后可在其他设备打开自己的设计。</p><AccountForm onSuccess={setAccount}/></>:
      account?<form className="community-form" onSubmit={async event=>{
        event.preventDefault();if(busy||!title.trim())return;
        setBusy(true);setError('');
        try{
          const name=title.trim();
          await communityRequest('designs',{...snapshot,title:name,expectedAccount:account.name,
            requestId:requestIdFor(account.name,name,snapshot.image)});
          onSaved();
        }catch(cause){
          if(cause instanceof CommunityAccountChanged){
            setAccountChanged(true);setAccount(undefined);setAttempt(n=>n+1);
          }else setError(errorText(cause));
        }finally{setBusy(false);}
      }}><label>作品名称<input value={title} onChange={event=>setTitle(event.target.value)} maxLength={60} required/></label>
      <p>保存到 {account.name} 的私密作品。</p>
      <button className="shop-button" disabled={busy||!title.trim()}>{busy?'正在保存…':'保存到我的设计'}</button>
      </form>:!error&&<p role="status">正在读取账号…</p>}
    {error&&<p role="alert">{error} {account===undefined&&<button onClick={()=>{setError('');setAttempt(n=>n+1);}}>重试</button>}</p>}
    <button className="shop-text-link" disabled={busy} onClick={onClose}>返回编辑器</button>
  </ReviewDialog>;
}

export function SaveCommunityDesign({capture,disabled,title,templateId,revision,design}:Props){
  const [snapshot,setSnapshot]=useState<Snapshot>();
  const [status,setStatus]=useState<'error'|'saved'>();
  return <div className="community-save-control">
    <button type="button" className="shop-text-link" disabled={disabled} onClick={()=>{
      let image:string|undefined;
      try{image=capture();}catch{/* A context loss can invalidate a ready frame. */}
      if(!image){setStatus('error');return;}
      setStatus(undefined);setSnapshot({title,templateId,revision,design,image});
    }}>保存设计</button>
    {status==='error'&&<small role="alert">当前画面尚未就绪，请重试。</small>}
    {status==='saved'&&<span role="status">已私密保存。<a href="#/my-designs">查看我的设计</a></span>}
    {snapshot&&<SaveDialog snapshot={snapshot} onClose={()=>setSnapshot(undefined)} onSaved={()=>{setSnapshot(undefined);setStatus('saved');}}/>}
  </div>;
}
