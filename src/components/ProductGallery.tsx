import {useEffect,useState} from 'react';
import type {ProductImage} from '../assets/productMedia';
export function ProductGallery({images,sample=false,downloads=false}:{images:ProductImage[];sample?:boolean;downloads?:boolean}){
  const [selected,setSelected]=useState(0);useEffect(()=>setSelected(0),[images]);
  const current=images[selected]??images[0];
  return <div className={`product-gallery ${downloads?'gallery-downloads':''}`}>
    {!downloads&&<figure><img src={current.url} alt={`${sample?'黄金色枕形光环样板':'当前配置'} · ${current.label}`} width="1000" height="1000"/><figcaption>{sample?'固定样板 · 枕形光环 · 黄金色':`当前配置 · ${current.label}`}</figcaption></figure>}
    <div className="gallery-thumbnails" aria-label={downloads?'下载商品预览':'商品图片视角'}>
      {images.map((item,i)=>downloads?<a key={item.view} data-product-download={item.view} href={item.url} download={`ring-${item.view}.jpg`}><img src={item.url} alt=""/><span>下载{item.label}</span></a>
        :<button key={item.view} aria-pressed={selected===i} onClick={()=>setSelected(i)}><img src={item.url} alt=""/><span>{item.label}</span></button>)}
    </div>
  </div>;
}
