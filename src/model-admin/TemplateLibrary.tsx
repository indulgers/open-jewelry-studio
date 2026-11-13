import {lazy,Suspense,useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {templateRoute,type LibrarySource,type ManagedTemplate,type PublishedTemplate,type TemplateDraft,type TemplateSelection} from '../stone-first/reference/managed-types';

import ComponentLibrary from './ComponentLibrary';
import type {CatalogRing} from '../stone-first/catalog';
import {templateQuote,ZERO_COMPONENT_PRICES,type PriceBook} from '../stone-first/pricing';
import {formatYuan} from '../stone-first/ring02/demoOrder';

const Preview=lazy(()=>import('../stone-first/reference/ManagedTemplateStudio').then(module=>({default:module.ManagedTemplateStudio})));
const empty:TemplateSelection={name:'',head:'',headStones:'',band:'',pave:''};
const pendingReview={status:'pending' as const,minDiameter:null,maxDiameter:null,step:null,note:''};
type Publication=PublishedTemplate&{hidden?:boolean;stateRevision?:string};
type History={revision:string;name:string;publishedAt:string;current:boolean};
type Library={sources:LibrarySource[];drafts:TemplateDraft[];published:Publication[];cloud:boolean;prices?:PriceBook;catalog?:CatalogRing[];versionManagement?:boolean};
type Request=<T>(path:string,init?:RequestInit)=>Promise<T>;
const errorText=(error:unknown)=>error instanceof Error?error.message:'操作失败，请重试。';
const post=(data:object)=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});

