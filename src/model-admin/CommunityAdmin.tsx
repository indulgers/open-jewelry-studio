import {useEffect,useState} from 'react';
import {UploadWork} from '../community/UploadWork';
import {communityRequest,errorText,type Order,type Work} from '../community/client';
import '../community/community.css';

type ReceivedOrder=Order&{accountName:string;accountId:string;image:string;templateId?:string;revision?:string;design?:object};
export function CommunityAdmin(){
  const [works,setWorks]=useState<Work[]>([]),[orders,setOrders]=useState<ReceivedOrder[]>([]);
  const [epoch,setEpoch]=useState(0),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[uploading,setUploading]=useState(false);
  const reload=()=>setEpoch(v=>v+1);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError('');
    Promise.all([communityRequest<Work[]>('admin/designs',undefined,controller.signal),
      communityRequest<ReceivedOrder[]>('admin/orders',undefined,controller.signal)]).then(([designs,receipts])=>{
      if(!controller.signal.aborted){setWorks(designs);setOrders(receipts);}
    }).catch(e=>{if(!controller.signal.aborted)setError(errorText(e));})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[epoch]);
  async function change(work:Work){
    setError('');setBusy(true);
    try{await communityRequest('admin/designs/'+work.id+'/'+(work.published?'unpublish':'publish'),{});
      setNotice(work.published?'作品已撤回。':'作品已公开。');reload();}
    catch(e){setError(errorText(e));}finally{setBusy(false);}
  }
  async function processOrder(order:ReceivedOrder,status:'已受理'|'已关闭'){
    setError('');setBusy(true);
    try{const path='admin/orders/'+order.accountId+'/'+order.id+'/status';
      await communityRequest(path,{expected:order.status,status});setNotice('申请状态已更新。');reload();}
    catch(e){setError(errorText(e));}finally{setBusy(false);}
  }
  return <main className="model-assets-page community-admin">
    <header className="page-heading"><h1>设计社区</h1><button className="primary" onClick={()=>setUploading(v=>!v)}>{uploading?'收起上传':'上传工作室作品'}</button></header>
    {uploading&&<UploadWork admin onSaved={()=>{setUploading(false);setNotice('作品已保存为草稿。');reload();}}/>}
    {notice&&<p role="status">{notice}</p>}
    {error&&<p className="error" role="alert">{error} <button onClick={reload}>重试</button></p>}
    {loading?<p role="status">正在读取作品与申请…</p>:!error&&<>
      <h2>工作室作品</h2>
      {!works.length?<p>还没有工作室作品。</p>:<div className="studio-work-grid">{works.map(work=><article key={work.id}>
        <img loading="lazy" src={work.image} alt={work.title}/><h3>{work.title}</h3>
        <p>{work.published?'社区公开':'仅后台可见'}</p>
        <button disabled={busy} onClick={()=>change(work)}>{work.published?'撤回作品':'发布到社区'}</button>
      </article>)}</div>}
      <h2>同款申请</h2>
      {!orders.length?<p>消费者提交后，可在这里查看编号、来源作品和待核价配置。</p>:orders.map(o=><details className="community-receipt" key={o.id}>
        <summary>{o.title} · {o.accountName} · {o.status}</summary>
        <img loading="lazy" src={o.image} alt={o.title+'申请时的预览'}/>
        <p>申请编号 {o.id}</p><p>提交时间 {new Date(o.createdAt).toLocaleString('zh-CN')}</p>
        {o.templateId&&<p>来源款式 {o.templateId} {o.revision}</p>}
        {o.status==='待人工核价'&&<button disabled={busy} onClick={()=>processOrder(o,'已受理')}>受理申请</button>}
        {o.status==='已受理'&&<button disabled={busy} onClick={()=>processOrder(o,'已关闭')}>结束处理</button>}
        {o.design&&<details><summary>已冻结的设计配置</summary><pre>{JSON.stringify(o.design,null,2)}</pre></details>}
      </details>)}
    </>}
  </main>;
}
