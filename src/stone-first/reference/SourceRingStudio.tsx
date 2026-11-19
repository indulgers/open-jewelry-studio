import {referenceDesignBasis} from '../../community/design-basis';
import {SaveCommunityDesign} from '../../community/SaveCommunityDesign';
import {RingFitField} from '../fit/RingFitField';
import {useFitScope} from '../fit/FitSession';
import {fitStorageKey,newDesignFit} from '../fit/profile';
import {ReferenceStylingFields} from './ReferenceStylingFields';
import {PLATING,isCustomStyling,type ReferenceStyling} from './styling';
import {EngravingEditor} from '../engraving/EngravingEditor';
import {DEFAULT_ENGRAVING_STYLE,type EngravingStyle} from '../engraving/style';
import {FeedbackToast,type Feedback} from '../../components/FeedbackToast';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {preloadJewelryLighting} from '../../viewer/JewelryLighting';
import {STONE_APPEARANCES,STONE_APPEARANCE_IDS,type StoneAppearance} from '../../viewer/stoneAppearance';
import {RING_CATALOG,type CatalogRing} from '../catalog';
import {RingStylePicker} from '../RingStylePicker';
import {ReviewDialog} from '../ring02/ReviewDialog';
import {RING02_PRECISION_ROUTE} from '../ring02/assets';
import {VIEWS,type RingView,type RingCapture} from '../ring02/Ring02Stage';
import {engravingProblem} from '../ring02/engraving';
import {confirmQuote} from '../purchase';
import {addDemoOrder,formatYuan,hasDemoOrder} from '../ring02/demoOrder';
import {createReferenceLibrary} from './part-library';
import {PartCard,PartLibrary,headChoices,bandImage} from './PartLibrary';
import {ORIGINAL_REFERENCE,parseReferenceDesign,referenceDetails,referenceParts,referenceQuote,ZONE_NAMES,type ReferenceDesign} from './design';
import {BAND_STYLES,bandStyle,headName} from './parts';
import {PAVE_DIAMETERS,PAVE_LENGTHS,describePaveGap} from './pave-options';
import {applyReferencePave} from './pave';
import {SourceLoading,SourceRingStage,type SourceFrame} from './SourceRingStage';
import '../stone-first.css';
import '../ring02/ring02.css';
import './source-ring-picker.css';

const VIEW_ICONS={
  top:new URL('./icons/view-top.svg',import.meta.url).href,
  side:new URL('./icons/view-side.svg',import.meta.url).href,
};

preloadJewelryLighting();

type PartChoice={id:string;name:string;image:string};
const listed=(id:string)=>RING_CATALOG.some(item=>item.id===id&&item.listed);
const bandChoices=BAND_STYLES.filter(style=>style.finishes.some(finish=>listed(finish.id))).map(style=>({id:style.name,name:style.name,image:bandImage((style.finishes.find(finish=>listed(finish.id))??style.finishes[0]).id)}));

function PartChoices({kind,label,choices,selected,disabled,pending,onSelect}:{
  kind:'head'|'band'|'finish';label:string;choices:readonly PartChoice[];selected:string;
  disabled:boolean;pending:boolean;onSelect:(id:string)=>void;
}){
  const fixed=kind==='finish'&&choices.length===1;
  const visible=kind==='finish'?choices:[...choices.slice(0,4),...(choices.slice(0,4).some(item=>item.id===selected)?[]:choices.filter(item=>item.id===selected))];
  return <fieldset className={'source-part-options source-'+kind+'-options'} disabled={disabled}>
    <legend>{label}</legend>
    {fixed?<p className="source-fixed-finish">{choices[0].name}</p>:
      <div className="source-part-grid">{visible.map(({id,name,image})=><PartCard key={id} item={{id,name,image}}
        selected={selected===id} pending={pending} onSelect={onSelect}/>)}</div>}
  </fieldset>;
}

