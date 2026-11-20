import type {ReactNode} from 'react';
import './shop-state.css';

export function ShopState({kind='empty',title,detail,children}:{kind?:'empty'|'error'|'loading';title:string;detail?:string;children?:ReactNode}){
  return <div className={'shop-state shop-state-'+kind} role={kind==='error'?'alert':kind==='loading'?'status':undefined}>
    <div className="shop-state-mark" aria-hidden="true">
      {kind==='empty'?<img src="/part-views/ring-rosette-head.webp" width="68" height="68" alt=""/>:
        kind==='loading'?<span className="storefront-spinner"/>:<span className="shop-state-exclamation">!</span>}
    </div>
    <h2>{title}</h2>
    {detail&&<p>{detail}</p>}
    {children&&<div className="shop-state-actions">{children}</div>}
  </div>;
}

export function GallerySkeleton({type,label}:{type:'catalog'|'community';label:string}){
  const catalog=type==='catalog';
  return <div role="status" className="gallery-loading">
    <span className="sr-only">{label}</span>
    <div className={catalog?'diy-template-grid':'community-grid'} aria-hidden="true">
      {Array.from({length:catalog?3:4},(_,i)=><div className="gallery-placeholder" key={i}>
        <div className="skeleton-photo"/>
        <div className="skeleton-caption"><i/><i/>{catalog&&<i/>}</div>
      </div>)}
    </div>
  </div>;
}
