import {useEffect, useState, type ChangeEvent, type FormEvent} from 'react';
import {createRoot} from 'react-dom/client';
import Review,{type ReviewModel as Model} from './ModelReview';
import TemplateLibrary from './TemplateLibrary';
import './model-admin.css';

const base = '/api/model-admin';
type Job = {id:string;filename:string;createdAt:string;size:number;exported?:boolean};
const errorText=(error:unknown)=>error instanceof Error?error.message:'操作失败，请重试。';
const hosted = (import.meta.env.PROD||import.meta.env.VITE_CLOUD_MODE);
const post = (data: object): RequestInit => ({
  method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data),
});

class AdminError extends Error {
  constructor(public status: number, message: string) {super(message);}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(base + path, init);
  if (!response.ok) {
    const data = await response.json().catch(() => undefined);
    throw new AdminError(response.status, data?.error ?? '模型库暂不可用。');
  }
  return response.status === 204 ? undefined as T : response.json();
}

async function uploadModel(file: File): Promise<Job> {
  if (!hosted) return request('', {
    method: 'POST',
    headers: {'Content-Type': 'application/octet-stream', 'X-Model-Filename': encodeURIComponent(file.name)},
    body: file,
  });
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const ticket = await request<{id: string; url: string}>('/uploads', post({filename: file.name, size: file.size, hash}));
  const stored = await fetch(ticket.url, {
    method: 'PUT', headers: {'Content-Type': 'application/octet-stream'}, body: file, referrerPolicy: 'no-referrer',
  }).catch(() => undefined);
  if (!stored?.ok) throw new Error('文件未能写入 R2。请检查网络及存储桶的跨域设置。');
  return request('/uploads/' + ticket.id, post({}));
}

function ModelAssets({onUse}:{onUse:(id:string)=>void}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [model, setModel] = useState<Model>();
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [listError, setListError] = useState('');
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    let active = true;
    request<Job[]>('').then(items => {
      if (!active) return;
      setJobs(items);
      setSelected(value => value || items[0]?.id || '');
    }).catch(error => {if (active) setListError(errorText(error));})
      .finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, []);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    request<Model>('/' + selected, {signal: controller.signal}).then(setModel).catch(error => {
      if (!controller.signal.aborted) setDetailError(errorText(error));
    });
    return () => controller.abort();
  }, [selected]);

  function select(id: string) {
    setDetailError('');
    setSelected(id);
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setListError('');
    if (file.size > 25 * 1024 * 1024) {
      setListError('请选择 25 MB 以内的 OBJ 文件。');
      return;
    }
    setUploading(true);
    try {
      const job = await uploadModel(file);
      setJobs(items => [job, ...items]);
      select(job.id);
    } catch (error) {
      setListError(errorText(error));
    } finally {
      setUploading(false);
    }
  }

  return <main className="model-assets-page">
      <header className="page-heading">
        <div><h1>上传复核</h1><p>上传整戒 OBJ，复核部件和接合点，生成可入库的模型文件。</p></div>
        <label className="primary upload">
          <input type="file" accept=".obj" onChange={upload} disabled={uploading || loading} aria-label="上传 OBJ" />
          {uploading ? '正在分析模型…' : '上传 OBJ'}
        </label>
      </header>
      <details className="upload-guide"><summary>建模师如何上传新戒指？</summary>
        <ol><li>点击「上传 OBJ」，选择整枚戒指模型，文件不超过 25 MB。</li><li>查看三维预览，核对戒头、戒圈、主石和配钻的分区，再确认接合点。连在一起的网格需先在建模软件中拆开，尺寸单位也需人工核对。</li><li>点击「生成部件版本」，进入部件管理预览、维护加价。不需要的上传版本可以移出部件库。</li><li>点击「下一步：用于商品」自动带入整套部件，选择新建或更新已有商品，填写名称介绍和价格；封面可由 3D 自动生成，保存草稿后直接预览。确认发布后进入前台目录；勾选首页精选并发布后，才会出现在首页。</li></ol>
        <p>上传和生成部件不会自动上架。自动识别的结果需要人工复核。</p>
      </details>
      {listError && <p role="alert" className="error">{listError}</p>}
      <div className="workspace">
        <div className="model-switcher"><label htmlFor="model-select">已导入模型 · {jobs.length}</label><select id="model-select" disabled={loading||uploading} value={selected} onChange={e=>select(e.target.value)}>{!jobs.length&&<option value="">上传后选择模型</option>}{jobs.map(job=><option key={job.id} value={job.id}>{job.filename} · {job.exported?'已有部件版本':'待复核'}</option>)}</select></div>
        {detailError ? <p role="alert" className="error">{detailError}</p> :
          model && model.id === selected ? <Review key={model.id} onUse={onUse} model={model} request={request} onExport={updated => {
            setModel(current => current?.id === updated.id ? updated : current);
            setJobs(items => items.map(item => item.id === updated.id ? {...item, exported: true} : item));
          }} /> : <div className="empty">{selected ? '正在读取模型…' : '导入模型后，在这里查看 3D 和部件分区。'}</div>}
      </div>
    </main>;
}

function App(){
  const [sourceId,setSourceId]=useState('');
  function useSource(id:string){setSourceId(id);setTab('templates');}
  const [tab,setTab]=useState<'models'|'parts'|'templates'>('templates');
  return <>
    <header className="admin-header"><span className="wordmark">相言</span>
      <nav aria-label="配置管理">{([['models','上传复核'],['parts','部件管理'],['templates','商品管理']] as const)
        .map(([id,label])=><button key={id} aria-current={id===tab?'page':undefined} onClick={()=>{setSourceId('');setTab(id);}}>{label}</button>)}</nav>
      <span className="local-label">{hosted ? '管理后台' : '本地工作台'}</span>
    </header>
    {tab==='models'?<ModelAssets onUse={useSource}/>:<TemplateLibrary key={tab+sourceId} request={request} tab={tab} initialSourceId={sourceId} onUse={useSource}/>}
  </>;
}

function AdminGate() {
  const [access, setAccess] = useState<'checking' | 'login' | 'ready' | 'unavailable'>('checking');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    request('/session', {signal: controller.signal}).then(() => setAccess('ready')).catch(error => {
      if (controller.signal.aborted) return;
      if (error instanceof AdminError && error.status === 401) setAccess('login');
      else {setError(errorText(error)); setAccess('unavailable');}
    });
    return () => controller.abort();
  }, []);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const password = new FormData(event.currentTarget).get('password');
      await request('/session', post({password}));
      setAccess('ready');
    } catch (error) {setError(errorText(error));}
    finally {setBusy(false);}
  }
  if (access === 'ready') return <App />;
  return <>
    <header className="admin-header"><span className="wordmark">相言</span></header>
    <main className="admin-login"><article className="review">
      <h1>管理后台</h1>
      {access === 'checking' && <p role="status">正在检查登录状态…</p>}
      {access === 'login' && <form className="template-form" onSubmit={login}>
        <label>管理员密码<input name="password" type="password" autoComplete="current-password" required /></label>
        <button className="primary" disabled={busy}>{busy ? '正在登录…' : '登录'}</button>
      </form>}
      {error && <p className="error" role="alert">{error}</p>}
    </article></main>
  </>;
}

createRoot(document.getElementById('root')!).render(hosted ? <AdminGate /> : <App />);
