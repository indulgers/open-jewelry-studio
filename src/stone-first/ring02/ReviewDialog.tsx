import {useEffect,useRef,type ReactNode} from 'react';

export function ReviewDialog({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const element=dialog.current!;
    element.showModal();
    return ()=>element.close();
  },[]);
  return <dialog ref={dialog} className="ring02-dialog" aria-labelledby="ring02-dialog-title" onCancel={event=>{
    event.preventDefault();
    onClose();
  }}>
    <h2 id="ring02-dialog-title">{title}</h2>
    {children}
  </dialog>;
}
