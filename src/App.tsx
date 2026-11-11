import {lazy,Suspense,useCallback,useEffect,useLayoutEffect,useReducer,useState} from 'react';
import {DEFAULT_CONFIGURATION,configurationReducer} from './configuration/configuration';
import {STORAGE_KEY} from './configuration/storage';
import {Configurator} from './components/Configurator';
import {AssetCredits} from './components/AssetCredits';
import {ShopHeader} from './components/ShopHeader';
import {RING_CATALOG} from './stone-first/catalog';
import type {Quality} from './viewer/quality';
import type {ModelMode} from './assets/referenceManifest';
import {ATELIER_GEMS,atelierGem,type GemShapeId} from './assets/atelierManifest';
import {STUDIO_PRESETS,type StudioPresetId} from './viewer/studioPresets';
import {type ProductImage} from './assets/productMedia';
import {FINISHED_RINGS,finishedRing,type FinishedRingId} from './assets/finishedRings';
import {STAGE_MODES,type StageMode} from './viewer/stageMode';
import {STONE_APPEARANCES, STONE_APPEARANCE_IDS,type StoneAppearance} from './viewer/stoneAppearance';
import {ProductGallery} from './components/ProductGallery';
import {ModuleStudio} from './components/ModuleStudio';
import {StageLoading} from './components/StageLoading';
import {DiyHome} from './stone-first/DiyHome';
import {DiyCart} from './stone-first/DiyCart';
import {RING02_TEMPLATE} from './stone-first/ring02/assets';
import {loadRing02} from './stone-first/ring02/entry';
import {Ring02Loading} from './stone-first/ring02/Ring02Loading';
const JewelryStage=lazy(()=>import('./viewer/JewelryStage').then(module=>({default:module.JewelryStage})));
const Ring02Studio=lazy(()=>loadRing02().then(module=>({default:module.Ring02Studio})));
const SourceRingStudio=lazy(()=>import('./stone-first/reference/SourceRingStudio').then(module=>({default:module.SourceRingStudio})));
const StoneFirstStudio=lazy(()=>import('./stone-first/StoneFirstStudio').then(module=>({default:module.StoneFirstStudio})));

