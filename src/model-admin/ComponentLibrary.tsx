import {useState} from 'react';
import type {LibrarySource} from '../stone-first/reference/managed-types';
import type {CatalogRing} from '../stone-first/catalog';
import {ZERO_COMPONENT_PRICES,type PriceBook} from '../stone-first/pricing';
import AssetPreview from './AssetPreview';

type Props={sources:LibrarySource[];catalog:CatalogRing[];prices:PriceBook;originals?:boolean;onBack?:()=>void;onSave:(book:PriceBook)=>Promise<void>};
const parts=[['head','戒头'],['band','戒圈'],['headStones','戒头配钻'],['pave','戒臂铺钻'],['adapter','接合件']] as const;
export default function ComponentLibrary({sources,catalog,prices,originals,onBack,onSave}:Props){
  const [query,setQuery]=useState('');
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
  const matches=(name:string)=>name.toLowerCase().includes(query.toLowerCase());
  return <main>
    <header className="page-heading"><div><h1>{originals?'原款定价':'部件管理'}</h1><p>{originals?'维护现有参考原款的基础价。新访客按新价报价，已保存方案保留原价。':'从已复核的版本选取部件，预览结构并维护加价。'}</p></div>{onBack&&<button onClick={()=>{if(!changed||window.confirm('有尚未保存的价格，确认离开？'))onBack();}}>返回商品列表</button>}</header>
    <div className="library-toolbar"><input aria-label="搜索部件" placeholder={originals?'搜索原款':'搜索部件来源'} value={query} onChange={e=>setQuery(e.target.value)}/>
      {!originals&&<select aria-label="部件类型" value={kind} onChange={e=>setKind(e.target.value)}>{parts.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>}
    </div>
    {error&&<p className="error" role="alert">{error}</p>}
    <form onSubmit={e=>{e.preventDefault();void save();}}>
      <div className="component-table"><table><thead><tr><th>{originals?'原款':'部件来源'}</th><th>{originals?'基础价（元）':'加价（元）'}</th>{!originals&&<th>查看</th>}</tr></thead>
      <tbody>{originals?catalog.filter(item=>matches(item.name)).map(item=><tr key={item.id}><td><strong>{item.name}</strong></td><td><input aria-label={item.name+'基础价'} type="number" min="0" max="1000000" step="0.01" required disabled={busy} value={book.bases[item.id]??item.price.base} onChange={e=>setBook({...book,bases:{...book.bases,[item.id]:e.target.valueAsNumber}})}/></td></tr>)
        :sources.filter(item=>matches(item.name)).flatMap(item=>parts.filter(([key])=>key===kind&&item.assets[key]).map(([key,label])=>{
          const rates=book.components[item.id]??ZERO_COMPONENT_PRICES;
          const charge=key==='head'||key==='band'||key==='pave';
          return <tr key={item.id+key}><td><strong>{item.name}</strong><small>{label} · {item.stock?'参考原款':item.revision.slice(0,8)}</small></td>
            <td>{charge?<input aria-label={item.name+label+'加价'} type="number" min="0" max="1000000" step="0.01" required disabled={busy} value={rates[key]} onChange={e=>setBook({...book,components:{...book.components,[item.id]:{...rates,[key]:e.target.valueAsNumber}}})}/>:<span>{key==='headStones'?'含在戒头加价中':'含在戒圈加价中'}</span>}</td>
            <td><button type="button" onClick={()=>setAsset({title:item.name+' · '+label,url:item.assets[key]!})}>预览</button><a href={item.assets[key]} download>下载</a></td></tr>;
        }))}</tbody></table></div>
      <div className="price-save"><button className="primary" disabled={busy||!changed}>{busy?'正在保存…':originals?'确认更新原款价格':'保存部件加价'}</button><p>{originals?'原款价格保存后生效。':'组合商品需要重新保存草稿并发布，才会应用新的部件加价。'}</p></div>
      {message&&<p role="status">{message}</p>}
    </form>
    {asset&&<AssetPreview asset={asset} onClose={()=>setAsset(undefined)}/>}
  </main>;
}
