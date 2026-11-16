import {useEffect,useEffectEvent} from 'react';
import './operation-feedback.css';

export type Feedback = {
  tone:'success'|'info'|'warning'|'error';
  title:string;
  description?:string;
};

const marks={success:'m3.5 8.5 3 3 6-7',info:'M8 7v5m0-8v.2',warning:'M8 3.5v5.1m0 2.7v.4',error:'M8 3.5v5.1m0 2.7v.4'};

export function FeedbackToast({notice,onDismiss,onRetry,inline=false}:{
  notice?:Feedback;
  onDismiss:()=>void;
  onRetry?:()=>void;
  inline?:boolean;
}){
  const dismiss=useEffectEvent(onDismiss);
  useEffect(()=>{
    if(!notice||notice.tone==='error'||onRetry)return;
    const timer=window.setTimeout(()=>dismiss(),6000);
    return ()=>window.clearTimeout(timer);
  },[notice,onRetry]);
  if(!notice)return null;
  return <div className={`feedback-toast feedback-${notice.tone}${inline?' feedback-inline':''}`}>
    <span className="feedback-mark" aria-hidden="true"><svg viewBox="0 0 16 16"><path d={marks[notice.tone]}/></svg></span>
    <div className="feedback-copy" role={notice.tone==='error'?'alert':'status'}>
      <strong>{notice.title}</strong>
      {notice.description&&<p>{notice.description}</p>}
    </div>
    {onRetry&&<button type="button" className="feedback-retry" onClick={onRetry}>重试</button>}
    <button type="button" className="feedback-dismiss" aria-label="关闭提示" onClick={onDismiss}>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8"/></svg>
    </button>
  </div>;
}