export default function TemplateLibrary({request,tab}:{request:Request;tab:'parts'|'templates'}){
  const [originals,setOriginals]=useState(false);
  const [editing,setEditing]=useState(false);
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('all');
  const [history,setHistory]=useState<History[]>();
  const [visibilityConfirm,setVisibilityConfirm]=useState(false);
  const [library,setLibrary]=useState<Library>();
  const [saved,setSaved]=useState<TemplateDraft>();
  const [form,setForm]=useState(empty);
  const [preview,setPreview]=useState<ManagedTemplate>();
  const [ready,setReady]=useState(false);
  const thumbnail=useRef<(()=>string|undefined)|null>(null);
  const onReady=useCallback((frame:unknown)=>setReady(!!frame),[]);
  const [confirm,setConfirm]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [status,setStatus]=useState('');
  useEffect(()=>{
    const controller=new AbortController();
    request<Library>('/library',{signal:controller.signal}).then(setLibrary).catch(error=>{
      if(!controller.signal.aborted)setError(errorText(error));
    });
    return ()=>controller.abort();
  },[request]);
  function open(draft?:TemplateDraft){
    setEditing(true);setHistory(undefined);setVisibilityConfirm(false);
    setSaved(draft);setForm(draft?{...draft,pricing:undefined}:empty);setPreview(undefined);setConfirm(false);setStatus('');setError('');
  }
  function update(values:Partial<TemplateSelection>){
    setForm(current=>({...current,...values,...(values.head||values.band?{review:{...current.review??pendingReview,status:'pending' as const}}:{})}));setPreview(undefined);setConfirm(false);setStatus('');
  }
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setBusy(true);setError('');
    try{
      const draft=await request<TemplateDraft>('/templates',post({...form,id:saved?.id,expectedRevision:saved?.revision}));
      open(draft);
      setLibrary(current=>current&&({...current,drafts:[draft,...current.drafts.filter(item=>item.id!==draft.id)]}));
      setStatus('草稿已保存。');
    }catch(error){setError(errorText(error));}finally{setBusy(false);}
  }
  function currentPricing(){
    if(form.basePrice===undefined)return undefined;
    const head=library?.sources.find(item=>item.id===form.head)?.surcharges??ZERO_COMPONENT_PRICES;
    const band=library?.sources.find(item=>item.id===form.band)?.surcharges??ZERO_COMPONENT_PRICES;
    return {base:form.basePrice,head:head.head,band:band.band,pave:form.pave?band.pave:0};
  }
  const dirty=!saved||form.basePrice!==saved.basePrice||(form.basePrice!==undefined&&JSON.stringify(currentPricing())!==JSON.stringify(saved.pricing))||Object.keys(empty).some(key=>form[key as keyof TemplateSelection]!==saved[key as keyof TemplateSelection])||JSON.stringify(form.review)!==JSON.stringify(saved.review);
  async function loadPreview(){
    if(!saved||dirty)return;
    setBusy(true);setError('');setReady(false);
    try{
      setPreview(await request<ManagedTemplate>('/templates/'+saved.id+'/'+saved.revision));
    }catch(error){setError(errorText(error));}finally{setBusy(false);}
  }
  async function publish(){
    if(!saved||dirty||!ready||preview?.revision!==saved.revision)return;
    setBusy(true);setError('');
    try{
      const image=thumbnail.current?.();
      if(!image)throw new Error('暂时无法生成款式图，请重新预览。');
      const published=await request<PublishedTemplate>('/templates/'+saved.id+'/'+saved.revision+'/publish',post({confirmed:true,image}));
      setLibrary(await request<Library>('/library'));
      setHistory(undefined);setConfirm(false);setStatus('版本已发布。款式的上下架状态保持当前设置。');
    }catch(error){setError(errorText(error));}finally{setBusy(false);}
  }

  async function changeVisibility(current:Publication){
    setBusy(true);setError('');
    try{
      await request('/templates/'+current.id+'/visibility',post({hidden:!current.hidden,expectedState:current.stateRevision??current.revision}));
      setLibrary(await request<Library>('/library'));
      setVisibilityConfirm(false);setStatus(current.hidden?'已恢复上架。':'已下架。');
    }catch(error){setError(errorText(error));}finally{setBusy(false);}
  }
  async function loadHistory(){
    if(!saved)return;
    setBusy(true);setError('');
    try{setHistory(await request<History[]>('/templates/'+saved.id+'/history'));}
    catch(error){setError(errorText(error));}finally{setBusy(false);}
  }

  if(!library)return <main>{error?<p role="alert">{error}</p>:<p role="status">正在读取部件库…</p>}</main>;
  const {sources,drafts,published}=library;
  const prices=library.prices??{revision:'initial',components:{},bases:{}};
  if(tab==='parts'||originals)return <ComponentLibrary key={tab} sources={sources} catalog={library.catalog??[]} prices={prices} originals={tab==='templates'} onBack={tab==='templates'?()=>setOriginals(false):undefined} onSave={async book=>{
    const updated=await request<PriceBook>('/prices',post({...book,expectedRevision:prices.revision}));
    setLibrary(current=>current&&({...current,prices:updated,sources:current.sources.map(source=>({...source,surcharges:updated.components[source.id]}))}));
  }}/>;

  const head=sources.find(item=>item.id===form.head);
  const band=sources.find(item=>item.id===form.band);
  const current=published.find(item=>item.id===saved?.id);
  const state=(draft:TemplateDraft)=>{
    const release=published.find(item=>item.id===draft.id);
    return release?.hidden?'已下架':release?draft.revision===release.revision?'已发布':'已发布 · 有新草稿':'草稿';
  };
  const matching=drafts.filter(draft=>{
    const release=published.find(item=>item.id===draft.id);
    return draft.name.toLowerCase().includes(query.toLowerCase())&&(filter==='all'||
      (filter==='draft'&&draft.revision!==release?.revision)||(filter==='published'&&release&&!release.hidden)||(filter==='hidden'&&release?.hidden));
  });
  if(!editing)return <main>
    <header className="page-heading"><div><h1>商品管理</h1><p>组合部件、维护价格，预览后发布为商品。</p></div>
      <div className="template-actions"><button onClick={()=>setOriginals(true)}>原款定价</button><button className="primary" onClick={()=>open()}>新建商品</button></div></header>
    <div className="library-toolbar"><input aria-label="搜索款式" placeholder="搜索款式名称" value={query} onChange={e=>setQuery(e.target.value)}/>
      <select aria-label="款式状态" value={filter} onChange={e=>setFilter(e.target.value)}>
        <option value="all">全部状态</option><option value="published">已发布</option><option value="draft">有草稿</option><option value="hidden">已下架</option>
      </select></div>
    <div className="template-list">{matching.map(draft=>{
      const release=published.find(item=>item.id===draft.id);
      return <button key={draft.id} className="template-row" onClick={()=>open(draft)}>
        {release&&!release.hidden?<img src={release.image} alt="" width="64" height="64"/>:<span className="template-placeholder">戒指</span>}
        <span><strong>{draft.name}</strong><small>{new Date(draft.updatedAt).toLocaleString('zh-CN')}</small></span>
        <span className="template-state">{state(draft)}{release?.pricing&&<small>{formatYuan(templateQuote(release.pricing,release.revision).amount)}</small>}</span><span>编辑 →</span>
      </button>;
    })}{!matching.length&&<p className="empty">没有符合条件的款式。</p>}</div>
  </main>;
  const sourceOptions=sources.map(item=><option key={item.id} value={item.id}>
    {item.name}{item.stock?'':' · '+item.revision.slice(0,8)}
  </option>);
  return <main>
    <header className="page-heading"><div><h1>商品管理</h1><p>保存草稿不会改变线上商品，确认发布后价格与款式一起生效。</p></div>
      <button disabled={busy} onClick={()=>{if(!dirty||window.confirm('离开后会丢弃尚未保存的修改。继续返回？'))setEditing(false);}}>返回款式列表</button>
    </header>
    {error&&<p role="alert" className="error">{error}</p>}
    <div className="template-detail">
      <article className="review">
        {current&&<section className="release-status"><strong>{current.hidden?'已下架':'线上版本'} · {current.name}</strong>
          <p>保存修改会生成新草稿，确认发布后才替换当前版本。</p>
          {library.versionManagement&&<div className="template-actions">
            <button disabled={busy} onClick={()=>setVisibilityConfirm(true)}>{current.hidden?'恢复上架':'下架款式'}</button>
            <button disabled={busy} onClick={loadHistory}>版本记录</button>
          </div>}
          {visibilityConfirm&&<div className="publish-confirm"><p>{current.hidden?'恢复最后确认发布的版本，草稿继续保留。':'下架后，公开目录和款式链接将不可访问。已保存的版本继续保留。'}</p>
            <button disabled={busy} onClick={()=>changeVisibility(current)}>{current.hidden?'确认恢复':'确认下架'}</button>
            <button disabled={busy} onClick={()=>setVisibilityConfirm(false)}>取消</button></div>}
          {history&&<ol className="version-history">{history.map(item=><li key={item.revision}>
            <strong>{item.name}</strong> · {item.current?'当前发布版本':'历史发布版本'} · {new Date(item.publishedAt).toLocaleString('zh-CN')}
            <small>版本 {item.revision.slice(0,8)}</small></li>)}</ol>}
        </section>}
        <form className="template-form" onSubmit={save}>
          <fieldset disabled={busy}>
            <label>款式名称<input value={form.name} required maxLength={60} onChange={event=>update({name:event.target.value})}/></label>
            <label>戒头<select required value={form.head} onChange={event=>update({head:event.target.value,headStones:event.target.value})}>
              <option value="">选择戒头</option>{sourceOptions}
            </select></label>
            <label>戒圈<select required value={form.band} onChange={event=>{
              const id=event.target.value;
              update({band:id,pave:sources.some(item=>item.id===id&&item.assets.pave)?id:''});
            }}><option value="">选择戒圈</option>{sourceOptions}</select></label>
          </fieldset>
          {(head||band)&&<p className="selection-note">主石与戒头配钻随戒头配套。{band?.assets.pave?'戒圈包含配套铺钻。':'当前戒圈为素面。'}</p>}
          <section className="product-pricing" aria-label="商品定价">
            <h2>商品定价</h2><label>模板基础价（元）<input type="number" min="0" max="1000000" step="0.01" required disabled={busy} value={form.basePrice??''} onChange={e=>update({basePrice:e.target.value===''?undefined:e.target.valueAsNumber})}/></label>
            <dl>{(['head','band','pave'] as const).map((key,index)=><div key={key}><dt>{['戒头加价','戒圈加价','铺钻加价'][index]}</dt><dd>{formatYuan(currentPricing()?.[key]??0)}</dd></div>)}</dl>
            <p>商品参考价 <strong>{currentPricing()?formatYuan(templateQuote(currentPricing()!,'draft').amount):'请填写基础价'}</strong></p><small>部件加价在部件管理中维护，发布时锁定本版价格。</small>
          </section>
          <details className="review-rules">
            <summary>规则与工艺复核 · {form.review?.status==='approved'?'已通过':form.review?.status==='rejected'?'不通过':'待人工确认'}</summary>
            <p>复核当前戒头、戒圈及配钻组合。更换部件后，需要重新确认。</p>
            <fieldset disabled={busy}>
              <label>组合复核状态<select value={form.review?.status??'pending'} onChange={e=>update({review:{...form.review??pendingReview,status:e.target.value as 'pending'|'approved'|'rejected'}})}>
                <option value="pending">待人工确认</option><option value="approved">工艺复核通过</option><option value="rejected">组合不通过</option>
              </select></label>
              {([['minDiameter','最小内径（mm）'],['maxDiameter','最大内径（mm）'],['step','档位步长（mm）']] as const).map(([key,label])=><label key={key}>{label}
                <input type="number" step="any" min="0.001" value={form.review?.[key]??''} onChange={e=>update({review:{...form.review??pendingReview,[key]:e.target.value===''?null:Number(e.target.value)}})}/>
              </label>)}
              <label>工艺依据与备注<textarea maxLength={2000} rows={3} value={form.review?.note??''} placeholder="填写验证样品、尺寸依据、接合限制或需要人工确认的事项"
                onChange={e=>update({review:{...form.review??pendingReview,note:e.target.value}})}/></label>
            </fieldset>
            <p className="selection-note">未确认的尺寸请留空。此处登记允许的制作范围，3D 按原模型展示。</p>
          </details>
          <div className="template-actions">
            <button className="primary" disabled={busy||!dirty}>保存草稿</button>
            <button type="button" disabled={busy||dirty||!!preview} onClick={loadPreview}>在编辑器预览</button>
            {current&&!current.hidden&&<a href={'/'+templateRoute(current.id,current.revision)} target="_blank" rel="noreferrer">查看线上版本</a>}
          </div>
        </form>
        {status&&<p role="status">{status}</p>}
        {preview&&<div className="template-preview">
          <Suspense fallback={<p role="status">正在打开编辑器…</p>}>
            <Preview key={preview.revision} template={preview} onReady={onReady} thumbnailRef={thumbnail}/>
          </Suspense>
          {!confirm?<button type="button" className="primary" disabled={!ready||busy||current?.revision===preview.revision}
            onClick={()=>setConfirm(true)}>{current?'发布新版本':'发布模板'}</button>:<div className="publish-confirm">
            <p>确认发布「{preview.name}」的当前预览版本？{current?.hidden?'款式会保持下架，恢复上架后展示此版本。':current?'线上款式将替换为此版本，历史版本仍会保留。':'发布后会显示在全部款式。'}</p>
            <button type="button" className="primary" disabled={busy} onClick={publish}>确认发布</button>
            <button type="button" disabled={busy} onClick={()=>setConfirm(false)}>继续复核</button>
          </div>}
        </div>}
      </article>
    </div>
  </main>;
}
