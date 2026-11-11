import {useEffect,useRef,useState} from 'react';
import {Mesh} from 'three';
import {jewelryModelLoader} from '../../viewer/modelLoader';
import {preloadJewelryLighting} from '../../viewer/JewelryLighting';
import {STONE_APPEARANCES,STONE_APPEARANCE_IDS,type StoneAppearance} from '../../viewer/stoneAppearance';
import {RING_CATALOG,type CatalogRing} from '../catalog';
import {RingStylePicker} from '../RingStylePicker';
import {ReviewDialog} from '../ring02/ReviewDialog';
import {VIEWS,type RingView} from '../ring02/Ring02Stage';
import {ENGRAVING_LIMIT,engravingProblem} from '../ring02/engraving';
import {addDemoOrder,formatYuan,hasDemoOrder} from '../ring02/demoOrder';
import {prepareReferenceRing,type ReferenceRing} from './model';
import {ORIGINAL_REFERENCE,parseReferenceDesign,referenceDetails,referenceQuote,ZONE_NAMES,type ReferenceDesign} from './design';
import {SourceLoading,SourceRingStage} from './SourceRingStage';
import '../stone-first.css';
import '../ring02/ring02.css';

preloadJewelryLighting();
function Editor({template,ring}:{template:CatalogRing;ring:ReferenceRing}){
  const key='open-jewelry-studio:'+template.revision;
  const [history,setHistory]=useState(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(key)??'null');
      const design=parseReferenceDesign(saved?.design);
      if(design&&typeof saved.revision==='string'&&saved.revision.length<=128)return {design,revision:saved.revision,past:[] as ReferenceDesign[]};
    }catch{}
    return {design:ORIGINAL_REFERENCE,revision:crypto.randomUUID() as string,past:[] as ReferenceDesign[]};
  });
  const {design,revision,past}=history;
  const [part,setPart]=useState<'head'|'shank'>('head');
  const [headZone,setHeadZone]=useState<'center'|'halo'>('center');
  const [view,setView]=useState<RingView>('overall'),[reset,setReset]=useState(0);
  const [compare,setCompare]=useState(false),[review,setReview]=useState(false);
  const [saveError,setSaveError]=useState(false),[message,setMessage]=useState('');
  const [engraving,setEngraving]=useState(design.engraving);
  const capture=useRef<(()=>string|undefined)|null>(null);
  const zone=part==='shank'?(template.zones.includes('shoulder')?'shoulder':null):headZone;
  const quote=referenceQuote(template,design),details=referenceDetails(template,design);
  const engravingDirty=engraving!==design.engraving;
  const engravingError=engravingProblem(engraving.trim());
  const added=hasDemoOrder(revision);
  useEffect(()=>{
    try{localStorage.setItem(key,JSON.stringify({design,revision}));setSaveError(false);}
    catch{setSaveError(true);}
  },[key,design,revision]);
  function change(next:ReferenceDesign){
    if(JSON.stringify(next)===JSON.stringify(design))return;
    setHistory({design:next,revision:crypto.randomUUID(),past:[...past,design].slice(-10)});setMessage('');
  }
  function color(appearance:StoneAppearance){if(zone)change({...design,[zone]:appearance});}
  function confirm(){
    if(compare||engravingDirty)return;
    let thumbnail:string|undefined;
    try{thumbnail=capture.current?.();}catch{}
    try{
      addDemoOrder({templateRevision:template.revision,revision,confirmedAt:new Date().toISOString(),design,quote,details,thumbnail,
        stones:ring.stones.map(stone=>({id:stone.name,zone:stone.zone,appearance:design[stone.zone],placement:stone.matrix.toArray()})),
      });
      setReview(false);setMessage('已加入购物车。');
    }catch{setMessage('购物车未能保存，请允许浏览器存储后重试。');}
  }
  return <><div className="stone-first-main ring02-main">
    <section className="stone-first-preview" aria-label="戒指预览">
      <div className="ring02-preview-bar"><div><strong>{compare?'原款搭配':template.name}</strong><span>{ring.stones.length} 颗宝石</span></div><button aria-pressed={compare} onClick={()=>setCompare(!compare)}>对比原款</button></div>
      <SourceRingStage ring={ring} template={template} design={compare?ORIGINAL_REFERENCE:design} view={view} reset={reset} captureRef={capture}/>
      <div className="stone-first-camera-views" role="group" aria-label="戒指观察视角">{VIEWS.map(([id,label])=><button key={id} aria-pressed={view===id} onClick={()=>{setView(id);setReset(n=>n+1);}}>{label}</button>)}</div>
    </section>
    <section className="stone-first-panel" aria-label="戒指配置">
      <header className="ring02-product"><h1>{template.name}</h1><p>{template.collection} · 银色金属外观</p></header>
      <div className="ring02-zones" role="group" aria-label="选择戒指部件"><button aria-pressed={part==='head'} onClick={()=>setPart('head')}><span aria-hidden="true">01</span>戒头</button><button aria-pressed={part==='shank'} onClick={()=>setPart('shank')}><span aria-hidden="true">02</span>戒圈</button></div>
      <div className="stone-first-fields ring02-fields source-ring-fields">
        {part==='head'&&<><h2>原款镶座</h2><p>{template.description}</p>
          {template.zones.includes('halo')&&<div className="ring02-head-zones stone-first-options" role="group" aria-label="戒头镶嵌区域">{(['center','halo'] as const).map(id=><button key={id} aria-pressed={headZone===id} onClick={()=>setHeadZone(id)}>{ZONE_NAMES[id]}</button>)}</div>}
        </>}
        {zone?<fieldset disabled={compare}><legend>{ZONE_NAMES[zone]}搭配</legend><div className="stone-first-options ring02-gems">{STONE_APPEARANCE_IDS.map(id=><button key={id} aria-pressed={design[zone]===id} onClick={()=>color(id)}><i className={'ring02-swatch swatch-'+id} aria-hidden="true"/>{STONE_APPEARANCES[id].name}{id!=='diamond'?' +¥100':''}</button>)}</div></fieldset>:<><h2>素面戒臂</h2><p>这款保留原作的银色素面戒臂。</p></>}
        <div className="ring02-layout-note"><p>保留原款切形、大小与配钻布局，可搭配宝石外观和内圈刻字。</p></div>
        {part==='shank'&&<fieldset disabled={compare} className="ring02-engraving"><legend>内圈刻字 <span>选填</span></legend>
          <label className="sr-only" htmlFor="source-engraving">刻字文字</label><input id="source-engraving" value={engraving} autoComplete="off" spellCheck={false} placeholder="例如  A & B" aria-describedby="source-engraving-help source-engraving-error" onChange={event=>setEngraving(event.target.value)}/>
          <p id="source-engraving-help">最多 {ENGRAVING_LIMIT} 个字符，支持英文字母、数字、空格和 . &amp; -</p>
          <figure className="ring02-engraving-sample"><blockquote>{engraving.trim()&&!engravingError?engraving.trim():'刻字预览'}</blockquote><figcaption>内圈位置示意 · 字体与工艺待确认</figcaption></figure>
          <p id="source-engraving-error" role="alert">{engravingError}</p>
          <div className="ring02-engraving-actions"><button disabled={!engravingDirty} onClick={()=>setEngraving(design.engraving)}>取消修改</button><button disabled={!engravingDirty||!!engravingError} onClick={()=>{const text=engraving.trim();change({...design,engraving:text});setEngraving(text);}}>确认刻字</button></div>
        </fieldset>}
      </div>
      <details className="ring02-summary"><summary>配置摘要</summary><dl className="source-ring-summary">{details.map(detail=><div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl></details>
      <div className="ring02-actions"><button disabled={!past.length||compare} onClick={()=>{const next=past[past.length-1];setHistory({design:next,revision:crypto.randomUUID(),past:past.slice(0,-1)});setEngraving(next.engraving);setMessage('');}}>撤销</button><button disabled={compare} onClick={()=>{change(ORIGINAL_REFERENCE);setEngraving('');}}>恢复原款</button></div>
      <p className="ring02-status ring02-editor-feedback" role="status">{compare?'正在对比原款。再次点击可继续编辑。':message}</p>
      <p className="ring02-status" role={saveError?'alert':undefined}>{saveError?'浏览器未能保存草稿，请保留此页面。':engravingDirty?'请确认或取消刻字修改。':'草稿已保留在本机'}</p>
    </section>
  </div>
    <section className="ring02-purchase" aria-label="估价与演示加购"><div><p>参考估价 <strong>{formatYuan(quote.amount)}</strong></p><small>示例交期 {quote.leadTime} · 待工艺确认</small></div>
      {added&&!engravingDirty?<a className="shop-button" href="#/diy/cart">查看购物车</a>:part==='head'?<button className="shop-button" onClick={()=>setPart('shank')}>下一步 · 配置戒圈</button>:<button className="shop-button" disabled={compare||engravingDirty} onClick={()=>{setMessage('');setReview(true);}}>查看方案</button>}
    </section>
    {review&&<ReviewDialog title="确认你的戒指方案" onClose={()=>setReview(false)}><p>{template.name} · 参考估价 {formatYuan(quote.amount)}</p><dl>{details.map(detail=><div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl><p>当前为演示加购，价格、圈号与制作工艺待正式确认。</p>{message&&<p role="alert">{message}</p>}<div className="ring02-dialog-actions"><button autoFocus onClick={()=>setReview(false)}>继续修改</button><button className="shop-button" onClick={confirm}>确认并加入演示购物车</button></div></ReviewDialog>}
  </>;
}

export function SourceRingStudio({templateId}:{templateId:string}){
  const template=RING_CATALOG.find(item=>item.id===templateId)!;
  const [ring,setRing]=useState<ReferenceRing|null>(null),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();let owned:ReferenceRing|undefined;
    fetch(template.model,{signal:controller.signal}).then(response=>{if(!response.ok)throw new Error('模型不可用');return response.arrayBuffer();}).then(async bytes=>{
      if(controller.signal.aborted)return;
      const {scene}=await jewelryModelLoader().parseAsync(bytes,'');
      if(controller.signal.aborted){scene.traverse(object=>{if(object instanceof Mesh){object.geometry.dispose();(Array.isArray(object.material)?object.material:[object.material]).forEach(material=>material.dispose());}});return;}
      owned=prepareReferenceRing(scene);setRing(owned);
    }).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return ()=>{controller.abort();owned?.dispose();};
  },[template,attempt]);
  return <main className="stone-first-workspace ring02-workspace"><nav className="ring02-breadcrumb" aria-label="所在页面"><a href="#/diy/collection">全部款式</a><span aria-hidden="true">/</span><span aria-current="page">{template.name}</span></nav>
    <RingStylePicker id={template.id}/>
    {ring?<Editor template={template} ring={ring}/>:<SourceLoading template={template} retry={error?()=>{setError(false);setAttempt(n=>n+1);}:undefined}/>}
  </main>;
}
