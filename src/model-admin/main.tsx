import {lazy, Suspense, useEffect, useState, type ChangeEvent, type FormEvent} from 'react';
import {createRoot} from 'react-dom/client';
import {ViewerBoundary} from '../viewer/ViewerBoundary';
import AssetPreview from './AssetPreview';
import TemplateLibrary from './TemplateLibrary';
import './model-admin.css';

const base = '/api/model-admin';
const labels = {
  unassigned: '待确认', head: '戒头金属', band: '戒圈金属', center: '主石',
  halo: '戒头配钻', shoulder: '戒臂配钻', paveMetal: '铺钻镶座', adapter: '接合件', exclude: '不导出',
};
type Role = keyof typeof labels;
type Job = {id: string; filename: string; createdAt: string; size: number; exported?: boolean};
type Part = {id: number; triangles: number; min: number[]; max: number[]; role: Role};
type Revision = {
  id: string; createdAt: string; reviewedSeatY: number; assignments: Record<string, Role>;
  parts: Partial<Record<'head' | 'band' | 'headStones' | 'pave' | 'adapter', string>>;
};
type Model = Job & {
  reference?: string; hash: string; triangleCount: number; seatY: number | null;
  min: number[]; max: number[]; parts: Part[]; exports: Revision[];
};
const PartPreview = lazy(() => import('./PartPreview'));
const num = new Intl.NumberFormat('zh-CN');
const date = new Intl.DateTimeFormat('zh-CN', {dateStyle: 'short', timeStyle: 'short'});
const errorText = (error: unknown) => error instanceof Error ? error.message : '操作失败，请重试。';
const dimensions = (min: number[], max: number[]) => max.map((v, i) => (v - min[i]).toFixed(2)).join(' × ');
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

