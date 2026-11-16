import {FeedbackToast,type Feedback} from '../../components/FeedbackToast';
import {useEffect,useLayoutEffect,useMemo,useReducer,useRef,useState} from 'react';
import {preloadJewelryLighting} from '../../viewer/JewelryLighting';
import {STONE_APPEARANCES,STONE_APPEARANCE_IDS,type StoneAppearance} from '../../viewer/stoneAppearance';
import {RING_CATALOG,type CatalogRing} from '../catalog';
import {RingStylePicker} from '../RingStylePicker';
import {ReviewDialog} from '../ring02/ReviewDialog';
import {RING02_PRECISION_ROUTE} from '../ring02/assets';
import {VIEWS,type RingView} from '../ring02/Ring02Stage';
import {ENGRAVING_LIMIT,engravingProblem} from '../ring02/engraving';
import {addDemoOrder,formatYuan,hasDemoOrder} from '../ring02/demoOrder';
import {createReferenceLibrary} from './part-library';
import {PartCard,PartLibrary,headChoices,sourceImage} from './PartLibrary';
import {ORIGINAL_REFERENCE,parseReferenceDesign,referenceDetails,referenceParts,referenceQuote,ZONE_NAMES,type ReferenceDesign} from './design';
import {BAND_STYLES,bandStyle,headName} from './parts';
import {PAVE_DIAMETERS,PAVE_LENGTHS,describePaveGap} from './pave-options';
import {applyReferencePave} from './pave';
import {SourceLoading,SourceRingStage,type SourceFrame} from './SourceRingStage';
import {draftKey,editorHistory,readEditorDraft,startNewDraft} from './editor-history';
import {useEditorExit} from './useEditorExit';
import '../stone-first.css';
import '../ring02/ring02.css';
import './source-ring-picker.css';

const VIEW_ICONS={
  top:new URL('./icons/view-top.svg',import.meta.url).href,
  side:new URL('./icons/view-side.svg',import.meta.url).href,
};

preloadJewelryLighting();

type PartChoice={id:string;name:string;image:string;detail?:string;price?:string};
const listed=(id:string)=>RING_CATALOG.some(item=>item.id===id&&item.listed);
const bandChoices=BAND_STYLES.filter(style=>style.finishes.some(finish=>listed(finish.id))).map(style=>({id:style.name,name:style.name,image:sourceImage((style.finishes.find(finish=>listed(finish.id))??style.finishes[0]).id)}));

function PartChoices({kind,label,choices,selected,disabled,pending,onSelect}:{
  kind:'head'|'band'|'finish';label:string;choices:readonly PartChoice[];selected:string;
  disabled:boolean;pending:boolean;onSelect:(id:string)=>void;
}){
  const fixed=kind==='finish'&&choices.length===1;
  const visible=kind==='finish'?choices:choices.slice(0,4).some(item=>item.id===selected)?choices.slice(0,4):[...choices.slice(0,3),...choices.filter(item=>item.id===selected)];
  return <fieldset id={'source-'+kind} tabIndex={-1} className={'source-part-options source-'+kind+'-options'} disabled={disabled}>
    <legend>{label}</legend>
    {fixed?<p className="source-fixed-finish">{choices[0].name}</p>:
      <div className="source-part-grid">{visible.map(item=><PartCard key={item.id} item={item}
        selected={selected===item.id} pending={pending} onSelect={onSelect}/>)}</div>}
  </fieldset>;
}

