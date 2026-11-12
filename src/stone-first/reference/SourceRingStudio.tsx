import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {preloadJewelryLighting} from '../../viewer/JewelryLighting';
import {STONE_APPEARANCES,STONE_APPEARANCE_IDS,type StoneAppearance} from '../../viewer/stoneAppearance';
import {RING_CATALOG,type CatalogRing} from '../catalog';
import {RingStylePicker} from '../RingStylePicker';
import {ReviewDialog} from '../ring02/ReviewDialog';
import {VIEWS,type RingView} from '../ring02/Ring02Stage';
import {ENGRAVING_LIMIT,engravingProblem} from '../ring02/engraving';
import {addDemoOrder,formatYuan,hasDemoOrder} from '../ring02/demoOrder';
import {createReferenceLibrary} from './part-library';
import {ORIGINAL_REFERENCE,parseReferenceDesign,referenceDetails,referenceParts,referenceQuote,ZONE_NAMES,type ReferenceDesign} from './design';
import {BAND_STYLES,bandStyle,headName} from './parts';
import {PAVE_DIAMETERS,PAVE_LENGTHS,describePaveGap} from './pave-options';
import {applyReferencePave} from './pave';
import {SourceLoading,SourceRingStage,type SourceFrame} from './SourceRingStage';
import '../stone-first.css';
import '../ring02/ring02.css';
import './source-ring-picker.css';

preloadJewelryLighting();

type PartChoice={id:string;name:string;image:string};
const sourceImage=(id:string)=>RING_CATALOG.find(ring=>ring.id===id)!.image;
const headChoices=RING_CATALOG.map(ring=>({id:ring.id,name:headName(ring.name),image:ring.image}));
const bandChoices=BAND_STYLES.map(style=>({id:style.name,name:style.name,image:sourceImage(style.finishes[0].id)}));

function PartChoices({kind,label,choices,selected,disabled,pending,onSelect}:{
  kind:'head'|'band'|'finish';label:string;choices:readonly PartChoice[];selected:string;
  disabled:boolean;pending:boolean;onSelect:(id:string)=>void;
}){
  const fixed=kind==='finish'&&choices.length===1;
  return <fieldset className={'source-part-options source-'+kind+'-options'} disabled={disabled}>
    <legend>{label}</legend>
    {fixed?<p className="source-fixed-finish">{choices[0].name}</p>:
      <div className="source-part-grid">{choices.map(item=><button type="button" key={item.id} className="source-part-card" aria-pressed={selected===item.id} onClick={()=>onSelect(item.id)}>
        <span className="source-part-image"><img src={item.image} alt="" decoding="async" loading="lazy"/></span>
        <span className="source-part-name">{item.name}{pending&&selected===item.id&&<span className="ring02-spinner" aria-hidden="true"/>}</span>
      </button>)}</div>}
  </fieldset>;
}

