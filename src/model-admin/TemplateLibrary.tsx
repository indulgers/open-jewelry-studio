import {lazy,Suspense,useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {templateRoute,type LibrarySource,type ManagedTemplate,type PublishedTemplate,type TemplateDraft,type TemplateSelection} from '../stone-first/reference/managed-types';

import AssetPreview from './AssetPreview';

const Preview=lazy(()=>import('../stone-first/reference/ManagedTemplateStudio').then(module=>({default:module.ManagedTemplateStudio})));
const empty:TemplateSelection={name:'',head:'',headStones:'',band:'',pave:''};
const labels={head:'戒头',band:'戒圈',headStones:'主石及戒头配钻',pave:'戒臂铺钻',adapter:'接合件'} as const;
type Library={sources:LibrarySource[];drafts:TemplateDraft[];published:PublishedTemplate[];cloud:boolean};
type Request=<T>(path:string,init?:RequestInit)=>Promise<T>;
const errorText=(error:unknown)=>error instanceof Error?error.message:'操作失败，请重试。';
const post=(data:object)=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});

export default function TemplateLibrary({request,tab}:{request:Request;tab:'parts'|'templates'}){
  const [asset,setAsset]=useState<{title:string;url:string}>();
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
    setSaved(draft);setForm(draft??empty);setPreview(undefined);setConfirm(false);setStatus('');setError('');
  }
  function update(values:Partial<TemplateSelection>){
    setForm(current=>({...current,...values}));setPreview(undefined);setConfirm(false);setStatus('');
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
  const dirty=!saved||Object.keys(empty).some(key=>form[key as keyof TemplateSelection]!==saved[key as keyof TemplateSelection]);
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
      setLibrary(current=>current&&({...current,published:[published,...current.published.filter(item=>item.id!==published.id)]}));
      setConfirm(false);setStatus('已发布，可以在「全部款式」中查看。');
    }catch(error){setError(errorText(error));}finally{setBusy(false);}
  }

  if(!library)return <main>{error?<p role="alert">{error}</p>:<p role="status">正在读取部件库…</p>}</main>;
  const {sources,drafts,published}=library;
  if(tab==='parts')return <main>
    <header className="page-heading"><div><h1>部件库</h1><p>原款与已复核的导入版本都可用于组合模板。</p></div>
      <p>{library.cloud?'Cloudflare R2 私有存储':'本机存储 · R2 未配置'}</p>
    </header>
    <div className="part-inventory">{sources.map(item=><article className="review" key={item.id}>
      <h2>{item.name}</h2><p>{item.stock?'已发布原款':'复核版本 '+item.revision.slice(0,8)}</p>
      <div className="downloads">
        <button type="button" onClick={()=>setAsset({title:item.name+' · 整戒',url:item.model})}>预览整戒</button>
        <a href={item.source}>下载源 OBJ</a><a href={item.model} download>整戒 GLB</a>
        {item.editor&&<a href={'/'+item.editor} target="_blank" rel="noreferrer">打开原款编辑器</a>}
      </div>
      <div className="downloads">{Object.entries(labels).map(([key,label])=>{
        const path=item.assets[key as keyof typeof labels];
        return path&&<span className="part-asset-actions" key={key}>
          <button type="button" onClick={()=>setAsset({title:item.name+' · '+label,url:path})}>预览{label}</button>
          <a href={path} download aria-label={'下载'+label+' GLB'}>下载</a>
        </span>;
      })}</div>
    </article>)}</div>
    {asset&&<AssetPreview asset={asset} onClose={()=>setAsset(undefined)}/>}
  </main>;

  const head=sources.find(item=>item.id===form.head);
  const band=sources.find(item=>item.id===form.band);
  const current=published.find(item=>item.id===saved?.id);
  const sourceOptions=sources.map(item=><option key={item.id} value={item.id}>
    {item.name}{item.stock?'':' · '+item.revision.slice(0,8)}
  </option>);
  return <main>
    <header className="page-heading"><div><h1>款式模板</h1><p>选择部件，保存草稿，在编辑器核对后发布。</p></div>
      <button className="primary" disabled={busy} onClick={()=>open()}>新建模板</button>
    </header>
    {error&&<p role="alert" className="error">{error}</p>}
    <div className="workspace">
      <aside aria-label="已保存模板"><h2>已保存模板 <span>{drafts.length}</span></h2>
        {drafts.map(draft=><button type="button" key={draft.id} disabled={busy} aria-current={draft.id===saved?.id?'true':undefined}
          onClick={()=>open(draft)}><strong>{draft.name}</strong><small>{published.some(item=>item.revision===draft.revision)?'已发布':'草稿'}</small></button>)}
      </aside>
      <article className="review">
        <form className="template-form" onSubmit={save}>
          <fieldset disabled={busy}>
            <label>款式名称<input value={form.name} required maxLength={60} onChange={event=>update({name:event.target.value})}/></label>
            <label>戒头<select required value={form.head} onChange={event=>update({head:event.target.value,headStones:''})}>
              <option value="">选择戒头</option>{sourceOptions}
            </select></label>
            <label>主石及戒头配钻<select required value={form.headStones} onChange={event=>update({headStones:event.target.value})}>
              <option value="">选择配套宝石</option>{head&&<option value={head.id}>{head.name} · 配套宝石</option>}
            </select></label>
            <label>戒圈<select required value={form.band} onChange={event=>{
              const id=event.target.value;
              update({band:id,pave:sources.some(item=>item.id===id&&item.assets.pave)?id:''});
            }}><option value="">选择戒圈</option>{sourceOptions}</select></label>
            <label>戒臂铺钻<select value={form.pave} disabled={!band?.assets.pave} onChange={event=>update({pave:event.target.value})}>
              {band?.assets.pave?<option value={band.id}>{band.name} · 配套铺钻</option>:<option value="">无铺钻</option>}
            </select></label>
          </fieldset>
          <div className="template-actions">
            <button className="primary" disabled={busy||!dirty}>保存草稿</button>
            <button type="button" disabled={busy||dirty||!!preview} onClick={loadPreview}>在编辑器预览</button>
            {current&&<a href={'/'+templateRoute(current.id,current.revision)} target="_blank" rel="noreferrer">查看已发布版本</a>}
          </div>
        </form>
        {status&&<p role="status">{status}</p>}
        {preview&&<div className="template-preview">
          <Suspense fallback={<p role="status">正在打开编辑器…</p>}>
            <Preview key={preview.revision} template={preview} onReady={onReady} thumbnailRef={thumbnail}/>
          </Suspense>
          {!confirm?<button type="button" className="primary" disabled={!ready||busy||current?.revision===preview.revision}
            onClick={()=>setConfirm(true)}>发布模板</button>:<div className="publish-confirm">
            <p>确认发布「{preview.name}」的当前预览版本？发布后会显示在全部款式。</p>
            <button type="button" className="primary" disabled={busy} onClick={publish}>确认发布</button>
            <button type="button" disabled={busy} onClick={()=>setConfirm(false)}>继续复核</button>
          </div>}
        </div>}
      </article>
    </div>
  </main>;
}