function Editor({template}:{template:CatalogRing}){
  const scope=useFitScope();
  const originalKey='open-jewelry-studio:'+template.revision;
  const key=fitStorageKey('open-jewelry-studio:combination:'+template.id,scope);
  const legacyKey='open-jewelry-studio:'+(template.legacyRevision??template.revision)+(template.kind==='parametric'?':combination':'');
  const [history,setHistory]=useState(()=>{
    try{
      // Earlier combination previews used the precision editor's key. Only migrate reference drafts.
      const stored=key?localStorage.getItem(key):null;
      const legacy=scope==='guest'&&!stored?localStorage.getItem(legacyKey)??localStorage.getItem(originalKey):null;
      const saved=JSON.parse(stored??legacy??'null');
      const design=parseReferenceDesign(saved?.design);
      if(design&&typeof saved.revision==='string'&&saved.revision.length<=128)return {design,revision:saved.revision,past:[] as ReferenceDesign[]};
    }catch{}
    return {design:{...ORIGINAL_REFERENCE,...newDesignFit(scope)},revision:crypto.randomUUID() as string,past:[] as ReferenceDesign[]};
  });
  const {design,revision,past}=history;
  const [part,setPart]=useState<'head'|'shank'>('head');
  const [library,setLibrary]=useState<'head'|'band'|null>(null);
  const libraryTrigger=useRef<HTMLButtonElement>(null);
  const [headZone,setHeadZone]=useState<'center'|'halo'>('center');
  const [view,setView]=useState<RingView>('overall'),[reset,setReset]=useState(0);
  const [compare,setCompare]=useState(false),[review,setReview]=useState(false);
  const [adding,setAdding]=useState(false);
  const [cartFeedback,setCartFeedback]=useState<Feedback>();
  const [saveError,setSaveError]=useState(false),[message,setMessage]=useState('');
  const [engraving,setEngraving]=useState(design.engraving);
  const [engravingStyle,setEngravingStyle]=useState<EngravingStyle>(design.engravingStyle??DEFAULT_ENGRAVING_STYLE);
  const [engravingView,setEngravingView]=useState(false);
  const capture=useRef<RingCapture|null>(null);
  const [captureFrame,setCaptureFrame]=useState<SourceFrame|null>(null);
  const {head,band,zones}=referenceParts(template,design);
  const style=bandStyle(band.id);
  const selection=useReferenceSelection(compare?template.id:head.id,compare?template.id:band.id);
  const paved=zones.includes('shoulder');
  const automaticPave=paved&&band.automaticPave!==false;
  const diameter=compare||!automaticPave?100:design.paveDiameter??100;
  const length=compare||!automaticPave?100:design.paveLength??100;
  const layout=useMemo(()=>{try{return {ring:selection.parts?applyReferencePave(selection.parts.stock,selection.parts.band,diameter,length):null};}
    catch(error){return {ring:null,error:error instanceof Error?error.message:'当前排钻无法完成，请调整参数。'};}},[selection.parts,diameter,length]);
  const ring=layout.ring;
  const pave=ring?.pave;
  const loadingError=selection.error||layout.error;
  const zone=part==='shank'?(zones.includes('shoulder')?'shoulder':null):zones.includes(headZone)?headZone:'center';
  const mixed=head.id!==template.id||band.id!==template.id;
  const displayName=mixed?headName(head.name)+' × '+style.name:template.name;
  const sceneDesign=useMemo(()=>compare?ORIGINAL_REFERENCE:engravingProblem(engraving.trim())?design:{...design,engraving:engraving.trim(),engravingStyle},[compare,design,engraving,engravingStyle]);
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
  const engravingDirty=engraving!==design.engraving||engravingStyle.font!==(design.engravingStyle??DEFAULT_ENGRAVING_STYLE).font||engravingStyle.align!==(design.engravingStyle??DEFAULT_ENGRAVING_STYLE).align;
  const added=hasDemoOrder(revision);
  useEffect(()=>{
    if(!key){setSaveError(true);return;}
    try{localStorage.setItem(key,JSON.stringify({design,revision}));setSaveError(false);}
    catch{setSaveError(true);}
  },[key,design,revision]);
  function change(next:ReferenceDesign){
    if(JSON.stringify(next)===JSON.stringify(design))return;
    setHistory({design:next,revision:crypto.randomUUID(),past:[...past,design].slice(-10)});setMessage('');
  }
  const styled=isCustomStyling(design.styling);
  function changeStyling(styling:ReferenceStyling){
    change({...design,styling:isCustomStyling(styling)?styling:undefined});
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
    const finish=next.finishes.find(item=>listed(item.id)&&(item.name!=='素面')===paved)??next.finishes.find(item=>listed(item.id))!;
    change({...design,bandId:finish.id});
    if(finish.name!==style.finishes.find(item=>item.id===band.id)?.name)setMessage(name+'采用'+finish.name+'。');
  }
  function selectFinish(id:string){
    if(id!==band.id)change({...design,bandId:id});
  }
  function exportPreview(){
    if(!canCapture||engravingDirty||compare)return;
    try{
      const preview=capture.current?.();
      if(!preview)throw new Error('当前预览图片尚未生成。');
      const snapshot={templateId:template.id,templateRevision:template.revision,revision,design,details,preview,status:'待工艺与报价确认'};
      const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'}));
      const link=document.createElement('a');
      link.href=url;
      link.download='相言-'+template.name+'-'+revision+'.json';
      link.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      setCartFeedback(undefined);
    }catch(error){
      setCartFeedback({tone:'error',title:'暂时无法下载设计方案',description:error instanceof Error?error.message:'请重试。'});
    }
  }
  async function confirm(){
    if(styled||compare||engravingDirty||!ring||!canCapture||adding)return;
    let thumbnail:string|undefined;
    try{thumbnail=capture.current?.();}catch{}
    if(!thumbnail){setCartFeedback({tone:'error',title:'购物车未能保存',description:'搭配图片暂未生成。'});return;}
    setAdding(true);setCartFeedback(undefined);
    try{
      let confirmed=quote;
      if(import.meta.env.PROD||import.meta.env.VITE_CLOUD_MODE){
        const query=new URLSearchParams({head:head.id,band:band.id,headRevision:head.revision,bandRevision:band.revision,center:design.center,halo:design.halo,shoulder:design.shoulder});
        confirmed=await confirmQuote('combination-quote?'+query,quote);
      }
      addDemoOrder({name:displayName,templateRevision:template.revision,revision,confirmedAt:new Date().toISOString(),design,quote:confirmed,details,thumbnail,
        stones:ring.stones.map(stone=>({id:stone.name,zone:stone.zone,appearance:design[stone.zone],placement:stone.matrix.toArray()})),
      });
      setReview(false);setCartFeedback({tone:'success',title:'已加入购物车',description:'你的戒指方案已保存。'});
    }catch(error){setCartFeedback({tone:'error',title:'购物车未能保存',description:error instanceof Error?error.message:'当前配置仍在编辑器中。'});}finally{setAdding(false);}
  }
  return <><div className="stone-first-main ring02-main source-ring-main">
    <section className="stone-first-preview" aria-label="戒指预览">
      <div className="ring02-preview-bar"><div><strong>{visiblePreview?.name??sceneName}</strong><span>{visiblePreview?visiblePreview.ring.stones.length+' 颗宝石':''}</span></div><button aria-pressed={compare} onClick={()=>setCompare(!compare)}>对比原款</button></div>
      <div className="stone-first-camera-views source-camera-toolbar" role="group" aria-label="戒指观察视角">
        {VIEWS.map(([id,label])=><button key={id} aria-pressed={!engravingView&&view===id} onClick={()=>{setEngravingView(false);setView(id);setReset(n=>n+1);}}>
          {(id==='top'||id==='side')&&<img src={VIEW_ICONS[id]} width={16} height={16} alt=""/>}
          {label}
        </button>)}
      </div>
      {preview?<SourceRingStage ring={preview.ring} template={template} design={preview.design} engravingView={engravingView} view={view} reset={reset} captureRef={capture} onCaptureReady={setCaptureFrame}/>
        :<div className="stone-first-canvas ring02-canvas source-ring-canvas">
          <SourceLoading template={template} retry={loadingError?selection.retry:undefined}/>
        </div>}
      {!ring&&visiblePreview&&<div className="source-ring-swap-status" role={loadingError?'alert':'status'}>
        {loadingError?<><span>{loadingError}</span><button onClick={selection.retry}>重试</button></>:'正在更新搭配…'}
      </div>}
    </section>
    <section className="stone-first-panel" aria-label="戒指配置">
      <header className="ring02-product"><h1>专属定制</h1><p>{displayName} · {PLATING[design.styling?.plating??'white']}</p></header>
      <div className="source-part-tabs" role="group" aria-label="选择戒指部件"><button aria-pressed={part==='head'} onClick={()=>setPart('head')}>戒头</button><button aria-pressed={part==='shank'} onClick={()=>setPart('shank')}>戒圈与铺钻</button></div>
      <div className="stone-first-fields ring02-fields source-ring-fields">
        <button type="button" className="source-library-trigger shop-text-link" ref={libraryTrigger} aria-haspopup="dialog"
          aria-label={part==='head'?'查看全部戒头':'查看全部戒圈'} disabled={compare} onClick={()=>setLibrary(part==='head'?'head':'band')}>查看全部</button>
        {part==='head'?<>
          <PartChoices kind="head" label="戒头款式" choices={headChoices.filter(item=>listed(item.id)||item.id===head.id)} selected={head.id} disabled={compare} pending={swapping&&previousParts?.head.id!==head.id} onSelect={selectHead}/>
          {zones.includes('halo')&&<div className="ring02-head-zones stone-first-options" role="group" aria-label="戒头镶嵌区域">{(['center','halo'] as const).map(id=><button key={id} aria-pressed={zone===id} onClick={()=>setHeadZone(id)}>{ZONE_NAMES[id]}</button>)}</div>}
        </>:<>
          <PartChoices kind="band" label="戒圈结构" choices={bandChoices} selected={style.name} disabled={compare} pending={swapping&&!!previousParts&&bandStyle(previousParts.band.id).name!==style.name} onSelect={selectBand}/>
          <PartChoices kind="finish" label="戒臂铺钻" choices={style.finishes.filter(item=>listed(item.id)||item.id===band.id).map(item=>({...item,image:bandImage(item.id)}))} selected={band.id} disabled={compare} pending={swapping&&previousParts?.band.id!==band.id} onSelect={selectFinish}/>
          {automaticPave&&<>
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
        {zone==='center'?<ReferenceStylingFields section="center" value={design.styling} disabled={compare} onChange={changeStyling}/>:zone?<fieldset disabled={compare}><legend>{ZONE_NAMES[zone]}搭配</legend><div className="stone-first-options ring02-gems">{STONE_APPEARANCE_IDS.map(id=><button key={id} aria-pressed={design[zone]===id} onClick={()=>color(id)}><i className={'ring02-swatch swatch-'+id} aria-hidden="true"/>{STONE_APPEARANCES[id].name}{id!=='diamond'?' +¥100':''}</button>)}</div></fieldset>:<><h2>素面戒臂</h2><p>这款戒臂采用银色素面。</p></>}

        {part==='shank'&&<ReferenceStylingFields section="metal" value={design.styling} disabled={compare} onChange={changeStyling}/>}
        {part==='shank'&&<RingFitField value={design.ringSizeUS} disabled={compare} onChange={ringSizeUS=>change({...design,ringSizeUS})}/>}
      </div>
      <EngravingEditor id="source-engraving" text={engraving} style={engravingStyle} disabled={compare} dirty={engravingDirty}
          onText={setEngraving} onStyle={setEngravingStyle} onView={()=>{setEngravingView(true);setReset(n=>n+1);if(matchMedia('(max-width:800px)').matches)document.querySelector('.stone-first-preview')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});}}
          onCancel={()=>{setEngraving(design.engraving);setEngravingStyle(design.engravingStyle??DEFAULT_ENGRAVING_STYLE);}}
          onConfirm={()=>{const text=engraving.trim();change({...design,engraving:text,engravingStyle});setEngraving(text);}}/>
      <details className="ring02-summary"><summary>配置摘要</summary><dl className="source-ring-summary">{details.map(detail=><div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>{template.kind==='parametric'&&<a className="source-precision-link" href={RING02_PRECISION_ROUTE}>精调原款围钻</a>}</details>
      <div className="ring02-actions"><button disabled={!past.length||compare} onClick={()=>{const next=past[past.length-1];setHistory({design:next,revision:crypto.randomUUID(),past:past.slice(0,-1)});setEngraving(next.engraving);setEngravingStyle(next.engravingStyle??DEFAULT_ENGRAVING_STYLE);setMessage('');}}>撤销</button><button disabled={compare} onClick={()=>{change(ORIGINAL_REFERENCE);setEngraving('');setEngravingStyle(DEFAULT_ENGRAVING_STYLE);}}>恢复原款</button></div>
      <p className="ring02-status ring02-editor-feedback" role="status">{compare?'正在对比原款。再次点击可继续编辑。':message}</p>
      <p className="ring02-status" role={saveError?'alert':undefined}>{saveError?'浏览器未能保存草稿，请保留此页面。':engravingDirty?'请确认或取消刻字修改。':'草稿已保留在本机'}</p>
    </section>
  </div>
    <section className="ring02-purchase" aria-label="估价与演示加购"><div>{styled?<><p>改款方案 <strong>待核价</strong></p><small>主石、镶座与金属工艺需另行确认</small></>:<><p>参考估价 <strong>{formatYuan(quote.amount)}</strong></p><small>示例交期 {quote.leadTime} · 待工艺确认</small></>}</div>
      <SaveCommunityDesign details={details} basis={referenceDesignBasis(template,head,band)} title={displayName} templateId={template.id} revision={revision} design={design} capture={()=>capture.current?.('inspection')} disabled={compare||engravingDirty||!canCapture}/>
      {added&&!engravingDirty?<a className="shop-button" href="#/diy/cart">查看购物车</a>:part==='head'?<button className="shop-button" onClick={()=>setPart('shank')}>下一步 · 配置戒圈</button>:<button className="shop-button" disabled={compare||engravingDirty||!canCapture} onClick={()=>{setMessage('');setCartFeedback(undefined);setReview(true);}}>查看方案</button>}
    </section>
    {library&&<PartLibrary kind={library} trigger={libraryTrigger} selected={library==='head'?head.id:band.id}
      onClose={()=>setLibrary(null)} onSelect={library==='head'?selectHead:selectFinish}/>}
    {!review&&<FeedbackToast notice={cartFeedback?.tone==='success'?cartFeedback:undefined} onDismiss={()=>setCartFeedback(undefined)}/>}
    {review&&<ReviewDialog title="确认你的戒指方案" busy={adding} onClose={()=>setReview(false)}><p>{displayName} · {styled?'待核价':'参考估价 '+formatYuan(quote.amount)}</p><dl>{details.map(detail=><div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>{styled?<p>方案包含改款效果图与所选规格，可下载交给工艺人员核对镶口、实石尺寸和报价。</p>:<p>当前为演示加购，价格、圈号与制作工艺待正式确认。</p>}<FeedbackToast inline notice={cartFeedback} onDismiss={()=>setCartFeedback(undefined)} onRetry={cartFeedback&&!adding?(styled?exportPreview:confirm):undefined}/><div className="ring02-dialog-actions"><button autoFocus disabled={adding} onClick={()=>setReview(false)}>继续修改</button><button className="shop-button" disabled={!canCapture||adding} onClick={styled?exportPreview:confirm}>{styled?'下载设计方案':adding?'正在加入…':'确认并加入演示购物车'}</button></div></ReviewDialog>}
  </>;
}

function useReferenceSelection(headId:string,bandId:string){
  type Loaded=Awaited<ReturnType<ReturnType<typeof createReferenceLibrary>['load']>>;
  const [library,setLibrary]=useState<ReturnType<typeof createReferenceLibrary>>();
  const [loaded,setLoaded]=useState<{key:string;parts:Loaded}>();
  const [failed,setFailed]=useState<{key:string;message:string}>(),[attempt,setAttempt]=useState(0);
  const key=headId+':'+bandId;
  useEffect(()=>{
    const next=createReferenceLibrary();
    setLibrary(next);
    return ()=>next.dispose();
  },[]);
  useEffect(()=>{
    if(!library)return;
    let current=true;
    library.load(RING_CATALOG.find(item=>item.id===headId)?.headSourceId??headId,RING_CATALOG.find(item=>item.id===bandId)?.bandSourceId??bandId).then(parts=>{
      if(current){setLoaded({key,parts});setFailed(undefined);}
    }).catch(error=>{if(current)setFailed({key,message:error instanceof Error?error.message:'新搭配未加载，请重试。'});});
    return ()=>{current=false;};
  },[library,headId,bandId,key,attempt]);
  return {parts:loaded?.key===key?loaded.parts:undefined,error:failed?.key===key?failed.message:undefined,
    retry:()=>{setFailed(undefined);setAttempt(value=>value+1);}};
}

export function SourceRingStudio({templateId}:{templateId:string}){
  const template=RING_CATALOG.find(item=>item.id===templateId)!;
  return <main className="stone-first-workspace ring02-workspace source-ring-workspace">
    <div className="source-ring-entry">
      <nav className="ring02-breadcrumb" aria-label="所在页面"><a href="#/diy/collection">全部款式</a><span aria-hidden="true">/</span><span aria-current="page">{template.name}</span></nav>
      <RingStylePicker id={template.id}/>
    </div>
    <Editor template={template}/>
  </main>;
}