function Editor({template}:{template:CatalogRing}){
  const originalKey='open-jewelry-studio:'+template.revision;
  const key=template.kind==='parametric'?originalKey+':combination':originalKey;
  const [history,setHistory]=useState(()=>{
    try{
      // Earlier combination previews used the precision editor's key. Only migrate reference drafts.
      const saved=JSON.parse(localStorage.getItem(key)??(key!==originalKey?localStorage.getItem(originalKey):null)??'null');
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
  const [captureFrame,setCaptureFrame]=useState<SourceFrame|null>(null);
  const {head,band,zones}=referenceParts(template,design);
  const style=bandStyle(band.id);
  const selection=useReferenceSelection(compare?template.id:head.id,compare?template.id:band.id);
  const paved=zones.includes('shoulder');
  const diameter=compare||!paved?100:design.paveDiameter??100;
  const length=compare||!paved?100:design.paveLength??100;
  const ring=useMemo(()=>selection.parts?applyReferencePave(selection.parts.stock,selection.parts.band,diameter,length):null,
    [selection.parts,diameter,length]);
  const pave=ring?.pave;
  const loadingError=selection.error;
  const zone=part==='shank'?(zones.includes('shoulder')?'shoulder':null):zones.includes(headZone)?headZone:'center';
  const mixed=head.id!==template.id||band.id!==template.id;
  const displayName=mixed?headName(head.name)+' × '+style.name:template.name;
  const sceneDesign=compare?ORIGINAL_REFERENCE:design;
  const canCapture=ring!==null&&captureFrame?.ring===ring&&captureFrame.design===sceneDesign;
  const sceneName=compare?'原款搭配':displayName;
  const lastPreview=useRef<{ring:NonNullable<typeof ring>;design:ReferenceDesign;name:string}>(null);
  useLayoutEffect(()=>{
    if(canCapture&&captureFrame)lastPreview.current={...captureFrame,name:sceneName};
  },[canCapture,captureFrame,sceneName]);
  const preview=ring?{ring,design:sceneDesign,name:sceneName}:lastPreview.current;
  const visiblePreview=canCapture?preview:lastPreview.current;
  const swapping=!ring&&!loadingError;
  const previousParts=visiblePreview?referenceParts(template,visiblePreview.design):null;
  const quote=referenceQuote(template,design),details=referenceDetails(template,design,compare?null:pave);
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
  function selectHead(id:string){
    if(id===head.id)return;
    change({...design,headId:id});setHeadZone('center');
  }
  function selectBand(name:string){
    if(name===style.name)return;
    const next=BAND_STYLES.find(item=>item.name===name)!;
    const paved=band.zones.includes('shoulder');
    const finish=next.finishes.find(item=>(item.name!=='素面')===paved)??next.finishes[0];
    change({...design,bandId:finish.id});
    if(finish.name!==style.finishes.find(item=>item.id===band.id)?.name)setMessage(name+'采用'+finish.name+'。');
  }
  function selectFinish(id:string){
    if(id!==band.id)change({...design,bandId:id});
  }
  function confirm(){
    if(compare||engravingDirty||!ring||!canCapture)return;
    let thumbnail:string|undefined;
    try{thumbnail=capture.current?.();}catch{}
    if(!thumbnail){setMessage('搭配图片暂未生成，请重试。');return;}
    try{
      addDemoOrder({templateRevision:template.revision,revision,confirmedAt:new Date().toISOString(),design,quote,details,thumbnail,
        stones:ring.stones.map(stone=>({id:stone.name,zone:stone.zone,appearance:design[stone.zone],placement:stone.matrix.toArray()})),
      });
      setReview(false);setMessage('已加入购物车。');
    }catch{setMessage('购物车未能保存，请允许浏览器存储后重试。');}
  }
  return <><div className="stone-first-main ring02-main source-ring-main" data-editing-pave={part==='shank'&&paved?true:undefined}>
    <section className="stone-first-preview" aria-label="戒指预览">
      <div className="ring02-preview-bar"><div><strong>{visiblePreview?.name??sceneName}</strong><span>{visiblePreview?visiblePreview.ring.stones.length+' 颗宝石':''}</span></div><button aria-pressed={compare} onClick={()=>setCompare(!compare)}>对比原款</button></div>
      {preview?<SourceRingStage ring={preview.ring} template={template} design={preview.design} view={view} reset={reset} captureRef={capture} onCaptureReady={setCaptureFrame}/>
        :<div className="stone-first-canvas ring02-canvas source-ring-canvas">
          <SourceLoading template={template} retry={loadingError?selection.retry:undefined}/>
        </div>}
      {!ring&&visiblePreview&&<div className="source-ring-swap-status" role={loadingError?'alert':'status'}>
        {loadingError?<><span>新搭配未加载</span><button onClick={selection.retry}>重试</button></>:'正在更新搭配…'}
      </div>}
      <div className="stone-first-camera-views" role="group" aria-label="戒指观察视角">{VIEWS.map(([id,label])=><button key={id} aria-pressed={view===id} onClick={()=>{setView(id);setReset(n=>n+1);}}>{label}</button>)}</div>
    </section>
    <section className="stone-first-panel" aria-label="戒指配置">
      <header className="ring02-product"><h1>专属定制</h1><p>{displayName} · 银色</p></header>
      <div className="source-part-tabs" role="group" aria-label="选择戒指部件"><button aria-pressed={part==='head'} onClick={()=>setPart('head')}>戒头</button><button aria-pressed={part==='shank'} onClick={()=>setPart('shank')}>戒圈与铺钻</button></div>
      <div className="stone-first-fields ring02-fields source-ring-fields">
        {part==='head'?<>
          <PartChoices kind="head" label="戒头款式" choices={headChoices} selected={head.id} disabled={compare} pending={swapping&&previousParts?.head.id!==head.id} onSelect={selectHead}/>
          {zones.includes('halo')&&<div className="ring02-head-zones stone-first-options" role="group" aria-label="戒头镶嵌区域">{(['center','halo'] as const).map(id=><button key={id} aria-pressed={zone===id} onClick={()=>setHeadZone(id)}>{ZONE_NAMES[id]}</button>)}</div>}
        </>:<>
          <PartChoices kind="band" label="戒圈结构" choices={bandChoices} selected={style.name} disabled={compare} pending={swapping&&!!previousParts&&bandStyle(previousParts.band.id).name!==style.name} onSelect={selectBand}/>
          <PartChoices kind="finish" label="戒臂铺钻" choices={style.finishes.map(item=>({...item,image:sourceImage(item.id)}))} selected={band.id} disabled={compare} pending={swapping&&previousParts?.band.id!==band.id} onSelect={selectFinish}/>
          {paved&&<>
            <fieldset disabled={compare}><legend>配钻石径</legend>
              <div className="stone-first-options">{PAVE_DIAMETERS.map(value=><button key={value} aria-pressed={diameter===value}
                onClick={()=>diameter!==value&&change({...design,paveDiameter:value})}>{value===100?'原款基准':value+'%'}</button>)}</div>
            </fieldset>
            <fieldset disabled={compare}><legend>铺钻长度</legend>
              <div className="stone-first-options">{PAVE_LENGTHS.map(value=><button key={value} aria-pressed={length===value}
                onClick={()=>length!==value&&change({...design,paveLength:value})}>{value===100?'原款长度':value+'%'}</button>)}</div>
            </fieldset>
            <div className="ring02-layout-note source-pave-result" role="status" aria-label="排钻结果">
              <dl>
                <div><dt>戒臂配钻</dt><dd>{pave?pave.count+' 颗（左右各 '+pave.count/2+' 颗）':'—'}</dd></div>
                <div><dt>同列配钻间距</dt><dd>{pave?describePaveGap(pave):'—'}</dd></div>
              </dl>
              <p>石径以该戒圈原款最小配钻为基准。长度从戒头向两侧计算。</p>
            </div>
          </>}
        </>}
        {zone?<fieldset disabled={compare}><legend>{ZONE_NAMES[zone]}搭配</legend><div className="stone-first-options ring02-gems">{STONE_APPEARANCE_IDS.map(id=><button key={id} aria-pressed={design[zone]===id} onClick={()=>color(id)}><i className={'ring02-swatch swatch-'+id} aria-hidden="true"/>{STONE_APPEARANCES[id].name}{id!=='diamond'?' +¥100':''}</button>)}</div></fieldset>:<><h2>素面戒臂</h2><p>这款戒臂采用银色素面。</p></>}

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
      {added&&!engravingDirty?<a className="shop-button" href="#/diy/cart">查看购物车</a>:part==='head'?<button className="shop-button" onClick={()=>setPart('shank')}>下一步 · 配置戒圈</button>:<button className="shop-button" disabled={compare||engravingDirty||!canCapture} onClick={()=>{setMessage('');setReview(true);}}>查看方案</button>}
    </section>
    {review&&<ReviewDialog title="确认你的戒指方案" onClose={()=>setReview(false)}><p>{displayName} · 参考估价 {formatYuan(quote.amount)}</p><dl>{details.map(detail=><div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl><p>当前为演示加购，价格、圈号与制作工艺待正式确认。</p>{message&&<p role="alert">{message}</p>}<div className="ring02-dialog-actions"><button autoFocus onClick={()=>setReview(false)}>继续修改</button><button className="shop-button" disabled={!canCapture} onClick={confirm}>确认并加入演示购物车</button></div></ReviewDialog>}
  </>;
}

function useReferenceSelection(headId:string,bandId:string){
  type Loaded=Awaited<ReturnType<ReturnType<typeof createReferenceLibrary>['load']>>;
  const [library,setLibrary]=useState<ReturnType<typeof createReferenceLibrary>>();
  const [loaded,setLoaded]=useState<{key:string;parts:Loaded}>();
  const [failed,setFailed]=useState<string>(),[attempt,setAttempt]=useState(0);
  const key=headId+':'+bandId;
  useEffect(()=>{
    const next=createReferenceLibrary();
    setLibrary(next);
    return ()=>next.dispose();
  },[]);
  useEffect(()=>{
    if(!library)return;
    let current=true;
    library.load(headId,bandId).then(parts=>{
      if(current){setLoaded({key,parts});setFailed(undefined);}
    }).catch(()=>{if(current)setFailed(key);});
    return ()=>{current=false;};
  },[library,headId,bandId,key,attempt]);
  return {parts:loaded?.key===key?loaded.parts:undefined,error:failed===key,
    retry:()=>{setFailed(undefined);setAttempt(value=>value+1);}};
}

export function SourceRingStudio({templateId}:{templateId:string}){
  const template=RING_CATALOG.find(item=>item.id===templateId)!;
  return <main className="stone-first-workspace ring02-workspace">
    <div className="source-ring-entry">
      <div><nav className="ring02-breadcrumb" aria-label="所在页面"><a href="#/diy/collection">全部款式</a><span aria-hidden="true">/</span><span aria-current="page">{template.name}</span></nav>
        {template.kind==='parametric'&&<a className="source-precision-link" href={template.editor}>精调原款围钻</a>}
      </div>
      <RingStylePicker id={template.id}/>
    </div>
    <Editor template={template}/>
  </main>;
}
