import {addConfirmedRequestToCart} from './request-cart';
import {useEffect,useState} from 'react';
import {consumerRequest,recoveryCode,restoreGuest,downloadProduction} from './consumer-api';
import type {SavedDesign,DesignRequest} from './consumer-types';
import {PersonalImagePreview} from './reference/PersonalImage';
import {RING_CATALOG} from './catalog';
import {draftKey} from './reference/editor-history';
import {ReviewDialog} from './ring02/ReviewDialog';
import {formatYuan} from './ring02/demoOrder';
import './diy-home.css';
import './guest-designs.css';

export const REQUEST_STATUS={pending:'待人工确认','needs-information':'需要补充资料',declined:'暂不支持制作',quoted:'正式报价待你确认',confirmed:'方案与报价已确认'};
type Pointer={id:string;revision:string;revisions:string[];savedAt:string;name:string};
export default function GuestDesigns(){
  const [designs,setDesigns]=useState<Pointer[]>([]),[requests,setRequests]=useState<DesignRequest[]>([]);
  const [error,setError]=useState(''),[loading,setLoading]=useState(true),[attempt,setAttempt]=useState(0);
  const [code,setCode]=useState(''),[restore,setRestore]=useState(''),[shown,setShown]=useState(false);
  const [snapshot,setSnapshot]=useState<{design:SavedDesign;serverRevision:string}>(),[confirming,setConfirming]=useState<DesignRequest>();
  const [replies,setReplies]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError('');
    try{setCode(recoveryCode());}catch{setError('浏览器未允许保存恢复码，请开启本站存储权限。');setLoading(false);return;}
    Promise.all([consumerRequest<Pointer[]>('designs',undefined,controller.signal),consumerRequest<DesignRequest[]>('requests',undefined,controller.signal)])
      .then(([designs,requests])=>{if(!controller.signal.aborted){setDesigns(designs);setRequests(requests);}})
      .catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:'读取失败，请重试。');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[attempt]);
  async function load(item:Pointer,revision=item.revision){
    setBusy(true);setError('');
    try{setSnapshot({design:await consumerRequest<SavedDesign>('designs/'+item.id+'/'+revision),serverRevision:item.revision});}
    catch(error){setError(error instanceof Error?error.message:'读取失败，请重试。');}finally{setBusy(false);}
  }
  function openSnapshot(){
    if(!snapshot)return;
    const s=snapshot.design,template=RING_CATALOG.find(item=>item.id===s.templateId&&item.listed);
    const unavailable=[s.head,s.band].filter(part=>!RING_CATALOG.some(item=>item.listed&&item.id===part.id&&item.revision===part.revision));
    if(!template||unavailable.length){setError('原方案的款式或部件版本已更新/下架，不能直接恢复为可编辑方案。原方案与确认记录保留，可下载记录交由工作人员处理。');setSnapshot(undefined);return;}
    try{
      const key=draftKey(template.id),current=localStorage.getItem(key);
      if(current)localStorage.setItem(key+':previous',current);
      localStorage.setItem(key,JSON.stringify({id:s.id,design:s.design,revision:s.revision===snapshot.serverRevision?s.revision:crypto.randomUUID(),savedAt:new Date().toISOString(),server:{revision:snapshot.serverRevision,savedAt:s.savedAt}}));
      location.hash=template.editor;
    }catch{setError('本机未能备份当前草稿，暂未覆盖，请重试。');setSnapshot(undefined);}
  }
  async function confirmQuote(){
    if(!confirming)return;
    setBusy(true);setError('');
    try{
      const record=await consumerRequest<DesignRequest>('requests/'+confirming.id+'/confirm',{expectedRevision:confirming.stateRevision});
      setRequests(items=>items.map(item=>item.id===record.id?record:item));setConfirming(undefined);addConfirmedRequestToCart(record);setNotice('已确认本版本的方案、制作要求、正式报价和交期，并加入购物车。');
    }catch(error){setError(error instanceof Error?error.message:'确认失败，请重试。');}finally{setBusy(false);}
  }
  return <main className="shop-wrap guest-designs">
    <a className="shop-text-link" href="#/diy/collection">返回款式目录</a><h1>我的方案</h1><p>草稿和受理记录保存在服务器。请妥善保存恢复码，换设备时可找回。</p>
    <details className="guest-recovery"><summary>游客恢复码与找回方案</summary><p>持有恢复码的人可以查看和管理这些方案，请勿公开分享。切换恢复码不会删除本机草稿。</p>
      <button onClick={()=>setShown(!shown)}>{shown?'收起恢复码':'查看恢复码'}</button>{shown&&<><code>{code}</code><button onClick={()=>navigator.clipboard.writeText(code).then(()=>setNotice('恢复码已复制。')).catch(()=>setError('未能复制，请选中恢复码手动复制。'))}>复制恢复码</button></>}
      <form onSubmit={event=>{event.preventDefault();try{restoreGuest(restore);setRestore('');setSnapshot(undefined);setRequests([]);setDesigns([]);setAttempt(value=>value+1);}catch(error){setError(error instanceof Error?error.message:'恢复码无效。');}}}>
        <label>已有恢复码<input value={restore} onChange={event=>setRestore(event.target.value)} autoComplete="off" spellCheck={false} placeholder="XY-…"/></label><button disabled={!restore.trim()}>找回我的方案</button>
      </form>
    </details>
    {error&&<p role="alert">{error} <button disabled={loading} onClick={()=>setAttempt(value=>value+1)}>重新读取</button></p>}{notice&&<p role="status">{notice}</p>}
    {loading?<p role="status">正在读取服务器方案…</p>:<>
      <section><h2>已保存的设计</h2>{!designs.length?<p>还没有服务器草稿。在编辑器点击「保存方案」后会出现在这里。</p>:<div className="guest-card-grid">{designs.map(item=><article key={item.id}><h3>{item.name}</h3><p>保存于 {new Date(item.savedAt).toLocaleString('zh-CN')}</p><button disabled={busy} onClick={()=>load(item)}>查看与恢复</button><details><summary>已保存版本 · {item.revisions.length}</summary>{[...item.revisions].reverse().map((revision,index)=><button key={revision} disabled={busy} onClick={()=>load(item,revision)}>版本 {item.revisions.length-index}{revision===item.revision?' · 最新':''}</button>)}</details></article>)}</div>}</section>
      <section><h2>人工确认进度</h2>{!requests.length?<p>尚无受理申请。</p>:requests.map(item=><article className="guest-request" key={item.id}>
        {item.design.thumbnail&&<img src={item.design.thumbnail} alt={item.design.name+'提交方案'} width="160" height="160"/>}
        <div><h3>{item.design.name}</h3><p><strong>{REQUEST_STATUS[item.status]}</strong> · 申请编号 {item.id}</p><p>你提交的制作要求：{item.design.design.requestNote||'未填写'}</p><p>{item.note||'工作人员将核对材质、尺寸和制作工艺。正式报价确认前不能付款。'}</p>
          <p>提交版本 {item.design.revision} · {new Date(item.createdAt).toLocaleString('zh-CN')}</p>
          {item.quote&&<><p>正式报价 {formatYuan(item.quote.amount)} · 交期 {item.quote.leadTime} · 有效期至 {new Date(item.quote.validUntil).toLocaleString('zh-CN')}</p><p className="preserve-lines">{item.quote.productionRequirements}</p></>}
          {item.design.design.image&&<PersonalImagePreview image={item.design.design.image}/>}
          {item.quote?.lettering&&<p>刻字字体 {item.quote.lettering.fontId} · 版本 {item.quote.lettering.fontVersion} · 字高 {item.quote.lettering.heightMm} mm · 字宽 {item.quote.lettering.textWidthMm} mm · 可刻宽度 {item.quote.lettering.areaWidthMm} mm · 内圈{item.quote.lettering.direction==='forward'?'正向':'反向'} · {({left:'左对齐',center:'居中',right:'右对齐'})[item.quote.lettering.alignment]}</p>}
          {item.productionFile&&<button onClick={()=>downloadProduction(item.id,item.productionFile!.name).catch(error=>setError(error.message))}>下载生产文件 · {item.productionFile.name}</button>}
          <a download={'xiangyan-request-'+item.id+'.json'} href={'data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(item,null,2))}>下载本版本配置与处理记录</a>
          {item.status==='needs-information'&&<form onSubmit={async event=>{
            event.preventDefault();setBusy(true);setError('');
            try{const next=await consumerRequest<DesignRequest>('requests/'+item.id+'/reply',{expectedRevision:item.stateRevision,note:replies[item.id]??''});setRequests(items=>items.map(value=>value.id===item.id?next:value));setReplies(values=>({...values,[item.id]:''}));setNotice('补充说明已提交。');}catch(error){setError(error instanceof Error?error.message:'提交失败，请重试。');}finally{setBusy(false);}
          }}><label>补充说明<textarea required maxLength={4000} value={replies[item.id]??''} onChange={event=>setReplies(values=>({...values,[item.id]:event.target.value}))}/></label><p>补充说明不会改变设计；修改刻字、图片或款式，请恢复到编辑器并提交新版本。</p><button disabled={busy}>{busy?'正在提交…':'提交补充说明'}</button></form>}
          {item.status==='confirmed'&&<><button onClick={()=>{try{addConfirmedRequestToCart(item);setNotice('该确认方案已在购物车中。');}catch(error){setError(error instanceof Error?error.message:'购物车暂未保存，请重试。');}}}>将确认方案同步到本机购物车</button><a href="#/diy/cart">查看购物车</a></>}
          {item.status==='quoted'&&<button onClick={()=>setConfirming(item)}>核对方案与正式报价</button>}
          <details><summary>处理记录</summary>{item.history.map((event,index)=><p key={index}>{new Date(event.at).toLocaleString('zh-CN')} · {REQUEST_STATUS[event.status]} · {event.reviewer} {event.note}</p>)}</details>
        </div>
      </article>)}</section>
    </>}
    {snapshot&&<ReviewDialog title="恢复服务器方案？" onClose={()=>setSnapshot(undefined)}><p>{snapshot.design.name} · 保存于 {new Date(snapshot.design.savedAt).toLocaleString('zh-CN')}</p>{snapshot.design.thumbnail&&<img className="guest-snapshot" src={snapshot.design.thumbnail} alt="该版本保存时的方案截图"/>}<p>将恢复本版本的部件、宝石、排钻和刻字。本机已有草稿会先备份。恢复旧版本后的修改需重新检查和提交。</p><p>刻字「{snapshot.design.design.engraving||'未添加'}」</p><a download="xiangyan-design.json" href={'data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(snapshot.design,null,2))}>下载结构化配置</a><div className="ring02-dialog-actions"><button autoFocus onClick={()=>setSnapshot(undefined)}>取消</button><button onClick={openSnapshot}>恢复到编辑器</button></div></ReviewDialog>}
    {confirming&&<ReviewDialog title="确认制作方案与正式报价" busy={busy} onClose={()=>setConfirming(undefined)}><p>{confirming.design.name} · 版本 {confirming.design.revision}</p><p>刻字「{confirming.design.design.engraving||'未添加'}」</p>{confirming.quote?.lettering&&<p>内圈刻字 · 字体 {confirming.quote.lettering.fontId}（{confirming.quote.lettering.fontVersion}）· 字高 {confirming.quote.lettering.heightMm} mm · {confirming.quote.lettering.direction==='forward'?'正向':'反向'}</p>}{confirming.productionFile&&<button onClick={()=>downloadProduction(confirming.id,confirming.productionFile!.name).catch(error=>setError(error.message))}>核对生产文件 {confirming.productionFile.name}</button>}<p className="preserve-lines">{confirming.quote?.productionRequirements}</p><p>{formatYuan(confirming.quote!.amount)} · {confirming.quote?.leadTime} · 有效期至 {new Date(confirming.quote!.validUntil).toLocaleString('zh-CN')}</p><p>确认仅对应这份设计版本。后续更改需要重新复核和报价。</p>{error&&<p role="alert">{error} <button disabled={busy} onClick={()=>{setConfirming(undefined);setAttempt(value=>value+1);}}>重新读取报价</button></p>}<div className="ring02-dialog-actions"><button disabled={busy} autoFocus onClick={()=>setConfirming(undefined)}>返回核对</button><button disabled={busy} onClick={confirmQuote}>{busy?'正在确认…':'确认本版本与报价'}</button></div></ReviewDialog>}
  </main>;
}
