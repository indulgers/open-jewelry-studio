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
      const data=await response.json() as {catalog:CatalogRing[];parts:typeof parts;prices:PriceBook};
      for(const current of RING_CATALOG){
        const next=data.catalog.find(item=>item.id===current.id);
        if(!next||!data.parts[current.id as keyof typeof parts])throw new Error('款式资料不完整');
        const {price,listed,...fields}=next;
        Object.assign(current,fields);
        Object.assign(current.price,price,{base:data.prices.bases[current.id]??price.base,version:data.prices.revision});
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
