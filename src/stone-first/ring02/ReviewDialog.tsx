import {useEffect,useId,useRef,type ReactNode} from 'react';

export function ReviewDialog({title,children,onClose,busy=false}:{title:string;children:ReactNode;onClose:()=>void;busy?:boolean}){
  const titleId=useId();
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const element=dialog.current!;
    element.showModal();
    return ()=>element.close();
  },[]);
  return <dialog ref={dialog} className="ring02-dialog" aria-labelledby={titleId} aria-busy={busy} onCancel={event=>{
    event.preventDefault();
    if(!busy)onClose();
  }}>
    <h2 id={titleId}>{title}</h2>
    {children}
  </dialog>;
}
