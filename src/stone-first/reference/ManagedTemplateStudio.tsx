import {addDemoOrder,formatYuan,type DemoOrder} from '../ring02/demoOrder';
import {templateQuote} from '../pricing';
import {useCallback,useEffect,useMemo,useRef,useState,type RefObject} from 'react';
import {STONE_APPEARANCES,STONE_APPEARANCE_IDS,type StoneAppearance} from '../../viewer/stoneAppearance';
import {VIEWS,type RingView} from '../ring02/Ring02Stage';
import {ORIGINAL_REFERENCE} from './design';
import {fetchManaged,type ManagedTemplate} from './managed-types';
import {applyReferencePave} from './pave';
import {createReferenceLibrary} from './part-library';
import {SourceLoading,SourceRingStage,type SourceFrame} from './SourceRingStage';
import '../stone-first.css';
import '../ring02/ring02.css';
import './source-ring-picker.css';

const ignoreCapture=()=>{};

export function ManagedTemplateStudio({template,onReady=ignoreCapture,thumbnailRef}:{
  template:ManagedTemplate;onReady?:(frame:SourceFrame|null)=>void;
  thumbnailRef?:RefObject<(()=>string|undefined)|null>;
}){
  const [attempt,setAttempt]=useState(0);
  const [view,setView]=useState<RingView>('overall');
  const [reset,setReset]=useState(0);
  const [center,setCenter]=useState<StoneAppearance>('diamond');
  const [loaded,setLoaded]=useState<{ring?:SourceFrame['ring'];error?:boolean}>({});
  const capture=useRef<(()=>string|undefined)|null>(null);
  const design=useMemo(()=>({...ORIGINAL_REFERENCE,center}),[center]);
  const [ready,setReady]=useState(false);
  const [adding,setAdding]=useState(false);
  const [message,setMessage]=useState('');
  const captureReady=useCallback((frame:SourceFrame|null)=>{setReady(!!frame);onReady(frame);},[onReady]);
  const quote=template.pricing?templateQuote(template.pricing,template.revision):undefined;
  async function addToCart(){
    if(!quote||!ready||adding)return;
    setAdding(true);setMessage('');
    try{
      const confirmed=await fetchManaged<DemoOrder['quote']>(template.id+'/'+template.revision+'/quote',new AbortController().signal);
      if(confirmed.amount!==quote.amount||confirmed.version!==quote.version)throw new Error('价格已更新，请重新打开商品。');
      const thumbnail=capture.current?.();
      if(!thumbnail)throw new Error('款式图片还未准备好，请稍后重试。');
      addDemoOrder({templateRevision:template.revision,revision:crypto.randomUUID(),confirmedAt:new Date().toISOString(),
        managed:{id:template.id,revision:template.revision,name:template.name},design,quote:confirmed,thumbnail,stones:[],
        details:[{label:'戒头',value:template.headName},{label:'戒圈',value:template.bandName},{label:'主石外观',value:STONE_APPEARANCES[center].name},
          ...(['base','head','band','pave'] as const).map((key,index)=>({label:['基础价','戒头加价','戒圈加价','铺钻加价'][index],value:formatYuan(template.pricing![key])})),
          {label:'工艺状态',value:template.review?.status==='approved'?'复核通过':'待人工确认'}]});
      setMessage('已加入购物车');
    }catch(error){setMessage(error instanceof Error?error.message:'暂时无法加入购物车，请重试。');}
    finally{setAdding(false);}
  }


  useEffect(()=>{
    const library=createReferenceLibrary(undefined,template.library);
    let active=true;
    library.load(template.headId,template.bandId).then(({stock,band})=>{
      if(active)setLoaded({ring:applyReferencePave(stock,band,100,100)});
    }).catch(()=>{if(active)setLoaded({error:true});});
    return ()=>{active=false;library.dispose();};
  },[attempt,template]);

  return <div className="stone-first-workspace ring02-workspace source-ring-workspace managed-editor">
    <div className="stone-first-main ring02-main source-ring-main"><section className="stone-first-preview">
      {loaded.ring?<SourceRingStage ring={loaded.ring} design={design} template={template}
        view={view} reset={reset} captureRef={thumbnailRef??capture} captureSize={thumbnailRef?768:320} onCaptureReady={captureReady}/>
        :<div className="stone-first-canvas ring02-canvas"><SourceLoading template={template} retry={loaded.error?()=>{
          setLoaded({});setAttempt(value=>value+1);
        }:undefined}/></div>}
      <div className="stone-first-camera-views" aria-label="查看角度">
        {VIEWS.map(([id,label])=><button type="button" key={id} aria-pressed={view===id} onClick={()=>{
          setView(id);setReset(value=>value+1);
        }}>{label}</button>)}
      </div>
    </section>
    <section className="stone-first-panel">
      <h2>{template.name}</h2>
      <dl><div><dt>戒头</dt><dd>{template.headName}</dd></div><div><dt>戒圈</dt><dd>{template.bandName}</dd></div></dl>
      {!thumbnailRef&&<label>主石外观 <select value={center} onChange={event=>setCenter(event.target.value as StoneAppearance)}>
        {STONE_APPEARANCE_IDS.map(id=><option key={id} value={id}>{STONE_APPEARANCES[id].name}</option>)}
      </select></label>}
      {quote&&<section className="managed-price" aria-label="商品报价"><p>参考价 <strong>{formatYuan(quote.amount)}</strong></p>
        <details><summary>价格明细</summary><dl>{(['base','head','band','pave'] as const).map((key,index)=><div key={key}><dt>{['模板基础价','戒头加价','戒圈加价','铺钻加价'][index]}</dt><dd>{formatYuan(template.pricing![key])}</dd></div>)}</dl></details>
        {!thumbnailRef&&template.publishedAt&&<><button className="shop-button" disabled={!ready||adding} onClick={addToCart}>{adding?'正在保存…':'加入购物车'}</button><a className="shop-text-link" href="#/diy/cart">查看购物车</a></>}
      </section>}
      {message&&<p role="status">{message}</p>}
      <p>银色金属外观 · {template.review?.status==='approved'?'组合已完成工艺复核':'需人工确认制作要求'}</p>
      {template.review?.minDiameter!=null&&<p>登记戒圈内径 {template.review.minDiameter}–{template.review.maxDiameter} mm，档位步长 {template.review.step} mm。</p>}
    </section></div>
  </div>;
}

export default function PublishedTemplateStudio({id,revision}:{id:string;revision:string}){
  const [template,setTemplate]=useState<ManagedTemplate>();
  const [error,setError]=useState(false);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    fetchManaged<ManagedTemplate>(id+'/'+revision+'/template.json',controller.signal)
      .then((value:ManagedTemplate)=>{
        if(value.id!==id||value.revision!==revision||!value.publishedAt)throw new Error('未发布');
        setTemplate(value);
      }).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return ()=>controller.abort();
  },[id,revision,attempt]);
  return <main className="shop-wrap">
    <a href="#/diy/collection">返回全部款式</a>
    {template?<ManagedTemplateStudio template={template}/>:error
      ?<p role="alert">款式暂不可用。 <button onClick={()=>{setError(false);setAttempt(value=>value+1);}}>重试</button></p>
      :<p role="status">正在读取款式…</p>}
  </main>;
}