function Review({model, onExport}: {model: Model; onExport: (model: Model) => void}) {
  const last = model.exports[0];
  const [assignments, setAssignments] = useState<Record<string, Role>>(
    () => last?.assignments ?? Object.fromEntries(model.parts.map(part => [part.id, part.role])),
  );
  const [seat, setSeat] = useState(String(last?.reviewedSeatY ?? model.seatY ?? ''));
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [asset, setAsset] = useState<{title: string; url: string}>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [min, max] = [model.min[1], model.max[1]];
  const anchor = seat.trim() && Number(seat) > min && Number(seat) < max ? Number(seat) : null;
  const location = base + '/' + model.id;

  async function exportParts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    setError('');
    try {
      await request('/' + model.id + '/export', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({seatY: Number(seat), assignments}),
      });
      const updated = await request<Model>('/' + model.id);
      onExport(updated);
      setStatus('已生成部件版本，已加入部件库。');
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return <article className="review">
    <header className="review-heading">
      <div>
        <h2>{model.filename}</h2>
        <p>{model.reference ? '匹配原款 · ' + model.reference : '新模型 · 请核对自动识别结果'}</p>
      </div>
      <a href={location + '/source'}>下载原始 OBJ</a>
    </header>
    <dl className="model-facts">
      <div><dt>连通部件</dt><dd>{num.format(model.parts.length)}</dd></div>
      <div><dt>三角面</dt><dd>{num.format(model.triangleCount)}</dd></div>
      <div><dt>模型范围（源坐标）</dt><dd>{dimensions(model.min, model.max)}</dd></div>
      <div><dt>原文件单位</dt><dd>待确认</dd></div>
    </dl>
    <form onSubmit={exportParts}>
      <div className="review-grid">
        <section aria-label="3D 复核" className="preview-section">
          <div className="preview">
            <ViewerBoundary onRetry={() => setPreviewAttempt(value => value + 1)}>
              <Suspense fallback={<p className="preview-message">正在加载预览…</p>}>
                <PartPreview url={location + '/preview?attempt=' + previewAttempt} highlight={highlight} assignments={assignments}
                  anchor={anchor} centerX={(model.min[0] + model.max[0]) / 2}
                  radius={(model.max[0] - model.min[0]) * .24} />
              </Suspense>
            </ViewerBoundary>
          </div>
          <p>{highlight === null ? '拖动旋转，滚轮缩放。点击右侧部件编号查看所在位置。' : '已高亮部件 #' + highlight}</p>
        </section>
        <section aria-labelledby="parts-heading" className="parts-section">
          <h3 id="parts-heading">复核部件分区</h3>
          <p>每行对应一块连通网格。连在一起的金属需要先在建模软件中拆开。</p>
          <div className="parts-scroll" tabIndex={0} aria-label="部件列表">
            <table>
              <thead><tr><th scope="col">部件</th><th scope="col">三角面</th><th scope="col">用途</th></tr></thead>
              <tbody>{model.parts.map(part => <tr key={part.id} data-highlight={highlight === part.id}>
                <td><button type="button" className="part-button" aria-pressed={highlight === part.id}
                  aria-label={'定位部件 ' + part.id}
                  onClick={() => setHighlight(value => value === part.id ? null : part.id)}>#{part.id}</button></td>
                <td>{num.format(part.triangles)}</td>
                <td><select aria-label={'部件 ' + part.id + ' 用途'} disabled={busy}
                  value={assignments[part.id]}
                  onChange={event => setAssignments(values => ({...values, [part.id]: event.target.value as Role}))}>
                  {Object.entries(labels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                </select></td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
      <div className="export-controls">
        <label>戒头与戒圈接合点 Y
          <input type="number" step="any" required disabled={busy} value={seat} aria-describedby="seat-range"
            onChange={event => setSeat(event.target.value)} />
          <small id="seat-range">源坐标范围 {min.toFixed(2)} 至 {max.toFixed(2)}，金色线标示接合高度</small>
        </label>
        <button className="primary" disabled={busy}>{busy ? '正在生成…' : '生成部件版本'}</button>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      {status && <p role="status">{status}</p>}
    </form>
    <section className="versions" aria-labelledby="version-heading">
      <h3 id="version-heading">复核记录</h3>
      <p>{model.exports.length?'已生成 '+model.exports.length+' 个部件版本，可到部件管理预览、定价和复用。':'复核分区和接合点后，生成可入库的部件版本。'}</p>
      {model.exports.map(revision=><p key={revision.id}>{date.format(new Date(revision.createdAt))} · 接合点 Y {revision.reviewedSeatY}</p>)}
    </section>
    {asset && <AssetPreview asset={asset} onClose={() => setAsset(undefined)} />}
  </article>;
}

function ModelAssets() {
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

  return <main>
      <header className="page-heading">
        <div><h1>上传复核</h1><p>上传整戒 OBJ，复核部件和接合点，生成可入库的模型文件。</p></div>
        <label className="primary upload">
          <input type="file" accept=".obj" onChange={upload} disabled={uploading || loading} aria-label="上传 OBJ" />
          {uploading ? '正在分析模型…' : '上传 OBJ'}
        </label>
      </header>
      {listError && <p role="alert" className="error">{listError}</p>}
      <div className="workspace">
        <aside aria-labelledby="model-list">
          <h2 id="model-list">已导入模型 <span>{jobs.length}</span></h2>
          {loading && <p role="status">正在读取模型库…</p>}
          {!loading && !jobs.length && <p>上传后，可在这里打开原始模型并复核部件。</p>}
          {jobs.map(job => <button type="button" key={job.id} aria-current={selected === job.id ? 'true' : undefined}
            onClick={() => select(job.id)}>
            <strong>{job.filename}</strong>
            <small>{job.exported ? '已有部件版本' : '待复核'} · {(job.size / 1024 / 1024).toFixed(2)} MB</small>
          </button>)}
        </aside>
        {detailError ? <p role="alert" className="error">{detailError}</p> :
          model && model.id === selected ? <Review key={model.id} model={model} onExport={updated => {
            setModel(current => current?.id === updated.id ? updated : current);
            setJobs(items => items.map(item => item.id === updated.id ? {...item, exported: true} : item));
          }} /> : <div className="empty">{selected ? '正在读取模型…' : '导入模型后，在这里查看 3D 和部件分区。'}</div>}
      </div>
    </main>;
}

function App(){
  const [tab,setTab]=useState<'models'|'parts'|'templates'>('templates');
  return <>
    <header className="admin-header"><span className="wordmark">相言</span>
      <nav aria-label="配置管理">{([['models','上传复核'],['parts','部件管理'],['templates','商品管理']] as const)
        .map(([id,label])=><button key={id} aria-current={id===tab?'page':undefined} onClick={()=>setTab(id)}>{label}</button>)}</nav>
      <span className="local-label">{hosted ? '管理后台' : '本地工作台'}</span>
    </header>
    {tab==='models'?<ModelAssets/>:<TemplateLibrary request={request} tab={tab}/>}
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
