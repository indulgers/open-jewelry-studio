import {lazy,Suspense,useEffect,useState,useSyncExternalStore} from 'react';
import {ReviewDialog} from '../stone-first/ring02/ReviewDialog';
import {AccountForm} from './AccountForm';
import {OrderHistory} from './OrderHistory';
import {WorkRequestDialog} from './WorkRequestDialog';
import {UploadWork} from './UploadWork';
import {CUSTOMER_SESSION_CHANGED,CommunityAccountChanged,communityRequest,errorText,type Account,type Order,type Work} from './client';
import {CommunityHeading} from './CommunityPlaceholder';
import {GallerySkeleton,ShopState} from '../components/ShopState';

const authIntent=()=>new URLSearchParams(window.location.hash.split('?')[1]).get('auth')??'';
function watchIntent(fn:()=>void){window.addEventListener('hashchange',fn);return ()=>window.removeEventListener('hashchange',fn);}

const PrivateDesignSummary=lazy(()=>import('./PrivateDesignSummary'));

type Mode='community'|'mine';
export default function CommunityStudio({mode}:{mode:Mode}){
  const mine=mode==='mine';
  const intent=useSyncExternalStore(watchIntent,authIntent);
  const [account,setAccount]=useState<Account|null>();
  const [works,setWorks]=useState<Work[]>([]),[orders,setOrders]=useState<Order[]>([]);
  const [loading,setLoading]=useState(true),[version,refresh]=useState(0);
  const [loadFailed,setLoadFailed]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [requestWork,setRequestWork]=useState<Work>(),[upload,setUpload]=useState(false);
  const [preview,setPreview]=useState<Work>(),[publish,setPublish]=useState<Work>();
  useEffect(()=>{
    const controller=new AbortController(),signal=controller.signal;
    setLoading(true);setLoadFailed(false);setAccount(undefined);setError('');setWorks([]);setOrders([]);
    setPreview(undefined);setPublish(undefined);setUpload(false);setRequestWork(undefined);
    async function load(){
      const session=await communityRequest<{account:Account|null}>('session',undefined,signal);
      const [items,requests]=await Promise.all([
        mine&&!session.account?[]:communityRequest<Work[]>(mine?'mine':'works',undefined,signal,mine?session.account?.name:undefined),
        mine&&session.account?communityRequest<Order[]>('orders',undefined,signal,session.account.name):[],
      ]);
      if(!signal.aborted){
        setAccount(session.account);setWorks(items);setOrders(requests);
        if(mine&&session.account&&new URLSearchParams(window.location.hash.split('?')[1]).get('upload')==='1'){
          setUpload(true);
          window.history.replaceState(null,'',window.location.pathname+window.location.search+'#/my-designs');
        }
      }
    }
    load().catch(cause=>{
      if(signal.aborted)return;
      if(!(cause instanceof CommunityAccountChanged))throw cause;
      setNotice('账号已变更，请核对当前账号后重新操作。');
      return load();
    }).catch(cause=>{if(!signal.aborted){setLoadFailed(true);setError(errorText(cause));}})
      .finally(()=>{if(!signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[mine,version]);
  useEffect(()=>{
    const handleStorage=(event:StorageEvent)=>{
      if(event.key===CUSTOMER_SESSION_CHANGED)accountChanged();
    };
    window.addEventListener('storage',handleStorage);
    return ()=>window.removeEventListener('storage',handleStorage);
  },[]);
  useEffect(()=>{
    if(!mine||!account||loading)return;
    const focusOrder=()=>{
      const id=new URLSearchParams(window.location.hash.split('?')[1]).get('order');
      if(id)document.getElementById('community-order-'+id)?.focus();
    };
    focusOrder();
    window.addEventListener('hashchange',focusOrder);
    return ()=>window.removeEventListener('hashchange',focusOrder);
  },[mine,loading,account,orders]);
  function loggedIn(user:Account){
    if(intent){
      const params=new URLSearchParams(window.location.hash.split('?')[1]);
      params.delete('auth');
      window.history.replaceState(null,'',window.location.pathname+window.location.search+'#/my-designs'+(params.size?'?'+params:''));
    }
    setAccount(user);setRequestWork(undefined);refresh(v=>v+1);}
  function accountChanged(){
    setAccount(undefined);setWorks([]);setOrders([]);setPreview(undefined);setPublish(undefined);
    setUpload(false);setRequestWork(undefined);setNotice('账号已变更，请核对当前账号后重新操作。');
    refresh(n=>n+1);
  }
  async function act(action:()=>Promise<void>){
    if(busy)return;
    setBusy(true);setError('');setNotice('');
    try{await action();}catch(cause){
      if(cause instanceof CommunityAccountChanged)accountChanged();
      else setError(errorText(cause));
    }finally{setBusy(false);}
  }
  function startRequest(work:Work){
    setError('');setNotice('');setPreview(undefined);setRequestWork(work);
  }
  function withdrawn(){
    setRequestWork(undefined);
    setNotice('这件作品已撤回，可选择其他公开作品。');
    refresh(v=>v+1);
  }
  function changeVisibility(work:Work){
    if(!account)return;
    void act(async()=>{
      await communityRequest('designs/'+work.id+'/'+(work.published?'unpublish':'publish'),{expectedAccount:account.name});
      setPublish(undefined);setNotice(work.published?'作品已转为私密。':'作品已发布到社区。');refresh(v=>v+1);
    });
  }
  return <main className="community-page">
    <CommunityHeading mine={mine} account={account?.name}/>
    {mine&&account&&<div className="community-account"><span>{account.name}</span><a href="#/diy/fit">佩戴资料与尺寸</a>
      <button disabled={busy} onClick={()=>void act(async()=>{
        await communityRequest('logout',{expectedAccount:account.name});setAccount(null);setWorks([]);setOrders([]);setPreview(undefined);setUpload(false);setPublish(undefined);refresh(v=>v+1);
      })}>退出登录</button></div>}
    {notice&&<p role="status" className="community-notice">{notice}</p>}
    {error&&!loadFailed&&<p role="alert" className="community-notice">{error} <button onClick={()=>refresh(v=>v+1)}>重新加载</button></p>}
    {loading?<GallerySkeleton type="community" label="正在读取作品…"/>:loadFailed?<ShopState kind="error" title="作品暂时无法读取" detail={error}>
      <button className="shop-button" onClick={()=>refresh(v=>v+1)}>重新加载</button>
    </ShopState>:mine&&!account?<section className="community-auth">
      <h2>相言账户</h2><p>登录后可以保存设计、发布作品和查看报价。</p>
      <AccountForm key={intent} pageMode={intent==='register'?'register':'login'} onSuccess={loggedIn}/>
    </section>:<>
      {mine&&account&&<div className="community-actions">
        <button className="shop-button" onClick={()=>setUpload(!upload)} aria-expanded={upload}>{upload?'收起上传':'上传作品'}</button>
        <a className="shop-text-link" href="#/diy/collection">从款式开始设计</a></div>}
      {upload&&account&&mine&&<UploadWork expectedAccount={account.name} onAccountChanged={accountChanged} onSaved={()=>{setUpload(false);setNotice('作品已私密保存。');refresh(v=>v+1);}}/>}
      {!works.length&&!upload&&<ShopState title={mine?'你还没有保存作品。':'社区还没有公开作品。'}
        detail={mine?'挑一枚戒指开始搭配，保存后可以在这里查看和分享。':'把你的珠宝搭配分享给社区，让别人也能发现它。'}>
        <a className="shop-button" href={mine?'#/diy/collection':'#/my-designs?upload=1'}>{mine?'浏览款式':'上传第一件作品'}</a>
      </ShopState>}
      {works.length>0&&<div className="community-grid">{works.map(work=><article key={work.id} className="community-work">
        <button className="community-picture" aria-label={'预览'+work.title} onClick={()=>setPreview(work)}>
          <img loading="lazy" src={work.image} alt={work.title}/></button>
        <div className="community-work-info"><div><h2>{work.title}</h2>
          <small>{mine?(work.published?'已公开':'仅自己可见'):work.author}</small></div>
          <button className="shop-text-link" disabled={busy} onClick={()=>mine?(work.published?changeVisibility(work):setPublish(work)):startRequest(work)}>
            {mine?(work.published?'转为私密':'发布作品'):'申请同款'}</button></div>
      </article>)}</div>}
      {!mine&&works.length>0&&<p className="community-note">同款申请由工作室核价，提交时无需付款。</p>}
      {mine&&account&&<OrderHistory key={account.name} orders={orders} accountName={account.name}
        onAccountChanged={accountChanged} onRefresh={()=>refresh(v=>v+1)}/>}
    </>}
    {requestWork&&<WorkRequestDialog key={requestWork.id} work={requestWork} account={account??null} onLogin={setAccount}
      onClose={()=>setRequestWork(undefined)} onAccountChanged={accountChanged} onWithdrawn={withdrawn}/>}
    {preview&&<ReviewDialog title={preview.title} onClose={()=>setPreview(undefined)}>
      <img className="community-large-preview" src={preview.image} alt={preview.title}/>
      {mine&&account&&preview.design&&<Suspense fallback={<p role="status">正在读取配置…</p>}><PrivateDesignSummary work={preview}/></Suspense>}
      <div className="community-actions">{!mine&&<button className="shop-button" onClick={()=>startRequest(preview)}>申请同款</button>}
        <button className="shop-text-link" onClick={()=>setPreview(undefined)}>关闭预览</button></div></ReviewDialog>}
    {publish&&<ReviewDialog title="发布到设计社区" busy={busy} onClose={()=>setPublish(undefined)}>
      <img className="community-dialog-preview" src={publish.image} alt={publish.title}/>
      <p>所有访客都能看到「{publish.title}」和这张预览图，包括图上可见的刻字。账号资料和详细配置保持私密。</p>
      {error&&<p role="alert">{error}</p>}
      <div className="community-actions"><button disabled={busy} className="shop-button" onClick={()=>changeVisibility(publish)}>确认发布</button>
      <button disabled={busy} onClick={()=>setPublish(undefined)}>取消</button></div></ReviewDialog>}
  </main>;
}
