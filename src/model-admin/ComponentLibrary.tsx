import {useState} from 'react';
import type {LibrarySource} from '../stone-first/reference/managed-types';
import {ZERO_COMPONENT_PRICES,type PriceBook} from '../stone-first/pricing';
import AssetPreview from './AssetPreview';

type Props={sources:LibrarySource[];prices:PriceBook;onSave:(book:PriceBook)=>Promise<void>;onUse?:(id:string)=>void;onRename?:(source:LibrarySource,name:string,partNames:NonNullable<LibrarySource['partNames']>)=>Promise<void>;onArchive?:(source:LibrarySource,archived:boolean)=>Promise<void>};
const parts=[['head','戒头'],['band','戒圈'],['headStones','戒头配钻'],['pave','戒臂铺钻'],['adapter','接合件']] as const;
export default function ComponentLibrary({sources,prices,onSave,onArchive,onRename,onUse}:Props){
  const [renaming,setRenaming]=useState<LibrarySource>();
  const [name,setName]=useState('');
  const [names,setNames]=useState<NonNullable<LibrarySource['partNames']>>({});
  const [query,setQuery]=useState('');
  const [removed,setRemoved]=useState(false);
  const [kind,setKind]=useState('head');
  const [book,setBook]=useState(prices);
  const [asset,setAsset]=useState<{title:string;url:string}>();
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const changed=JSON.stringify(book.components)!==JSON.stringify(prices.components)||JSON.stringify(book.bases)!==JSON.stringify(prices.bases);
  async function save(){
    setBusy(true);setError('');setMessage('');
    try{await onSave(book);setMessage('价格已保存。已发布的组合商品和购物车保持原报价。');}
    catch(error){setError(error instanceof Error?error.message:'保存失败，请重试。');}
    finally{setBusy(false);}
  }
  async function archive(source:LibrarySource){
    const archived=!source.archived;
    if(archived&&!window.confirm('移出 '+source.name+' · '+source.revision.slice(0,8)+' 的整套部件？戒头、戒圈及配钻将不再供新商品选择；已有商品和草稿保持不变，可在“已移除”中恢复。'))return;
    setBusy(true);setError('');setMessage('');
    try{await onArchive?.(source,archived);setMessage(archived?'整套部件已移出。已有商品和草稿不受影响。':'部件版本已恢复。');}
    catch(error){setError(error instanceof Error?error.message:'操作失败，请重试。');}
    finally{setBusy(false);}
  }
  const matches=(name:string)=>name.toLowerCase().includes(query.toLowerCase());
  return <main>
    <header className="page-heading"><div><h1>部件管理</h1><p>从已复核的版本选取部件，预览结构并维护加价。</p></div></header>
    <div className="library-toolbar"><input aria-label="搜索部件" placeholder="搜索部件来源" value={query} onChange={e=>setQuery(e.target.value)}/>
      <select aria-label="部件类型" value={kind} onChange={e=>setKind(e.target.value)}>{parts.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
      {onArchive&&<select aria-label="部件状态" value={removed?'removed':'active'} onChange={e=>setRemoved(e.target.value==='removed')}><option value="active">可用部件</option><option value="removed">已移除</option></select>}
    </div>
    <p className="selection-note">按版本管理整套部件。移出后保留已有商品引用和原文件；参考原款暂不支持移除。</p>
    {error&&<p className="error" role="alert">{error}</p>}
    <form onSubmit={e=>{e.preventDefault();void save();}}>
      <div className="component-table"><table><thead><tr><th>部件来源</th><th>加价（元）</th><th>操作</th></tr></thead>
      <tbody>{sources.filter(item=>!!item.archived===removed&&matches(item.name+' '+(item.filename??'')+' '+Object.values(item.partNames??{}).join(' '))).flatMap(item=>parts.filter(([key])=>key===kind&&item.assets[key]).map(([key,label])=>{
          const rates=book.components[item.id]??ZERO_COMPONENT_PRICES;
          const charge=key==='head'||key==='band'||key==='pave';
          return <tr key={item.id+key}><td><strong>{item.partNames?.[key]||item.name}</strong><small>{item.filename&&item.filename+' · '}{label} · {item.stock?'参考原款':item.revision.slice(0,8)}</small></td>
            <td>{charge?<input aria-label={item.name+label+'加价'} type="number" min="0" max="1000000" step="0.01" required disabled={busy||removed} value={rates[key]} onChange={e=>setBook({...book,components:{...book.components,[item.id]:{...rates,[key]:e.target.valueAsNumber}}})}/>:<span>{key==='headStones'?'含在戒头加价中':'含在戒圈加价中'}</span>}</td>
            <td>{onRename&&!item.stock&&<button type="button" disabled={busy||changed} onClick={()=>{setRenaming(item);setName(item.name);setNames(item.partNames??{});}}>命名</button>}{onUse&&!item.archived&&<button type="button" disabled={busy||changed} onClick={()=>onUse(item.id)}>用于商品</button>}<button type="button" onClick={()=>setAsset({title:item.name+' · '+label,url:item.assets[key]!})}>预览</button><a href={item.assets[key]} download>下载</a>{onArchive&&!item.stock&&<button type="button" disabled={busy||changed} onClick={()=>archive(item)}>{item.archived?'恢复版本':'移出部件库'}</button>}</td></tr>;
        }))}</tbody></table></div>
      <div className="price-save"><button className="primary" disabled={busy||!changed}>{busy?'正在保存…':'保存部件加价'}</button><p>商品需要重新保存草稿并发布，才会应用新的部件加价。</p></div>
      {message&&<p role="status">{message}</p>}
    </form>
    {renaming&&<div className="metadata-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="rename-title" className="metadata-dialog">
      <h2 id="rename-title">命名部件</h2><p>原文件 {renaming.filename??renaming.name} 保留，已发布商品不变。</p>
      <form className="template-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await onRename?.(renaming,name,names);setRenaming(undefined);setMessage('名称已保存。');}catch(error){setError(error instanceof Error?error.message:'保存失败');}finally{setBusy(false);}}}>
        <label>整套名称<input autoFocus required maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label>
        <details><summary>单独命名戒头、戒圈和配钻（可选）</summary>{parts.filter(([key])=>renaming.assets[key]).map(([key,label])=><label key={key}>{label}名称<input maxLength={60} value={names[key]??''} placeholder={name+' · '+label} onChange={e=>setNames({...names,[key]:e.target.value})}/></label>)}</details>
        {error&&<p role="alert">{error}</p>}<div className="template-actions"><button className="primary" disabled={busy}>保存名称</button><button type="button" disabled={busy} onClick={()=>setRenaming(undefined)}>取消</button></div>
      </form></section></div>}
    {asset&&<AssetPreview asset={asset} onClose={()=>setAsset(undefined)}/>}
  </main>;
}