function JewelryStudio({active}:{active:boolean}){
  const [configuration,dispatch]=useReducer(configurationReducer,DEFAULT_CONFIGURATION);
  const [quality,onQualityChange]=useState<Quality>('standard');
  const [modelMode,setModelMode]=useState<ModelMode>('reference');
  const [gemShape,setGemShape]=useState<GemShapeId>('round');
  const [ringStyle,setRingStyle]=useState<FinishedRingId>(()=>finishedRing('solitaire').id);
  const [stoneAppearance,setStoneAppearance]=useState<StoneAppearance>('diamond');
  useEffect(()=>{if(ringStyle!=='halo')setStoneAppearance('diamond');},[ringStyle]);
  const [studioPreset,setStudioPreset]=useState<StudioPresetId>('catalog');
  const [stageMode,setStageMode]=useState<StageMode>('listing');
  const [display,setDisplay]=useState<'3d'|'preparing'|'images'>('3d');
  const [images,setImages]=useState<ProductImage[]|null>(null);
  const [captureRequest,setCaptureRequest]=useState(0),[captureBusy,setCaptureBusy]=useState(false),[captureMessage,setCaptureMessage]=useState('');
  const [captureReady,setCaptureReady]=useState(false);
  const [autoRotate,onAutoRotateChange]=useState(false);
  const [resetToken,setResetToken]=useState(0);
  const [message,setMessage]=useState('');
  const [slow,setSlow]=useState(false);
  useEffect(()=>{
    const query=window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed=()=>{if(query.matches)onAutoRotateChange(false);};
    query.addEventListener('change',changed);return()=>query.removeEventListener('change',changed);
  },[]);
  const onPerformanceWarning=useCallback(()=>setSlow(true),[]);
  const onImages=useCallback((next:ProductImage[])=>{
    setImages(next);
    setDisplay(current=>current==='preparing'?'images':current);
  },[]);
  const onCaptureProgress=useCallback((value:string)=>{
    const running=value.startsWith('正在生成');setCaptureMessage(value);setCaptureBusy(running);
    if(!running){
      setCaptureRequest(0);
      setDisplay(current=>current==='preparing'?'3d':current);
    }
  },[]);
  useEffect(()=>{setImages(null);setCaptureMessage('');setDisplay('3d');},[configuration,modelMode,gemShape,ringStyle,stageMode,studioPreset,quality,stoneAppearance]);
  useEffect(()=>{
    if(!captureBusy)return;
    // Also ends a capture if the browser stops delivering animation frames.
    const timer=window.setTimeout(()=>onCaptureProgress('生成超时，请等待预览恢复后重试。'),60000);
    return()=>window.clearTimeout(timer);
  },[captureBusy,onCaptureProgress]);
  useEffect(()=>{if(!active){setCaptureBusy(false);setCaptureRequest(0);setCaptureMessage('');setCaptureReady(false);}},[active]);
  const capture=()=>{onAutoRotateChange(false);setCaptureBusy(true);setCaptureMessage('正在生成商品预览');setCaptureRequest(n=>n+1);};
  const openImages=()=>{
    if(images){setDisplay('images');return;}
    setDisplay('preparing');capture();
  };
  useEffect(()=>{try{window.localStorage.removeItem(STORAGE_KEY);}catch{}},[]);
  const resetEditing=()=>{dispatch({type:'reset'});setMessage('已恢复默认模型参数。');};
  return <div>
    <main className="studio-layout">
      <div className="preview-column"><div className="preview-heading"><h1>{modelMode==='gem'?atelierGem(gemShape).name:modelMode==='reference'?finishedRing(ringStyle).name:configuration.shankStyle==='plain'?'素圈戒指':'分叉戒指'}</h1>
        <p>{modelMode==='gem'?'宝石切工':modelMode==='reference'?finishedRing(ringStyle).note:'结构预览'}<span> / </span>{modelMode==='gem'?STUDIO_PRESETS[studioPreset].name:'银色'}</p></div>
        {!active?null:display==='images'&&images?<ProductGallery images={images}/>:<Suspense fallback={<StageLoading/>}>
          <JewelryStage {...{configuration,quality,autoRotate,resetToken,onPerformanceWarning,modelMode,gemShape,ringStyle,stageMode,studioPreset,stoneAppearance,captureRequest,onImages,onCaptureProgress,captureBusy}} onCaptureReady={setCaptureReady}/>
        </Suspense>}
        {display==='3d'&&<div className="preview-footer"><span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7h14M6 4 3 7l3 3m8 0 3-3-3-3M7 13h6m-3-2v6"/></svg>{captureReady?'拖动旋转 · 滚轮或双指缩放':'三维准备中，完成后即可拖动'}</span><span>{captureReady?'实时 3D':'准备中'}</span></div>}
      </div>
      <aside className="configuration-column" aria-label="戒指配置">
        <div className="panel-heading"><h2>展台选项</h2></div>
        <fieldset disabled={captureBusy} className="studio-options"><legend className="sr-only">展示选项</legend>
          <div className="model-modes" role="group" aria-label="模型模式">
            <button aria-pressed={modelMode==='reference'} onClick={()=>setModelMode('reference')}>成品戒指</button>
            <button aria-pressed={modelMode==='gem'} onClick={()=>setModelMode('gem')}>宝石库</button>
            <button aria-pressed={modelMode==='procedural'} onClick={()=>setModelMode('procedural')}>结构 DIY</button>
          </div>
          {modelMode==='gem'?<label className="shape-picker">宝石切形 <span>19 款</span><select value={gemShape} onChange={e=>setGemShape(e.target.value as GemShapeId)}>{ATELIER_GEMS.map(gem=><option key={gem.id} value={gem.id}>{gem.name}</option>)}</select></label>
            :modelMode==='reference'&&<fieldset className="ring-style-field"><legend>成品款式 <span>{FINISHED_RINGS.length} 款</span></legend><div className="ring-styles">{FINISHED_RINGS.map(ring=>
              <button key={ring.id} aria-pressed={ringStyle===ring.id} onClick={()=>{setRingStyle(ring.id);setResetToken(n=>n+1);}}><strong>{ring.name}</strong><span>{ring.note}</span></button>)}</div><p className="field-help">切换款式和观察光线，查看不同角度的镶嵌细节。</p></fieldset>}
          {modelMode==='reference'&&<fieldset className="ring-style-field"><legend>主石光学预览 <span>{ringStyle==='halo'?'可修改':'原模型保留'}</span></legend>
            <div className="preset-choices" role="group" aria-label="主石光学预览">{STONE_APPEARANCE_IDS.map(id=><button key={id} aria-pressed={stoneAppearance===id} disabled={ringStyle!=='halo'&&id!=='diamond'} onClick={()=>setStoneAppearance(id)}>{STONE_APPEARANCES[id].name}</button>)}</div>
            <p className="field-help">{ringStyle==='halo'?'颜色仅作用于主石预览。':'这款戒指保留原主石。'}</p>
          </fieldset>}
          <fieldset><legend>观察光线</legend><div className="preset-choices">{Object.values(STUDIO_PRESETS).map(preset=><button key={preset.id} aria-pressed={studioPreset===preset.id} onClick={()=>setStudioPreset(preset.id)}>{preset.name}</button>)}</div><p className="field-help">{STUDIO_PRESETS[studioPreset].description}</p></fieldset>
          <fieldset><legend>展台背景</legend><div className="preset-choices">{STAGE_MODES.map(mode=><button key={mode.id} aria-pressed={stageMode===mode.id} onClick={()=>setStageMode(mode.id)}>{mode.name}</button>)}</div><p className="field-help">{STAGE_MODES.find(mode=>mode.id===stageMode)?.note}；商品图导出会压到白底。</p></fieldset>
          <div className="media-modes" role="group" aria-label="预览方式"><button aria-pressed={display==='3d'} onClick={()=>setDisplay('3d')}>实时 3D</button><button disabled={!images&&!captureReady} aria-pressed={display!=='3d'} onClick={openImages}>商品图片</button></div>
          <Configurator {...{configuration,dispatch,quality,onQualityChange,autoRotate,onAutoRotateChange}} hideStructure={modelMode!=='procedural'} stoneOnly={modelMode==='gem'} onResetEditing={resetEditing} onResetView={()=>setResetToken(n=>n+1)}/>
        </fieldset>
        <section className="capture-panel" aria-label="商品图输出"><button className="capture-button" disabled={captureBusy||!captureReady||display!=='3d'} onClick={capture}>{captureBusy?'正在生成…':'生成四个角度的商品图'}</button><p className="field-help">停止旋转后生成当前配置的渲染预览，分辨率随画布与画质设置变化。</p><p className="capture-status" role="status">{captureMessage}</p>{images&&<ProductGallery images={images} downloads/>}</section>
        <div className="feedback" role="status" aria-live="polite">{message}</div>
        {slow&&quality==='high'&&<div className="performance-notice">当前渲染较慢。<button onClick={()=>onQualityChange('standard')}>切换为标准画质</button></div>}
        <AssetCredits/>
      </aside>
    </main>
    <footer className="site-footer"><span>展示模型的比例仅供参考。</span></footer>
  </div>;
}

type StudioRoute={tab:'showroom'|'modules'}|{tab:'stonefirst';page:'catalog'|'cart'|'ring02'|'recipes'|'reference';templateId?:string;section?:'collection'|'story'};
function readRoute():StudioRoute{
  const hash=window.location.hash;
  switch(hash){
    case '#/diy':return {tab:'stonefirst',page:'catalog'};
    case '#/diy/collection':return {tab:'stonefirst',page:'catalog',section:'collection'};
    case '#/diy/story':return {tab:'stonefirst',page:'catalog',section:'story'};
    case '#/diy/cart':return {tab:'stonefirst',page:'cart'};
    case RING02_TEMPLATE.editor:return {tab:'stonefirst',page:'ring02'};
  }
  const reference=RING_CATALOG.find(template=>template.kind==='reference'&&template.editor===hash);
  if(reference)return {tab:'stonefirst',page:'reference',templateId:reference.id};
  if(hash.startsWith('#/stonefirst'))return {tab:'stonefirst',page:'recipes'};
  if(hash.startsWith('#/modules'))return {tab:'modules'};
  if(hash.startsWith('#/showroom'))return {tab:'showroom'};
  return {tab:'stonefirst',page:'catalog'};
}
export default function App(){
  const [route,setRoute]=useState(readRoute);
  const [modulesVisited,setModulesVisited]=useState(()=>route.tab==='modules');
  const {tab}=route;
  const diyPage=route.tab==='stonefirst'?route.page:null;
  useLayoutEffect(()=>{
    if(window.scrollY>0)window.scrollTo({top:0,behavior:'instant'});
  },[tab,diyPage,route.tab==='stonefirst'?route.section:null,route.tab==='stonefirst'?route.templateId:null]);
  useEffect(()=>{
    const sync=()=>{
      const next=readRoute();
      setRoute(next);
      if(next.tab==='modules')setModulesVisited(true);
    };
    window.addEventListener('hashchange',sync);
    return()=>window.removeEventListener('hashchange',sync);
  },[]);
  return <div className="app-shell" data-workspace={tab}>
    <ShopHeader page={diyPage}/>
    <section id="panel-showroom" aria-label="珠宝展台" hidden={tab!=='showroom'}><JewelryStudio active={tab==='showroom'}/></section>
    <section id="panel-modules" aria-label="模组 DIY" hidden={tab!=='modules'}>{modulesVisited&&<ModuleStudio active={tab==='modules'}/>}</section>
    <section id="panel-stonefirst" aria-label="戒指定制" hidden={tab!=='stonefirst'}>{tab==='stonefirst'&&(diyPage==='catalog'?<DiyHome section={route.section}/>:diyPage==='cart'?<DiyCart/>:<Suspense fallback={diyPage==='ring02'?<Ring02Loading/>:<p role="status">正在加载镶嵌设计工作台…</p>}>{diyPage==='ring02'?<Ring02Studio/>:diyPage==='reference'?<SourceRingStudio key={route.templateId} templateId={route.templateId!}/>:<StoneFirstStudio/>}</Suspense>)}</section>
  </div>;
}
