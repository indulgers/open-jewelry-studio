import {lazy,Suspense,useState,type FormEvent} from 'react';
import {ViewerBoundary} from '../viewer/ViewerBoundary';
import {labels,similarParts,suggestAssignments,suggestSeat,reviewIssues,type Assignments,type Role,type Part} from './review-assist';
const PartPreview=lazy(()=>import('./PartPreview'));
type Revision={archived?:boolean;id:string;createdAt:string;reviewedSeatY:number;assignments:Assignments};
export type ReviewModel={id:string;filename:string;reference?:string;seatY:number|null;min:number[];max:number[];triangleCount:number;parts:Part[];exports:Revision[]};
type Props={onUse?:(id:string)=>void;model:ReviewModel;onExport:(model:ReviewModel)=>void;request:<T>(path:string,init?:RequestInit)=>Promise<T>};
const num=new Intl.NumberFormat('zh-CN');
const date=new Intl.DateTimeFormat('zh-CN',{dateStyle:'short',timeStyle:'short'});
export default function ModelReview({model,onExport,request,onUse}:Props){
  const last=model.exports[0];
  const [assignments,setAssignments]=useState<Assignments>(()=>last?.assignments??Object.fromEntries(model.parts.map(part=>[part.id,part.role])));
  const [seat,setSeat]=useState(String(last?.reviewedSeatY??model.seatY??''));
  const [selected,setSelected]=useState<number[]>([]);
  const [filter,setFilter]=useState('all');
  const [bulkRole,setBulkRole]=useState<Role>('head');
  const [view,setView]=useState<'overall'|'front'|'side'>('overall');
  const [undo,setUndo]=useState<{assignments:Assignments;seat:string}>();
  const [previewAttempt,setPreviewAttempt]=useState(0);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const [error,setError]=useState('');
  const [min,max]=[model.min[1],model.max[1]];
  const anchor=seat.trim()&&Number(seat)>min&&Number(seat)<max?Number(seat):null;
  const pending=model.parts.filter(part=>assignments[part.id]==='unassigned').length;
  const visible=model.parts.filter(part=>filter==='all'||assignments[part.id]===filter);
  const issues=reviewIssues(model.parts,assignments,seat,min,max);
  const suggested=suggestSeat(model.parts,assignments,model.seatY);
  const location='/api/model-admin/'+model.id;
  function change(next:Assignments,newSeat=seat){setUndo({assignments,seat});setAssignments(next);setSeat(newSeat);setStatus('');setError('');}
  function pick(id:number,multiple=false){if(busy)return;setSelected(current=>multiple?current.includes(id)?current.filter(value=>value!==id):[...current,id]:[id]);}
  async function exportParts(event:FormEvent){
    event.preventDefault();if(issues.length)return;
    setBusy(true);setError('');setStatus('');
    try{
      await request('/'+model.id+'/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seatY:Number(seat),assignments})});
      onExport(await request<ReviewModel>('/'+model.id));setStatus('已生成部件版本，已加入部件库。');
    }catch(error){setError(error instanceof Error?error.message:'生成失败，请重试。');}finally{setBusy(false);}
  }
  return <article className="review model-review">
    <header className="review-heading"><div><h2>{model.filename}</h2><p>{model.reference?'匹配原款 · '+model.reference:'新模型 · 自动建议需要复核'}</p></div><a href={location+'/source'}>下载原始 OBJ</a></header>
    <details className="model-metadata"><summary>{model.parts.length} 个部件 · {num.format(model.triangleCount)} 三角面 · 模型信息</summary><p>源坐标范围 {model.max.map((v,i)=>(v-model.min[i]).toFixed(2)).join(' × ')} · 原文件单位待人工确认</p></details>
    <form onSubmit={exportParts}>
      <div className="review-grid">
        <section aria-label="3D 复核" className="preview-section">
          <div className="review-view-tools">{([['overall','整体'],['front','正面'],['side','侧面']] as const).map(([id,label])=><button type="button" key={id} aria-pressed={view===id} onClick={()=>setView(id)}>{label}</button>)}<span>{selected.length?'已选 '+selected.length+' 个部件':'点击模型选择部件'}</span></div>
          <div className="preview"><ViewerBoundary onRetry={()=>setPreviewAttempt(value=>value+1)}><Suspense fallback={<p className="preview-message">正在加载预览…</p>}>
            <PartPreview url={location+'/preview?attempt='+previewAttempt} selected={selected} onPick={pick} assignments={assignments} view={view}
              anchor={anchor} centerX={(model.min[0]+model.max[0])/2} radius={(model.max[0]-model.min[0])*.56}/>
          </Suspense></ViewerBoundary></div>
          <p>拖动旋转，滚轮缩放；按住 Shift 点击可多选。蓝色为选中部件，金色平面为接合高度。</p>
          <section className="seat-assist" aria-label="接合点辅助">
            <div><strong>戒头与戒圈接合高度</strong><button type="button" disabled={busy||!suggested} onClick={()=>{change(assignments,String(Number(suggested!.value.toFixed(3))));setView('side');setStatus(suggested!.reason);}}>使用建议位置</button><button type="button" disabled={busy||!selected.length} onClick={()=>{
              const bottom=Math.min(...model.parts.filter(part=>selected.includes(part.id)).map(part=>part.min[1]));change(assignments,String(Number(bottom.toFixed(3))));setView('side');
            }}>取所选部件下沿</button></div>
            <div className="seat-slider"><input type="range" aria-label="调整接合高度" min={min+.001} max={max-.001} step="any" disabled={busy||anchor===null} value={anchor??(min+max)/2} onChange={e=>change(assignments,e.target.value)}/><label>Y <input aria-label="接合高度 Y" type="number" step="any" value={seat} disabled={busy} onChange={e=>change(assignments,e.target.value)}/></label></div>
            <p>{suggested?suggested.reason:'先指定戒头和戒圈，或选中戒头后取下沿。'} 此平面用于部件装配定位，不会切开网格。</p>
          </section>
        </section>
        <section aria-labelledby="parts-heading" className="parts-section">
          <div className="review-section-title"><h3 id="parts-heading">部件分区</h3><span>{pending?'待确认 '+pending+' 个':'全部已分配'}</span></div>
          <div className="review-part-tools"><button type="button" disabled={busy} onClick={()=>{const next=suggestAssignments(model.parts,assignments);const count=model.parts.filter(part=>next[part.id]!==assignments[part.id]).length;change(next);setStatus(count?'已补齐 '+count+' 个戒头建议，请在三维中核对。':'暂无可补齐的建议，请先指定戒圈或批量选择部件。');}}>补齐建议分区</button><button type="button" disabled={busy||!undo} onClick={()=>{setAssignments(undo!.assignments);setSeat(undo!.seat);setUndo(undefined);setStatus('已撤销上次修改。');}}>撤销上次</button></div>
          <label className="review-filter">显示 <select aria-label="部件用途筛选" value={filter} onChange={e=>{setFilter(e.target.value);setSelected([]);}}><option value="all">全部部件（{model.parts.length}）</option>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}（{model.parts.filter(part=>assignments[part.id]===key).length}）</option>)}</select></label>
          <div className="review-part-tools"><button type="button" disabled={busy||!visible.length} onClick={()=>setSelected(visible.map(part=>part.id))}>全选当前列表</button><button type="button" disabled={busy||selected.length!==1} onClick={()=>{const seed=model.parts.find(part=>part.id===selected[0])!;setSelected(similarParts(visible,seed));setStatus('已按网格数量和尺寸选择相似候选，请核对高亮范围后再分配。');}}>选择相似部件</button><button type="button" disabled={!selected.length} onClick={()=>setSelected([])}>清空</button></div>
          <div className="review-bulk"><label>已选 {selected.length} 个<select aria-label="批量用途" disabled={busy} value={bulkRole} onChange={e=>setBulkRole(e.target.value as Role)}>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><button type="button" disabled={busy||!selected.length} onClick={()=>change({...assignments,...Object.fromEntries(selected.map(id=>[id,bulkRole]))})}>应用到所选</button></div>
          <div className="parts-scroll" tabIndex={0} aria-label="部件列表"><table><thead><tr><th>选择</th><th>部件</th><th>用途</th></tr></thead><tbody>{visible.map(part=><tr key={part.id} data-highlight={selected.includes(part.id)}>
            <td><input type="checkbox" aria-label={'选择部件 '+part.id} disabled={busy} checked={selected.includes(part.id)} onChange={()=>pick(part.id,true)}/></td>
            <td><button type="button" className="part-button" aria-label={'定位部件 '+part.id} onClick={()=>pick(part.id)}>#{part.id}</button><small>{num.format(part.triangles)} 面</small></td>
            <td><select aria-label={'部件 '+part.id+' 用途'} value={assignments[part.id]} disabled={busy} onChange={e=>change({...assignments,[part.id]:e.target.value as Role})}>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></td>
          </tr>)}</tbody></table>{!visible.length&&<p className="review-list-empty">没有此类部件。</p>}</div>
          <p>连接在一起的网格需先在建模软件中拆开。建议分区不会覆盖已分配的用途。</p>
        </section>
      </div>
      <div className="review-submit"><div><strong>{issues.length?'还有待复核项':'可以生成部件版本'}</strong><p>{issues.length?issues.join(' · '):'请确认分区和接合位置后生成，已有线上商品不会改变。'}</p></div><button className="primary" disabled={busy||!!issues.length}>{busy?'正在生成…':'生成部件版本'}</button></div>
      {error&&<p role="alert" className="error">{error}</p>}{status&&<p role="status" className="review-feedback">{status}</p>}
    </form>
    {onUse&&model.exports.some(item=>!item.archived)&&<div className="review-next"><p>复核完成后，整套戒头、戒圈和配钻可直接带入商品草稿。</p><button type="button" disabled={busy} onClick={()=>onUse(model.exports.find(item=>!item.archived)!.id)}>下一步：用于商品</button></div>}
    <details className="versions"><summary>复核记录 · {model.exports.filter(item=>!item.archived).length} 个可用版本</summary>{model.exports.map(revision=><p key={revision.id}>{date.format(new Date(revision.createdAt))} · {revision.id.slice(0,8)} · 接合点 Y {revision.reviewedSeatY}{revision.archived?' · 已移出部件库':''}</p>)}</details>
  </article>;
}
