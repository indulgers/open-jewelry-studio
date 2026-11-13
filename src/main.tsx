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
      for(const next of data.catalog){
        const current=RING_CATALOG.find(item=>item.id===next.id);
        if(current){const {listed,price,...fields}=next;Object.assign(current,fields);Object.assign(current.price,price);if(current.id==='ring-02'){Object.assign(RING02_TEMPLATE,{listed});Object.assign(RING02_TEMPLATE.price,price);}else current.listed=listed;}
        else RING_CATALOG.push(next);
      }
      Object.assign(parts,data.parts);
      setPriceBook(data.prices);
    }
    const {default:App}=await import('./App');
    root.render(<App/>);
  }catch{
    root.render(<div className="storefront-loading" role="alert"><p>款式暂时无法读取，请重试。</p><button className="shop-button" onClick={start}>重新加载</button></div>);
  }
}
void start();
