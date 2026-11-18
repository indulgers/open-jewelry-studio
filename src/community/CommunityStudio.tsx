import {lazy,Suspense,useEffect,useState} from 'react';
import {ReviewDialog} from '../stone-first/ring02/ReviewDialog';
import {AccountForm} from './AccountForm';
import {UploadWork} from './UploadWork';
import {CommunityAccountChanged,communityRequest,errorText,type Account,type Order,type Work} from './client';
import './community.css';

const PrivateDesignSummary=lazy(()=>import('./PrivateDesignSummary'));

type Mode='community'|'mine';
export default function CommunityStudio({mode}:{mode:Mode}){
  const mine=mode==='mine';
  const [account,setAccount]=useState<Account|null>();
  const [works,setWorks]=useState<Work[]>([]),[orders,setOrders]=useState<Order[]>([]);
  const [loading,setLoading]=useState(true),[version,refresh]=useState(0);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [auth,setAuth]=useState(false),[upload,setUpload]=useState(false);
  const [preview,setPreview]=useState<Work>(),[publish,setPublish]=useState<Work>();
  useEffect(()=>{
    const controller=new AbortController(),signal=controller.signal;
    setLoading(true);setAccount(undefined);setError('');setWorks([]);setOrders([]);
    setPreview(undefined);setPublish(undefined);setUpload(false);setAuth(false);
    async function load(){
      const session=await communityRequest<{account:Account|null}>('session',undefined,signal);
      const [items,requests]=await Promise.all([
        mine&&!session.account?[]:communityRequest<Work[]>(mine?'mine':'works',undefined,signal,mine?session.account?.name:undefined),
        mine&&session.account?communityRequest<Order[]>('orders',undefined,signal,session.account.name):[],
      ]);
      if(!signal.aborted){setAccount(session.account);setWorks(items);setOrders(requests);}
    }
    load().catch(cause=>{
      if(signal.aborted)return;
      if(!(cause instanceof CommunityAccountChanged))throw cause;
      setNotice('账号已变更，请核对当前账号后重新操作。');
      return load();
    }).catch(cause=>{if(!signal.aborted)setError(errorText(cause));})
      .finally(()=>{if(!signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[mine,version]);
  function loggedIn(user:Account){setAccount(user);setAuth(false);refresh(v=>v+1);}
  function accountChanged(){
    setAccount(undefined);setWorks([]);setOrders([]);setPreview(undefined);setPublish(undefined);
    setUpload(false);setAuth(false);setNotice('账号已变更，请核对当前账号后重新操作。');
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
  function order(work:Work){
    if(!account){setAuth(true);return;}
    void act(async()=>{
      const request=await communityRequest<Order>('works/'+work.id+'/orders',{expectedAccount:account.name});
      setNotice('已提交同款申请，编号 '+request.id+'。可在「我的设计」查看处理状态。');
    });
  }
  function changeVisibility(work:Work){
    if(!account)return;
    void act(async()=>{
      await communityRequest('designs/'+work.id+'/'+(work.published?'unpublish':'publish'),{expectedAccount:account.name});
      setPublish(undefined);setNotice(work.published?'作品已转为私密。':'作品已发布到社区。');refresh(v=>v+1);
    });
  }
  return <main className="community-page">
    <header className="community-heading"><div><h1>{mine?'我的设计':'设计社区'}</h1>
      <p>{mine?'查看保存的作品、发布记录和同款申请。':'浏览创作者发布的珠宝作品，选择心仪的设计申请制作。'}</p></div>
      <a className="shop-text-link" href={mine?'#/community':'#/my-designs'}>{mine?'浏览设计社区':'我的设计'}</a>
    </header>
    {!mine&&account&&<p className="community-account">当前账号 {account.name}</p>}
    {mine&&account&&<div className="community-account"><span>{account.name}</span><a href="#/diy/fit">佩戴资料与尺寸</a>
      <button disabled={busy} onClick={()=>void act(async()=>{
        await communityRequest('logout',{expectedAccount:account.name});setAccount(null);setWorks([]);setOrders([]);setPreview(undefined);setUpload(false);setPublish(undefined);refresh(v=>v+1);
      })}>退出登录</button></div>}
    {notice&&<p role="status" className="community-notice">{notice}</p>}
    {error&&<p role="alert" className="community-notice">{error} <button onClick={()=>refresh(v=>v+1)}>重新加载</button></p>}
    {loading?<p role="status">正在读取作品…</p>:mine&&!account&&!error?<AccountForm onSuccess={loggedIn}/>:<>
      {mine&&account&&<div className="community-actions">
        <button className="shop-button" onClick={()=>setUpload(!upload)} aria-expanded={upload}>{upload?'收起上传':'上传作品'}</button>
        <a className="shop-text-link" href="#/diy/collection">从款式开始设计</a></div>}
      {upload&&account&&mine&&<UploadWork expectedAccount={account.name} onAccountChanged={accountChanged} onSaved={()=>{setUpload(false);setNotice('作品已私密保存。');refresh(v=>v+1);}}/>}
      {!works.length&&!error&&<div className="community-empty"><p>{mine?'你还没有保存作品。':'社区还没有公开作品。'}</p>
        <a className="shop-text-link" href={mine?'#/diy/collection':'#/my-designs'}>{mine?'浏览款式':'上传第一件作品'}</a></div>}
      <div className="community-grid">{works.map(work=><article key={work.id} className="community-work">
        <button className="community-picture" aria-label={'预览'+work.title} onClick={()=>setPreview(work)}>
          <img loading="lazy" src={work.image} alt={work.title}/></button>
        <div className="community-work-info"><div><h2>{work.title}</h2>
          <small>{mine?(work.published?'已公开':'仅自己可见'):work.author}</small></div>
          <button className="shop-text-link" disabled={busy} onClick={()=>mine?(work.published?changeVisibility(work):setPublish(work)):order(work)}>
            {mine?(work.published?'转为私密':'发布作品'):'申请同款'}</button></div>
      </article>)}</div>
      {!mine&&works.length>0&&<p className="community-note">同款申请由工作室核价，提交时无需付款。</p>}
      {mine&&account&&<section className="community-orders"><h2>我的同款申请</h2>
        {orders.length?<ul>{orders.map(item=><li key={item.id}><strong>{item.title}</strong><span>{item.status}</span><small>受理编号 {item.id}</small></li>)}</ul>:<p>暂无同款申请。</p>}</section>}
    </>}
    {auth&&<ReviewDialog title="登录后申请同款" onClose={()=>setAuth(false)}><AccountForm onSuccess={loggedIn}/>
      <button className="shop-text-link" onClick={()=>setAuth(false)}>返回社区</button></ReviewDialog>}
    {preview&&<ReviewDialog title={preview.title} onClose={()=>setPreview(undefined)}>
      <img className="community-large-preview" src={preview.image} alt={preview.title}/>
      {mine&&account&&preview.design&&<Suspense fallback={<p role="status">正在读取配置…</p>}><PrivateDesignSummary work={preview}/></Suspense>}
      <button className="shop-text-link" onClick={()=>setPreview(undefined)}>关闭预览</button></ReviewDialog>}
    {publish&&<ReviewDialog title="发布到设计社区" busy={busy} onClose={()=>setPublish(undefined)}>
      <img className="community-dialog-preview" src={publish.image} alt={publish.title}/>
      <p>所有访客都能看到「{publish.title}」和这张预览图，包括图上可见的刻字。账号资料和详细配置保持私密。</p>
      {error&&<p role="alert">{error}</p>}
      <div className="community-actions"><button disabled={busy} className="shop-button" onClick={()=>changeVisibility(publish)}>确认发布</button>
      <button disabled={busy} onClick={()=>setPublish(undefined)}>取消</button></div></ReviewDialog>}
  </main>;
}
