import {useRef} from 'react';

// Retain the key across retries of this form's payload. Editing the submission
// starts a different save, even after a previous response was lost.
export function useDesignRequestId(){
  const last=useRef<{owner:string;title:string;image:string;id:string}>(null);
  return (owner:string,title:string,image:string)=>{
    const prior=last.current;
    if(prior && prior.owner===owner && prior.title===title && prior.image===image)return prior.id;
    const id=crypto.randomUUID();
    last.current={owner,title,image,id};
    return id;
  };
}
