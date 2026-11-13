import type {PublishedTemplate} from './stone-first/reference/managed-types';
import {RING02_TEMPLATE} from './stone-first/ring02/assets';
import {createRoot} from 'react-dom/client';
import {RING_CATALOG,type CatalogRing} from './stone-first/catalog';
import parts from './stone-first/reference/part-assets.json';
import {setPriceBook,type PriceBook} from './stone-first/pricing';
import './styles.css';
import './shop-theme.css';

const root=createRoot(document.getElementById('root')!);
async function start(){
  root.render(<div role="status" className="storefront-loading"><span className="storefront-spinner" aria-hidden="true"/><span>正在准备款式…</span></div>);
  try{
    if((import.meta.env.PROD||import.meta.env.VITE_CLOUD_MODE)){
      const response=await fetch('/api/model-admin/public/storefront.json');
      if(!response.ok)throw new Error('款式暂不可用');
      const data=await response.json() as {catalog:CatalogRing[];parts:typeof parts;prices:PriceBook;products:PublishedTemplate[]};
      for(const current of RING_CATALOG){
        const next=data.catalog.find(item=>item.id===current.id);
        if(!next||!data.parts[current.id as keyof typeof parts])throw new Error('款式资料不完整');
        const {price,listed,...fields}=next;
        const product=data.products.find(item=>item.catalogId===current.id);
        Object.assign(current,fields,product?{name:product.name,description:product.description??'',image:product.image}:{});
        if(current.id==='ring-02')Object.assign(RING02_TEMPLATE,{listed:!!product});else current.listed=!!product;
        Object.assign(current.price,price,{base:product?.pricing?.base??price.base,version:product?.revision??price.version});
      }
      Object.assign(parts,data.parts);
      setPriceBook({...data.prices,components:Object.fromEntries(data.products.filter(item=>item.catalogId&&item.pricing).map(item=>[item.catalogId!,{head:item.pricing!.head,band:item.pricing!.band,pave:item.pricing!.pave}]))});
    }
    const {default:App}=await import('./App');
    root.render(<App/>);
  }catch{
    root.render(<div className="storefront-loading" role="alert"><p>款式暂时无法读取，请重试。</p><button className="shop-button" onClick={start}>重新加载</button></div>);
  }
}
void start();