function Editor({template}:{template:CatalogRing}){
  const key=draftKey(template.id);
  const [restored]=useState(()=>readEditorDraft(template,localStorage));
  const [draftIssue,setDraftIssue]=useState(restored.issue);
  const [history,dispatch]=useReducer(editorHistory,restored.history);
  const {design,revision,past,future}=history;
  const [savedAt,setSavedAt]=useState('');
  const [saveAttempt,setSaveAttempt]=useState(0);
  const [pendingTemplate,setPendingTemplate]=useState<CatalogRing>();
  const [pendingChange,setPendingChange]=useState<{title:string;notes:string[];design:ReferenceDesign;clearEngraving?:boolean;recover?:boolean}>();
  const [recovery,setRecovery]=useState(()=>{try{return localStorage.getItem(key+':previous');}catch{return null;}});
  const [jump,setJump]=useState<string>();
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
  const capture=useRef<(()=>string|undefined)|null>(null);
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
  const [composing,setComposing]=useState(false);
  const engravingError=composing?'':engravingProblem(engraving.trim());
  const exit=useEditorExit(engravingDirty||saveError);
  const finalText=engraving.trim();
  const added=hasDemoOrder(revision);
  useEffect(()=>{
    if(draftIssue)return;
    try{
      const savedAt=new Date().toISOString();
      localStorage.setItem(key,JSON.stringify({design,revision,savedAt}));setSaveError(false);setSavedAt(savedAt);
    }catch{setSaveError(true);}
  },[key,design,revision,draftIssue,saveAttempt]);
  useEffect(()=>{
    if(!jump)return;
    const field=document.getElementById(jump);
    if(field){field.focus({preventScroll:true});(jump==='source-engraving'?field.closest('fieldset')!:field).scrollIntoView({block:'center',behavior:'instant'});}
    setJump(undefined);
  },[jump,part,headZone]);
  useEffect(()=>{
    function keepInputVisible(){
      if(document.activeElement?.id==='source-engraving')document.activeElement.closest('fieldset')?.scrollIntoView({block:'center',behavior:'instant'});
    }
    window.visualViewport?.addEventListener('resize',keepInputVisible);
    return ()=>window.visualViewport?.removeEventListener('resize',keepInputVisible);
  },[]);
  function jumpTo(field:string){
    setCompare(false);
    setPart(['head','center','halo'].includes(field)?'head':'shank');
    if(field==='center'||field==='halo')setHeadZone(field);
    setJump('source-'+field);
  }
  function change(next:ReferenceDesign){dispatch({type:'change',design:next});setMessage('');}
  function applyChange(next:ReferenceDesign){
    if(pendingChange?.recover){
      try{const current=localStorage.getItem(key);if(current)localStorage.setItem(key+':previous',current);setRecovery(current);setDraftIssue(undefined);}
      catch{setMessage('当前草稿未能备份，请重试。');setPendingChange(undefined);return;}
    }
    change(next);if(pendingChange?.clearEngraving)setEngraving(next.engraving);setPendingChange(undefined);
  }
  function moveHistory(type:'undo'|'redo'){
    const next=type==='undo'?past.at(-1):future[0];
    if(!next)return;
    if(engravingDirty){setMessage('请先确认或取消刻字修改，再'+(type==='undo'?'撤销':'重做')+'。');return;}
    dispatch({type});setEngraving(next.engraving);setMessage('');
  }
  function replaceBand(id:string){
    if(id===band.id)return;
    const next=RING_CATALOG.find(item=>item.id===id)!;
    const nextDesign={...design,bandId:id};
    const notes:string[]=[];
    if(!next.zones.includes('shoulder')){
      if(design.shoulder!=='diamond')notes.push('新戒圈为素面，戒臂配钻的宝石选择将恢复默认。');
      nextDesign.shoulder='diamond';
    }
    if(!next.zones.includes('shoulder')||next.automaticPave===false){
      if((design.paveDiameter??100)!==100||(design.paveLength??100)!==100)notes.push('新戒圈不支持自动排钻，将移除自定义石径和铺钻长度。');
      delete nextDesign.paveDiameter;delete nextDesign.paveLength;
    }else if((design.paveDiameter??100)!==100||(design.paveLength??100)!==100){
      notes.push('保留石径和长度的百分比，按新戒圈基准重算配钻颗数和间距。');
    }
    if(notes.length)setPendingChange({title:'确认戒圈调整',notes,design:nextDesign});
    else change(nextDesign);
  }
  function switchTemplate(){
    if(!pendingTemplate)return;
    try{
      if(saveError)throw new Error('当前草稿尚未保存，请重试保存后再换款。');
      startNewDraft(pendingTemplate,localStorage);
      exit.go(pendingTemplate.editor);setPendingTemplate(undefined);
    }catch(error){setMessage(error instanceof Error?error.message:'无法备份草稿，请保留当前页面。');setPendingTemplate(undefined);}
  }
  function recoverPrevious(){
    if(!recovery)return;
    try{
      const previous=JSON.parse(recovery),next=parseReferenceDesign(previous?.design);
      if(!next)throw new Error('此前草稿包含已失效的部件或选项，无法直接恢复。原记录仍保留。');
      setPendingChange({title:'恢复此前草稿？',notes:['将恢复此前的部件、宝石、铺钻参数和刻字。当前已确认方案会备份，未确认的刻字输入将清除。'],design:next,clearEngraving:true,recover:true});
    }catch(error){setMessage(error instanceof Error?error.message:'无法恢复草稿，请重试。');}
  }
  function color(appearance:StoneAppearance){if(zone)change({...design,[zone]:appearance});}
  function selectHead(id:string){
    if(id===head.id)return;
    const next={...design,headId:id};
    if(!RING_CATALOG.find(item=>item.id===id)!.zones.includes('halo')&&design.halo!=='diamond'){
      next.halo='diamond';setPendingChange({title:'确认戒头调整',notes:['新戒头没有外围配钻，外围配钻的宝石选择将恢复默认。主石、戒圈和刻字保留。'],design:next});
    }else change(next);
    setHeadZone('center');
  }
  function priceNote(kind:'head'|'band',id:string){
    const delta=referenceQuote(template,{...design,[kind==='head'?'headId':'bandId']:id}).amount-quote.amount;
    return delta?'较当前 '+(delta>0?'+':'−')+formatYuan(Math.abs(delta)):'与当前同价';
  }
  function finishForStyle(name:string){
    const next=BAND_STYLES.find(item=>item.name===name)!;
    return next.finishes.find(item=>listed(item.id)&&(item.name!=='素面')===band.zones.includes('shoulder'))??next.finishes.find(item=>listed(item.id))!;
  }
  function selectBand(name:string){
    if(name===style.name)return;
    const finish=finishForStyle(name);
    replaceBand(finish.id);
    if(finish.name!==style.finishes.find(item=>item.id===band.id)?.name)setMessage('所选'+name+'对应'+finish.name+'。');
  }
  function selectFinish(id:string){
    replaceBand(id);
  }
  async function confirm(){
    if(compare||engravingDirty||draftIssue||!ring||!canCapture||adding)return;
    let thumbnail:string|undefined;
    try{thumbnail=capture.current?.();}catch{}
    if(!thumbnail){setCartFeedback({tone:'error',title:'购物车未能保存',description:'搭配图片暂未生成。'});return;}
    setAdding(true);setCartFeedback(undefined);
    try{
      if(import.meta.env.PROD||import.meta.env.VITE_CLOUD_MODE){
        const query=new URLSearchParams({head:head.id,band:band.id,headRevision:head.revision,bandRevision:band.revision,center:design.center,halo:design.halo,shoulder:design.shoulder});
        const response=await fetch('/api/model-admin/public/combination-quote?'+query);
        const confirmed=await response.json();
        if(!response.ok)throw new Error(confirmed.error??'报价暂不可用，请重试。');
        if(confirmed.amount!==quote.amount||confirmed.version!==quote.version)throw new Error('报价已更新，请刷新后重新确认。');
      }
      addDemoOrder({name:displayName,templateRevision:template.revision,revision,confirmedAt:new Date().toISOString(),design,quote,details,thumbnail,
        stones:ring.stones.map(stone=>({id:stone.name,zone:stone.zone,appearance:design[stone.zone],placement:stone.matrix.toArray()})),
      });
      setReview(false);setCartFeedback({tone:'success',title:'已加入购物车',description:'你的戒指方案已保存。'});
    }catch(error){setCartFeedback({tone:'error',title:'购物车未能保存',description:error instanceof Error?error.message:'当前配置仍在编辑器中。'});}finally{setAdding(false);}
  }
  return <>
    <div className="source-ring-entry">
      <nav className="ring02-breadcrumb" aria-label="所在页面"><a href="#/diy/collection">全部款式</a><span aria-hidden="true">/</span><span aria-current="page">{template.name}</span></nav>
      <RingStylePicker id={template.id} onSelect={id=>setPendingTemplate(RING_CATALOG.find(item=>item.id===id))}/>
      <p className="source-save-status" role={saveError?'alert':'status'}>{draftIssue?'旧草稿需要处理':saveError?'本机草稿保存失败':savedAt?'本机已暂存 · '+new Date(savedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'正在暂存…'}{saveError&&<button onClick={()=>setSaveAttempt(value=>value+1)}>重试保存</button>}</p>
    </div>
    {draftIssue&&<section className="source-draft-issue" role="alert"><p>{draftIssue}</p><p>处理前可查看原款，不能覆盖旧草稿或确认加购。</p>
      <button onClick={()=>location.reload()}>重试读取</button>
      <a href={'data:application/json;charset=utf-8,'+encodeURIComponent(restored.raw??'null')} download="xiangyan-draft.json">下载原记录</a>
      <button onClick={()=>{try{startNewDraft(template,localStorage);setRecovery(localStorage.getItem(key+':previous'));setDraftIssue(undefined);}catch{setMessage('备份未成功，原记录仍保留，请重试。');}}}>保留旧记录并新建</button>
    </section>}
    <div className="stone-first-main ring02-main source-ring-main">
    <section className="stone-first-preview" aria-label="戒指预览">
      <div className="ring02-preview-bar"><div><strong>{visiblePreview?.name??sceneName}</strong><span>{visiblePreview?visiblePreview.ring.stones.length+' 颗宝石':''}</span></div><button aria-pressed={compare} onClick={()=>setCompare(!compare)}>对比原款</button></div>
      {preview?<SourceRingStage ring={preview.ring} template={template} design={preview.design} view={view} reset={reset} captureRef={capture} onCaptureReady={setCaptureFrame}/>
        :<div className="stone-first-canvas ring02-canvas source-ring-canvas">
          <SourceLoading template={template} retry={loadingError?selection.retry:undefined}/>
        </div>}
      {!ring&&visiblePreview&&<div className="source-ring-swap-status" role={loadingError?'alert':'status'}>
        {loadingError?<><span>{loadingError}</span><button onClick={selection.retry}>重试</button></>:'正在更新搭配…'}
      </div>}
      <div className="stone-first-camera-views source-camera-toolbar" role="group" aria-label="戒指观察视角">
        {VIEWS.map(([id,label])=><button key={id} aria-pressed={view===id} onClick={()=>{setView(id);setReset(n=>n+1);}}>
          {(id==='top'||id==='side')&&<img src={VIEW_ICONS[id]} width={16} height={16} alt=""/>}
          {label}
        </button>)}
      </div>
    </section>
    <section className="stone-first-panel" aria-label="戒指配置">
      <header className="ring02-product"><h1>专属定制</h1><p>{displayName} · 银色</p></header>
      <div className="source-part-tabs" role="group" aria-label="选择戒指部件"><button aria-pressed={part==='head'} onClick={()=>setPart('head')}>戒头</button><button aria-pressed={part==='shank'} onClick={()=>setPart('shank')}>戒圈与铺钻</button></div>
      <fieldset disabled={!!draftIssue} className="stone-first-fields ring02-fields source-ring-fields">
        <button type="button" className="source-library-trigger shop-text-link" ref={libraryTrigger} aria-haspopup="dialog"
          aria-label={part==='head'?'查看全部戒头':'查看全部戒圈'} disabled={compare} onClick={()=>setLibrary(part==='head'?'head':'band')}>查看全部</button>
        {part==='head'?<>
          <PartChoices kind="head" label="戒头款式" choices={headChoices.filter(item=>listed(item.id)||item.id===head.id).map(item=>({...item,price:priceNote('head',item.id)}))} selected={head.id} disabled={compare} pending={swapping&&previousParts?.head.id!==head.id} onSelect={selectHead}/>
          {zones.includes('halo')&&<div className="ring02-head-zones stone-first-options" role="group" aria-label="戒头镶嵌区域">{(['center','halo'] as const).map(id=><button key={id} aria-pressed={zone===id} onClick={()=>setHeadZone(id)}>{ZONE_NAMES[id]}</button>)}</div>}
        </>:<>
          <PartChoices kind="band" label="戒圈结构" choices={bandChoices.map(item=>({...item,price:priceNote('band',finishForStyle(item.name).id)}))} selected={style.name} disabled={compare} pending={swapping&&!!previousParts&&bandStyle(previousParts.band.id).name!==style.name} onSelect={selectBand}/>
          <PartChoices kind="finish" label="戒臂铺钻" choices={style.finishes.filter(item=>listed(item.id)||item.id===band.id).map(item=>({...item,image:sourceImage(item.id),price:priceNote('band',item.id)}))} selected={band.id} disabled={compare} pending={swapping&&previousParts?.band.id!==band.id} onSelect={selectFinish}/>
          {automaticPave&&<>
            <fieldset id="source-pave" tabIndex={-1} disabled={compare}><legend>配钻石径</legend>
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
        {zone?<fieldset id={'source-'+zone} tabIndex={-1} disabled={compare}><legend>{ZONE_NAMES[zone]}搭配</legend><div className="stone-first-options ring02-gems">{STONE_APPEARANCE_IDS.map(id=><button key={id} aria-pressed={design[zone]===id} onClick={()=>color(id)}><i className={'ring02-swatch swatch-'+id} aria-hidden="true"/>{STONE_APPEARANCES[id].name}{id!=='diamond'?' +¥100':''}</button>)}</div></fieldset>:<><h2>素面戒臂</h2><p>这款戒臂采用银色素面。</p></>}

        {part==='shank'&&<div className="source-production-notes"><section id="source-material" tabIndex={-1}><h2>材质与表面</h2><p>当前仅提供银色外观预览。实物材质及表面工艺待人工确认。</p></section><section id="source-size" tabIndex={-1}><h2>实物圈号</h2><p>圈号标准和可制作档位待工艺确认。旋转、缩放预览不会改变实物尺寸。</p></section></div>}
        {part==='shank'&&<fieldset disabled={compare} className="ring02-engraving"><legend>内圈刻字 <span>选填</span></legend>
          <label className="sr-only" htmlFor="source-engraving">刻字文字</label><input id="source-engraving" value={engraving} autoComplete="off" spellCheck={false} placeholder="例如  A & B" aria-describedby="source-engraving-help source-engraving-error" onCompositionStart={()=>setComposing(true)} onCompositionEnd={()=>setComposing(false)} onChange={event=>setEngraving(event.target.value)}/>
          <p id="source-engraving-help">最多 {ENGRAVING_LIMIT} 个字符，剩余 {Math.max(0,ENGRAVING_LIMIT-Array.from(engraving).length)} 个。支持英文字母、数字、空格和 . &amp; -</p>
          <figure className="ring02-engraving-sample"><blockquote>{engraving.trim()&&!engravingError?engraving.trim():'刻字预览'}</blockquote><figcaption>内圈位置示意 · 字体与工艺待确认</figcaption></figure>
          <p id="source-engraving-error" role="alert">{engravingError}</p>
          {engravingDirty&&finalText!==engraving&&<p>确认后使用的文字为「{finalText||'空白，不刻字'}」，首尾空格将去除。</p>}
          <div className="ring02-engraving-actions"><button disabled={!engravingDirty} onClick={()=>setEngraving(design.engraving)}>取消修改</button><button disabled={!engravingDirty||composing||!!engravingError} onClick={()=>{const text=engraving.trim();change({...design,engraving:text});setEngraving(text);}}>确认刻字</button></div>
        </fieldset>}
      </fieldset>
      <details className="ring02-summary"><summary>配置摘要</summary><dl className="source-ring-summary">{details.map(detail=><div key={detail.label}><dt><button type="button" onClick={()=>jumpTo(detail.field)}>{detail.label}<span aria-hidden="true"> ↗</span></button></dt><dd>{detail.value}</dd></div>)}</dl>{template.kind==='parametric'&&<a className="source-precision-link" href={RING02_PRECISION_ROUTE}>精调原款围钻</a>}</details>
      <div className="ring02-actions"><button disabled={!past.length||compare||!!draftIssue} onClick={()=>moveHistory('undo')}>撤销</button><button disabled={!future.length||compare||!!draftIssue} onClick={()=>moveHistory('redo')}>重做</button><button disabled={compare||!!draftIssue} onClick={()=>setPendingChange({title:'恢复原款搭配？',notes:['戒头、戒圈、宝石、铺钻参数和刻字将恢复本款默认值。未确认的刻字输入也会清除。','恢复后可以撤销，购物车中的方案不会改变。'],design:ORIGINAL_REFERENCE,clearEngraving:true})}>恢复原款</button></div>
      {recovery&&<div className="source-draft-recovery"><button className="source-recover" onClick={recoverPrevious}>恢复上次换款前的草稿</button><a href={'data:application/json;charset=utf-8,'+encodeURIComponent(recovery)} download="xiangyan-draft-backup.json">下载备份记录</a></div>}
      <p className="ring02-status ring02-editor-feedback" role="status">{compare?'正在对比原款。再次点击可继续编辑。':message}</p>
      <p className="ring02-status" role={saveError?'alert':undefined}>{draftIssue?'旧草稿未覆盖，请先处理上方提示。':saveError?'浏览器未能保存草稿，请保留此页面。':engravingDirty?'请确认或取消刻字修改。':'草稿已保留在本机'}</p>
    </section>
  </div>
    <section className="ring02-purchase" aria-label="估价与演示加购"><div><p>参考估价 <strong>{formatYuan(quote.amount)}</strong></p><small>示例交期 {quote.leadTime} · 待工艺确认</small></div>
      {added&&!engravingDirty?<a className="shop-button" href="#/diy/cart">查看购物车</a>:part==='head'?<button className="shop-button" onClick={()=>setPart('shank')}>下一步 · 配置戒圈</button>:<button className="shop-button" disabled={compare||engravingDirty||!!draftIssue||!canCapture} onClick={()=>{setMessage('');setCartFeedback(undefined);setReview(true);}}>查看方案</button>}
    </section>
    {library&&<PartLibrary kind={library} trigger={libraryTrigger} selected={library==='head'?head.id:band.id}
      onClose={()=>setLibrary(null)} priceNote={id=>priceNote(library,id)} onSelect={library==='head'?selectHead:selectFinish}/>}
    {pendingTemplate&&<ReviewDialog title="切换款式并新建草稿？" onClose={()=>setPendingTemplate(undefined)}>
      <p>将打开{pendingTemplate.name}的默认搭配，以下选择不会带入新款。</p>
      <ul><li>当前戒头、戒圈和宝石选择</li><li>配钻石径、铺钻长度和刻字{engravingDirty?'（含未确认的输入）':''}</li></ul>
      <p>当前已暂存的草稿会保留。目标款式已有的草稿会备份，可在该款式中恢复。购物车方案不会改变。</p>
      <div className="ring02-dialog-actions"><button autoFocus onClick={()=>setPendingTemplate(undefined)}>保留当前方案</button><button disabled={saveError} onClick={switchTemplate}>确认新建草稿</button></div>
    </ReviewDialog>}
    {pendingChange&&<ReviewDialog title={pendingChange.title} onClose={()=>setPendingChange(undefined)}>
      <ul>{pendingChange.notes.map(note=><li key={note}>{note}</li>)}</ul><div className="ring02-dialog-actions"><button autoFocus onClick={()=>setPendingChange(undefined)}>保留原方案</button><button onClick={()=>applyChange(pendingChange.design)}>确认调整</button></div>
    </ReviewDialog>}
    {exit.destination&&<ReviewDialog title="离开当前编辑？" onClose={exit.cancel}><p>{engravingDirty?'刻字输入尚未确认，离开会丢失这段输入。':'本机草稿尚未保存成功，离开可能丢失最新修改。'}</p><div className="ring02-dialog-actions"><button autoFocus onClick={exit.cancel}>继续编辑</button><button onClick={exit.leave}>放弃未保存修改并离开</button></div></ReviewDialog>}
    {!review&&<FeedbackToast notice={cartFeedback?.tone==='success'?cartFeedback:undefined} onDismiss={()=>setCartFeedback(undefined)}/>}
    {review&&<ReviewDialog title="确认你的戒指方案" busy={adding} onClose={()=>setReview(false)}><p>{displayName} · 参考估价 {formatYuan(quote.amount)}</p><dl>{details.map(detail=><div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl><p>当前为演示加购，价格、圈号与制作工艺待正式确认。</p><FeedbackToast inline notice={cartFeedback} onDismiss={()=>setCartFeedback(undefined)} onRetry={cartFeedback&&!adding?confirm:undefined}/><div className="ring02-dialog-actions"><button autoFocus disabled={adding} onClick={()=>setReview(false)}>继续修改</button><button className="shop-button" disabled={!canCapture||adding} onClick={confirm}>{adding?'正在加入…':'确认并加入演示购物车'}</button></div></ReviewDialog>}
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
    <Editor key={template.id} template={template}/>
  </main>;
}
