import {Component,lazy,Suspense,type ReactNode,useEffect,useState,useSyncExternalStore} from 'react';
import {communityMode} from './community/route';
import {RING_CATALOG,type CatalogRing} from './stone-first/catalog';
import {RING02_TEMPLATE} from './stone-first/ring02/assets';
import {refreshCatalogBandStyles} from './stone-first/reference/parts';
import parts from './stone-first/reference/part-assets.json';
import {setPriceBook,type PriceBook} from './stone-first/pricing';

const CommunityEntry=lazy(()=>import('./community/CommunityEntry'));
class CommunityLoadBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){
    if(this.state.failed)return <div role="alert" className="storefront-loading">
      <p>作品页面暂时无法打开，请重新载入。</p>
      <button className="shop-button" onClick={()=>window.location.reload()}>重新载入页面</button>
    </div>;
    return this.props.children;
  }
}
const currentCommunity=()=>communityMode(window.location.hash);
function watchRoute(changed:()=>void){
  window.addEventListener('hashchange',changed);
  return ()=>window.removeEventListener('hashchange',changed);
}

async function loadStorefront(signal:AbortSignal){
  const response=await fetch('/api/model-admin/public/storefront.json',{signal});
  if(!response.ok)throw new Error('款式暂不可用');
  const data=await response.json() as {catalog:CatalogRing[];parts:typeof parts;prices:PriceBook};
  signal.throwIfAborted();
  if(!Array.isArray(data.catalog)||!data.parts||!data.prices?.revision||!data.prices.components||!data.prices.bases){
    throw new Error('款式或价格数据不完整');
  }
  for(const next of data.catalog){
    const current=RING_CATALOG.find(item=>item.id===next.id);
    if(!current){RING_CATALOG.push(next);continue;}
    const {listed,price,...fields}=next;
    Object.assign(current,fields);
    Object.assign(current.price,price);
    if(current.id==='ring-02'){
      Object.assign(RING02_TEMPLATE,{listed});
      Object.assign(RING02_TEMPLATE.price,price);
    }else current.listed=listed;
  }
  Object.assign(parts,data.parts);
  refreshCatalogBandStyles();
  setPriceBook(data.prices);
}

export function StorefrontEntry(){
  const community=useSyncExternalStore(watchRoute,currentCommunity);
  const hosted=Boolean(import.meta.env.PROD||import.meta.env.VITE_CLOUD_MODE);
  const independent=hosted&&Boolean(community);
  const [App,setApp]=useState<typeof import('./App').default>();
  const [failed,setFailed]=useState(false);
  const [attempt,setAttempt]=useState(0);

  useEffect(()=>{
    if(independent||App)return;
    const controller=new AbortController();
    async function start(){
      setFailed(false);
      if(hosted)await loadStorefront(controller.signal);
      // Editor modules derive some choices from the published catalog on import.
      const {default:Studio}=await import('./App');
      if(!controller.signal.aborted)setApp(()=>Studio);
    }
    start().catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    return ()=>controller.abort();
  },[App,hosted,independent,attempt]);

  if(App)return <App/>;
  if(hosted&&community)return <CommunityLoadBoundary>
    <Suspense fallback={<p role="status">正在打开作品…</p>}><CommunityEntry mode={community}/></Suspense>
  </CommunityLoadBoundary>;
  if(failed)return <div className="storefront-loading" role="alert">
    <p>款式暂时无法读取，请重试。</p>
    <button className="shop-button" onClick={()=>setAttempt(n=>n+1)}>重新加载</button>
    <a className="shop-text-link" href="#/community">浏览设计社区</a>
  </div>;
  return <div role="status" className="storefront-loading"><span className="storefront-spinner" aria-hidden="true"/><span>正在准备款式…</span></div>;
}
