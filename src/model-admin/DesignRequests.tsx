import {useEffect,useState} from 'react';
import type {DesignRequest} from '../stone-first/consumer-types';
import {formatYuan} from '../stone-first/ring02/demoOrder';
import {ReviewDialog} from '../stone-first/ring02/ReviewDialog';
const labels={pending:'待人工确认','needs-information':'待客户补充',declined:'不支持制作',quoted:'已报价待确认',confirmed:'客户已确认'};
type Request=<T>(path:string,init?:RequestInit)=>Promise<T>;
export default function DesignRequests({request}:{request:Request}){
  const [items,setItems]=useState<DesignRequest[]>([]),[selected,setSelected]=useState(''),[filter,setFilter]=useState('');
  const [error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0);
  const [status,setStatus]=useState<'pending'|'needs-information'|'declined'|'quoted'>('pending');
  const [reviewer,setReviewer]=useState(''),[note,setNote]=useState(''),[amount,setAmount]=useState(''),[validUntil,setValidUntil]=useState(''),[leadTime,setLeadTime]=useState(''),[production,setProduction]=useState(''),[verified,setVerified]=useState(false),[confirm,setConfirm]=useState(false);
  const [lettering,setLettering]=useState({fontId:'',fontVersion:'',licenseEvidence:'',alignment:'center',direction:'forward',heightMm:'',minHeightMm:'',textWidthMm:'',areaWidthMm:''});
  const item=items.find(item=>item.id===selected);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    request<DesignRequest[]>('/design-requests',{signal:controller.signal}).then(items=>{if(!controller.signal.aborted){setItems(items);setSelected(value=>value||items[0]?.id||'');}})
      .catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:'读取失败。');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[attempt,request]);
  useEffect(()=>{setStatus(item?.status==='confirmed'?'pending':item?.status??'pending');setNote('');setAmount(item?.quote?String(item.quote.amount):'');setLeadTime(item?.quote?.leadTime??'');setProduction(item?.quote?.productionRequirements??'');setValidUntil('');setVerified(false);const v=item?.quote?.lettering;setLettering({fontId:v?.fontId??'',fontVersion:v?.fontVersion??'',licenseEvidence:v?.licenseEvidence??'',alignment:v?.alignment??'center',direction:v?.direction??'forward',heightMm:v?String(v.heightMm):'',minHeightMm:v?String(v.minHeightMm):'',textWidthMm:v?String(v.textWidthMm):'',areaWidthMm:v?String(v.areaWidthMm):''});},[item?.id]);
  async function save(){
    if(!item)return;
    setBusy(true);setError('');
    try{
      const next=await request<DesignRequest>('/design-requests/'+item.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:item.stateRevision,status,reviewer,note,manufacturingConfirmed:verified,quote:{amount:Number(amount),validUntil:validUntil?new Date(validUntil).toISOString():'',leadTime,productionRequirements:production,lettering:{...lettering,position:'inner-band',heightMm:Number(lettering.heightMm),minHeightMm:Number(lettering.minHeightMm),textWidthMm:Number(lettering.textWidthMm),areaWidthMm:Number(lettering.areaWidthMm)}}})});
      setItems(items=>items.map(value=>value.id===next.id?next:value));setConfirm(false);
    }catch(error){setError(error instanceof Error?error.message:'保存失败，请重试。');}finally{setBusy(false);}
  }
  return <main className="design-review-page"><header className="page-heading"><div><h1>方案复核</h1><p>按提交版本核对制作要求，处理结果会显示在客户的「我的方案」。</p></div><button disabled={loading||busy} onClick={()=>setAttempt(value=>value+1)}>刷新申请</button></header>
    {error&&<p className="error" role="alert">{error}</p>}
    <label>处理状态 <select value={filter} onChange={event=>setFilter(event.target.value)}><option value="">全部</option>{Object.entries(labels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    {loading?<p role="status">正在读取申请…</p>:<div className="design-review-layout"><aside aria-label="申请列表">{items.filter(item=>!filter||item.status===filter).map(item=><button key={item.id} aria-pressed={selected===item.id} onClick={()=>setSelected(item.id)}><strong>{item.design.name}</strong><span>{labels[item.status]}</span><small>{item.id}</small></button>)}{!items.length&&<p>暂无人工确认申请。</p>}</aside>
      {item&&<section className="model-detail"><header><h2>{item.design.name}</h2><p>申请编号 {item.id} · {labels[item.status]}</p></header>
        <div className="design-review-summary">{item.design.thumbnail&&<img src={item.design.thumbnail} alt="客户提交时的方案截图" width="240" height="240"/>}<dl><div><dt>设计修订</dt><dd>{item.design.revision}</dd></div><div><dt>戒头</dt><dd>{item.design.templates.head.name}</dd></div><div><dt>戒圈</dt><dd>{item.design.templates.band.name}</dd></div><div><dt>石径 / 铺钻长度</dt><dd>{item.design.design.paveDiameter??100}% / {item.design.design.paveLength??100}%</dd></div><div><dt>客户尺寸与制作要求</dt><dd>{item.design.design.requestNote||'未填写，需沟通确认'}</dd></div><div><dt>确认刻字</dt><dd>{item.design.design.engraving||'未添加'}</dd></div><div><dt>参考估价</dt><dd>{formatYuan(item.design.check.quote.amount)}</dd></div></dl></div>
        {item.design.design.image&&<figure><img src={'/api/model-admin/design-requests/'+item.id+'/image'} alt="客户上传的个性化参考图" style={{maxWidth:'100%',maxHeight:220}}/><figcaption>{item.design.design.image.name} · 期望位置 {item.design.design.image.position==='inner-band'?'内圈':'外侧戒臂'}</figcaption></figure>}
        {item.productionFile&&<p>生产文件 <a href={'/api/model-admin/design-requests/'+item.id+'/file'}>{item.productionFile.name}</a> · 与当前设计修订关联</p>}
        <a download={'xiangyan-production-'+item.id+'.json'} href={'data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(item,null,2))}>下载结构化配置与版本记录</a>
        <details><summary>待核对事项与处理记录</summary><ul>{item.design.check.issues.map(issue=><li key={issue.field}>{issue.message}</li>)}</ul>{item.history.map((entry,index)=><p key={index}>{new Date(entry.at).toLocaleString('zh-CN')} · {entry.reviewer} · {labels[entry.status]} · {entry.note}</p>)}</details>
        {item.status==='confirmed'?<p>客户已确认本设计与报价。该记录不可覆盖，修改设计需另行提交新版本。</p>:<form onSubmit={event=>{event.preventDefault();setConfirm(true);}}>
          <div className="design-review-fields"><label>处理人<input required value={reviewer} maxLength={80} onChange={event=>setReviewer(event.target.value)}/></label><label>处理结果<select aria-label="处理结果" value={status} onChange={event=>setStatus(event.target.value as typeof status)}>{(['pending','needs-information','declined','quoted'] as const).map(value=><option key={value} value={value}>{labels[value]}</option>)}</select></label></div>
          <label>生产文件（个性化方案报价前必需）<input type="file" accept=".pdf,.dxf,.step,.stp,.txt" disabled={busy} onChange={async event=>{
            const file=event.target.files?.[0];event.target.value='';if(!file)return;
            if(!reviewer.trim()){setError('请先填写处理人。');return;}
            if(file.size>3*1024*1024){setError('生产文件不能超过 3 MB。');return;}
            setBusy(true);setError('');
            try{
              const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('读取文件失败。'));reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(file);});
              const next=await request<DesignRequest>('/design-requests/'+item.id+'/file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:item.stateRevision,reviewer,name:file.name,base64})});
              setItems(items=>items.map(value=>value.id===next.id?next:value));setVerified(false);
            }catch(error){setError(error instanceof Error?error.message:'关联文件失败，请重试。');}finally{setBusy(false);}
          }}/></label>
          <label>给客户的说明<textarea required maxLength={4000} value={note} onChange={event=>setNote(event.target.value)}/></label>
          {status==='quoted'&&<><div className="design-review-fields"><label>正式报价（元）<input required type="number" min="0.01" step="0.01" value={amount} onChange={event=>setAmount(event.target.value)}/></label><label>交期<input required maxLength={120} value={leadTime} onChange={event=>setLeadTime(event.target.value)}/></label></div>
            <label>报价有效期<input required type="datetime-local" value={validUntil} onChange={event=>setValidUntil(event.target.value)}/></label>
            {item.design.design.engraving&&<fieldset><legend>刻字工艺复核</legend><p>确认文字「{item.design.design.engraving}」。以下尺寸由工艺人员依据实际字体和生产文件填写。</p><div className="design-review-fields">
              {([['fontId','字体标识'],['fontVersion','字体版本'],['licenseEvidence','字体授权依据']] as const).map(([key,label])=><label key={key}>{label}<input required maxLength={300} value={lettering[key]} onChange={event=>setLettering(value=>({...value,[key]:event.target.value}))}/></label>)}
              {([['heightMm','实际字高（mm）'],['minHeightMm','工艺最小字高（mm）'],['textWidthMm','实际字宽（mm）'],['areaWidthMm','可刻区域宽度（mm）']] as const).map(([key,label])=><label key={key}>{label}<input required type="number" min="0.001" step="any" value={lettering[key]} onChange={event=>setLettering(value=>({...value,[key]:event.target.value}))}/></label>)}
              <label>对齐<select value={lettering.alignment} onChange={event=>setLettering(value=>({...value,alignment:event.target.value}))}><option value="center">居中</option><option value="left">左对齐</option><option value="right">右对齐</option></select></label>
              <label>文字方向<select value={lettering.direction} onChange={event=>setLettering(value=>({...value,direction:event.target.value}))}><option value="forward">沿内圈正向</option><option value="reverse">沿内圈反向</option></select></label>
            </div></fieldset>}
            <label>制作要求<textarea required maxLength={8000} value={production} onChange={event=>setProduction(event.target.value)} placeholder="明确实物材质、圈号标准与尺寸、接合/镶嵌要求、刻字字体位置与生产文件依据。"/></label><label className="check"><input type="checkbox" checked={verified} onChange={event=>setVerified(event.target.checked)} required/>已人工核对本版本的材质、尺寸、组合与个性化制作要求</label>
          </>}
          <button className="primary" disabled={busy}>保存处理结果</button>
        </form>}
      </section>}
    </div>}
    {confirm&&item&&<ReviewDialog title="确认发送复核结果" busy={busy} onClose={()=>setConfirm(false)}><p>{item.design.name} · {labels[status]}</p><p>{note}</p>{status==='quoted'&&<><p>正式报价 {formatYuan(Number(amount))} · 交期 {leadTime}</p><p>客户需另行确认这份设计版本和制作要求。</p></>}{error&&<p role="alert">{error} <button disabled={busy} onClick={()=>{setConfirm(false);setAttempt(value=>value+1);}}>读取最新申请再核对</button></p>}<div className="ring02-dialog-actions"><button disabled={busy} autoFocus onClick={()=>setConfirm(false)}>继续核对</button><button disabled={busy} onClick={save}>{busy?'正在保存…':'确认保存'}</button></div></ReviewDialog>}
  </main>;
}
