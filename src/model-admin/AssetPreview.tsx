import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {ViewerBoundary} from '../viewer/ViewerBoundary';

const PartPreview=lazy(()=>import('./PartPreview'));
const noAssignments={};

export default function AssetPreview({asset,onClose}:{asset:{title:string;url:string};onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{dialog.current?.showModal();},[]);
  return <dialog ref={dialog} className="asset-preview-dialog" aria-labelledby="asset-preview-title" onClose={onClose}>
    <header className="review-heading">
      <div><h2 id="asset-preview-title">{asset.title}</h2><p>拖动旋转，滚轮或双指缩放。</p></div>
      <button type="button" autoFocus onClick={()=>dialog.current?.close()}>关闭</button>
    </header>
    <div className="preview">
      <ViewerBoundary onRetry={()=>setAttempt(value=>value+1)}>
        <Suspense fallback={<p className="preview-message" role="status">正在加载预览…</p>}>
          <PartPreview url={asset.url+(attempt?(asset.url.includes('?')?'&':'?')+'attempt='+attempt:'')}
            assignments={noAssignments} anchor={null} centerX={0} radius={0}/>
        </Suspense>
      </ViewerBoundary>
    </div>
  </dialog>;
}
