import {useEffect,useRef,useState,type FormEvent} from 'react';
import {UploadWork} from '../community/UploadWork';
import {communityRequest,errorText,quoteAmount,type Order,type Work} from '../community/client';
import {maxQuoteFen,type OrderStatus} from '../community/order-quote';
import '../community/community.css';
import '../community/order-quote.css';

type ReceivedOrder=Order&{accountName:string;accountId:string;image:string;templateId?:string;revision?:string;design?:object};
const orderStatuses:OrderStatus[]=['待人工核价','已受理','已报价','已下单','已关闭'];
const displayStatus=(status:OrderStatus)=>status==='已下单'?'已下单 · 未支付':status;
function hasRecordedPrice(quote:Order['quote']):quote is NonNullable<Order['quote']>{
  return quote?.currency==='CNY'&&Number.isSafeInteger(quote.amountFen)&&quote.amountFen>0;
}

function AdminOrderCard({order,onUpdate,onReload}:{order:ReceivedOrder;onUpdate:(order:Order)=>void;onReload:()=>void}){
  const [mode,setMode]=useState<'view'|'quote'|'close'>('view');
  const [error,setError]=useState(''),[outdated,setOutdated]=useState(false),[busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const pending=useRef(false);
  const path='admin/orders/'+order.accountId+'/'+order.id;
  const canQuote=order.status==='已受理'||order.status==='已报价';
  async function submit(action:'quote'|'status',body:object){
    if(pending.current||outdated)return;
    pending.current=true;
    setError('');setNotice('');setBusy(true);
    try{
      const updated=await communityRequest<Order>(path+'/'+action,{expected:order.status,...body});
      setMode('view');
      setNotice(action==='quote'?'报价已发送。':'申请状态已更新。');
      onUpdate(updated);
    }catch(cause){
      setError(errorText(cause));
      setOutdated(true);
    }finally{pending.current=false;setBusy(false);}
  }
  function sendQuote(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const data=new FormData(event.currentTarget);
    const amount=String(data.get('amount')).trim();
    const description=String(data.get('description')).trim();
    const parts=/^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(amount);
    const amountFen=parts?Number(parts[1])*100+Number((parts[2]??'').padEnd(2,'0')):0;
    if(amountFen<1||amountFen>maxQuoteFen){setError('请输入 0.01 至 '+(maxQuoteFen/100).toLocaleString('zh-CN')+' 元，保留最多两位小数。');return;}
    if(!description||description.length>500){setError('请用 1 至 500 字说明本件作品的配置和报价包含的费用。');return;}
    void submit('quote',{amountFen,description,expectedQuoteVersion:order.quote?.version??null});
  }
  function edit(next:typeof mode){setMode(next);if(!outdated)setError('');setNotice('');}
  return <details className="community-receipt">
    <summary>{order.title} · {order.accountName} · {displayStatus(order.status)}</summary>
    <img loading="lazy" src={order.image} alt={order.title+'申请时的预览'}/>
    <p>申请编号 {order.id}</p><p>提交时间 {new Date(order.createdAt).toLocaleString('zh-CN')}</p>
    {order.templateId&&<p>来源款式 {order.templateId} {order.revision}</p>}
    {order.design&&<details><summary>已冻结的设计配置</summary><pre>{JSON.stringify(order.design,null,2)}</pre></details>}
    {hasRecordedPrice(order.quote)&&<div className="order-quote-details"><div><span>一件报价</span><strong>{quoteAmount(order.quote)}</strong></div>
      <p>{order.quote.description}</p></div>}
    {order.orderedAt&&<p>下单时间 {new Date(order.orderedAt).toLocaleString('zh-CN')}</p>}
    {notice&&<p role="status">{notice}</p>}
    {error&&<p className="error" role="alert">{error} {outdated&&<button onClick={onReload}>重新读取申请</button>}</p>}
    {order.status==='待人工核价'&&<button disabled={busy||outdated} onClick={()=>submit('status',{status:'已受理'})}>受理申请</button>}
    {canQuote&&mode==='view'&&<div className="community-actions"><button className="primary" disabled={busy||outdated} onClick={()=>edit('quote')}>{order.quote?'修改报价':'填写报价'}</button>
      <button disabled={busy||outdated} onClick={()=>edit('close')}>关闭申请</button></div>}
    {canQuote&&mode==='quote'&&<form className="quote-form" onSubmit={sendQuote}>
      <label>一件总价（人民币元）<input required name="amount" inputMode="decimal" defaultValue={order.quote?(order.quote.amountFen/100).toFixed(2):''}/></label>
      <label>款式配置与费用范围<textarea required name="description" maxLength={500} defaultValue={order.quote?.description}/></label>
      <div className="community-actions"><button type="submit" className="primary" disabled={busy||outdated}>{busy?'正在发送…':'发送报价'}</button>
        <button type="button" disabled={busy} onClick={()=>edit('view')}>取消</button></div>
    </form>}
    {canQuote&&mode==='close'&&<div>
      <p>关闭后，此申请将结束，消费者无法再按此申请下单。</p>
      <div className="community-actions"><button disabled={busy||outdated} onClick={()=>submit('status',{
        status:'已关闭',...(order.quote&&{expectedQuoteVersion:order.quote.version}),
      })}>确认关闭申请</button><button disabled={busy} onClick={()=>edit('view')}>取消</button></div>
    </div>}
  </details>;
}

function CommunityManager(){
  const [works,setWorks]=useState<Work[]>([]),[orders,setOrders]=useState<ReceivedOrder[]>([]);
  const [orderFilter,setOrderFilter]=useState('all');
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
  const counts=new Map<OrderStatus,number>();
  let confirmedFen=0,missingPrices=0;
  for(const order of orders){
    counts.set(order.status,(counts.get(order.status)??0)+1);
    if(order.status==='已下单'){
      if(hasRecordedPrice(order.quote))confirmedFen+=order.quote.amountFen;
      else missingPrices++;
    }
  }
  const visibleOrders=orderFilter==='all'?orders:orders.filter(order=>order.status===orderFilter);
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
      <div className="admin-order-tools">
        <label>申请状态<select value={orderFilter} onChange={event=>setOrderFilter(event.target.value)}>
          <option value="all">全部（{orders.length}）</option>
          {orderStatuses.map(status=><option key={status} value={status}>{displayStatus(status)}（{counts.get(status)??0}）</option>)}
        </select></label>
        <div><p>已确认未付款金额（全部申请） <strong>{(confirmedFen/100).toLocaleString('zh-CN',{style:'currency',currency:'CNY'})}</strong></p>
          {missingPrices>0&&<small>{missingPrices} 笔已下单申请缺少有效报价，未计入合计。</small>}</div>
      </div>
      {!orders.length?<p>消费者提交后，可在这里查看编号、来源作品和待核价配置。</p>:!visibleOrders.length?
        <p>此状态下暂无申请。</p>:visibleOrders.map(o=><AdminOrderCard
        key={o.accountId+'/'+o.id} order={o} onReload={reload} onUpdate={updated=>{
          setOrders(previous=>previous.map(receipt=>receipt.accountId===o.accountId&&receipt.id===o.id?{...receipt,...updated}:receipt));
        }}/>)}

    </>}
  </main>;
}

type LocalAccess={admin:boolean;generated:boolean};
function LocalCommunityLogin(){
  const [access,setAccess]=useState<LocalAccess>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    communityRequest<LocalAccess>('local-admin-session',undefined,controller.signal).then(setAccess)
      .catch(e=>{if(!controller.signal.aborted)setError(errorText(e));});
    return ()=>controller.abort();
  },[attempt]);
  if(access?.admin)return <CommunityManager/>;
  return <main className="admin-login"><article className="review"><h1>社区管理登录</h1>
    {access?<form className="template-form" onSubmit={async event=>{
      event.preventDefault();if(busy)return;
      const password=new FormData(event.currentTarget).get('password');
      setBusy(true);setError('');
      try{await communityRequest('local-admin-session',{password});setAccess({...access,admin:true});}
      catch(e){setError(errorText(e));}finally{setBusy(false);}
    }}>
      <p>{access.generated?'本机管理员口令位于模型目录的 community-admin-password 文件。默认目录是 ~/.xiangyan-model-admin。':'请输入 XIANGYAN_ADMIN_PASSWORD 设置的本机管理员口令。'}</p>
      <label>社区管理员口令<input required type="password" name="password" autoComplete="current-password"/></label>
      <button className="primary" disabled={busy}>{busy?'正在登录…':'登录社区管理'}</button>
    </form>:!error&&<p role="status">正在检查管理权限…</p>}
    {error&&<p className="error" role="alert">{error} {!access&&<button onClick={()=>{setError('');setAttempt(v=>v+1);}}>重试</button>}</p>}
  </article></main>;
}
export function CommunityAdmin(){
  return import.meta.env.PROD||import.meta.env.VITE_CLOUD_MODE?<CommunityManager/>:<LocalCommunityLogin/>;
}
