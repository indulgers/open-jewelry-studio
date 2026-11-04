import {lazy,Suspense,useCallback,useEffect,useReducer,useState} from 'react';
import {DEFAULT_CONFIGURATION,configurationReducer} from './configuration/configuration';
import {STORAGE_KEY} from './configuration/storage';
import {Configurator} from './components/Configurator';
import {AssetCredits} from './components/AssetCredits';
import {METALS} from './viewer/materials';
import type {Quality} from './viewer/quality';
import type {ModelMode} from './assets/referenceManifest';
import {ATELIER_GEMS,atelierGem,type GemShapeId} from './assets/atelierManifest';
import {STUDIO_PRESETS,type StudioPresetId} from './viewer/studioPresets';
import {SAMPLE_IMAGES,type ProductImage} from './assets/productMedia';
import {FINISHED_RINGS,finishedRing,type FinishedRingId} from './assets/finishedRings';
import {STAGE_MODES,type StageMode} from './viewer/stageMode';
import {ProductGallery} from './components/ProductGallery';
import {ModuleStudio} from './components/ModuleStudio';
import {StageLoading} from './components/StageLoading';
const JewelryStage=lazy(()=>import('./viewer/JewelryStage').then(module=>({default:module.JewelryStage})));

function JewelryStudio({active}:{active:boolean}){
  const [configuration,dispatch]=useReducer(configurationReducer,DEFAULT_CONFIGURATION);
  const [quality,onQualityChange]=useState<Quality>('standard');
  const [modelMode,setModelMode]=useState<ModelMode>('reference');
  const [gemShape,setGemShape]=useState<GemShapeId>('round');
  const [ringStyle,setRingStyle]=useState<FinishedRingId>('solitaire');
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
  useEffect(()=>{setImages(null);setCaptureMessage('');setDisplay('3d');},[configuration,modelMode,gemShape,ringStyle,stageMode,studioPreset,quality]);
  useEffect(()=>{
    if(!captureBusy)return;
    // Also ends a capture if the browser stops delivering animation frames.
    const timer=window.setTimeout(()=>onCaptureProgress('生成超时，请等待预览恢复后重试。'),60000);
    return()=>window.clearTimeout(timer);
  },[captureBusy,onCaptureProgress]);
  useEffect(()=>{if(!active){setCaptureBusy(false);setCaptureRequest(0);setCaptureMessage('');setCaptureReady(false);}},[active]);
  const capture=()=>{onAutoRotateChange(false);setCaptureBusy(true);setCaptureMessage('正在生成商品预览');setCaptureRequest(n=>n+1);};
  const catalogSample=modelMode==='reference'&&ringStyle==='solitaire'&&configuration.metalFinish==='yellow'
    &&stageMode==='listing'&&studioPreset==='catalog'&&quality==='standard';
  const poster=catalogSample?SAMPLE_IMAGES[0].url:undefined;
  const openImages=()=>{
    if(images||catalogSample){setDisplay('images');return;}
    setDisplay('preparing');capture();
  };
  useEffect(()=>{try{window.localStorage.removeItem(STORAGE_KEY);}catch{}},[]);
  const resetEditing=()=>{dispatch({type:'reset'});setMessage('已恢复默认模型参数。');};
  return <div>
    <main className="studio-layout">
      <div className="preview-column"><div className="preview-heading"><h1>{modelMode==='gem'?'每一种切工，都有自己的光。':modelMode==='reference'?'光，落在切面之间。':configuration.shankStyle==='plain'?'纯粹，恰如其分。':'交汇，自有光芒。'}</h1>
        <p>{modelMode==='gem'?atelierGem(gemShape).name:modelMode==='reference'?finishedRing(ringStyle).note:configuration.shankStyle==='plain'?'素圈戒臂':'分叉戒臂'}<span> / </span>{modelMode==='gem'?STUDIO_PRESETS[studioPreset].name:METALS[configuration.metalFinish].name}</p></div>
        {!active?null:display==='images'?<ProductGallery images={images??SAMPLE_IMAGES}/>:<Suspense fallback={<StageLoading poster={poster}/>}>
          <JewelryStage {...{configuration,quality,autoRotate,resetToken,onPerformanceWarning,modelMode,gemShape,ringStyle,stageMode,studioPreset,captureRequest,onImages,onCaptureProgress,captureBusy,poster}} onCaptureReady={setCaptureReady}/>
        </Suspense>}
        {display==='3d'&&<div className="preview-footer"><span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7h14M6 4 3 7l3 3m8 0 3-3-3-3M7 13h6m-3-2v6"/></svg>{captureReady?'拖动旋转 · 滚轮或双指缩放':'三维准备中，完成后即可拖动'}</span><span>{captureReady?'实时 3D':'准备中'}</span></div>}
      </div>
      <aside className="configuration-column" aria-label="戒指配置">
        <div className="panel-heading"><h2>设计你的戒指</h2><p>选择结构与光泽，慢慢找到你的组合。</p></div>
        <fieldset disabled={captureBusy} className="studio-options"><legend className="sr-only">展示选项</legend>
          <div className="model-modes" role="group" aria-label="模型模式">
            <button aria-pressed={modelMode==='reference'} onClick={()=>setModelMode('reference')}>成品戒指</button>
            <button aria-pressed={modelMode==='gem'} onClick={()=>setModelMode('gem')}>宝石库</button>
            <button aria-pressed={modelMode==='procedural'} onClick={()=>setModelMode('procedural')}>结构 DIY</button>
          </div>
          {modelMode==='gem'?<label className="shape-picker">宝石切形 <span>19 款</span><select value={gemShape} onChange={e=>setGemShape(e.target.value as GemShapeId)}>{ATELIER_GEMS.map(gem=><option key={gem.id} value={gem.id}>{gem.name}</option>)}</select></label>
            :modelMode==='reference'&&<fieldset className="ring-style-field"><legend>成品款式 <span>{FINISHED_RINGS.length} 款</span></legend><div className="ring-styles">{FINISHED_RINGS.map(ring=>
              <button key={ring.id} aria-pressed={ringStyle===ring.id} onClick={()=>{setRingStyle(ring.id);setResetToken(n=>n+1);}}><strong>{ring.name}</strong><span>{ring.note}</span></button>)}</div><p className="field-help">成品模型来自本地 WebGI 珠宝样板（仅作研究），保留原始雕蜡与宝石切工。</p></fieldset>}
          <fieldset><legend>观察光线</legend><div className="preset-choices">{Object.values(STUDIO_PRESETS).map(preset=><button key={preset.id} aria-pressed={studioPreset===preset.id} onClick={()=>setStudioPreset(preset.id)}>{preset.name}</button>)}</div><p className="field-help">{STUDIO_PRESETS[studioPreset].description}</p></fieldset>
          <fieldset><legend>展台背景</legend><div className="preset-choices">{STAGE_MODES.map(mode=><button key={mode.id} aria-pressed={stageMode===mode.id} onClick={()=>setStageMode(mode.id)}>{mode.name}</button>)}</div><p className="field-help">{STAGE_MODES.find(mode=>mode.id===stageMode)?.note}；商品图导出会压到白底。</p></fieldset>
          <div className="media-modes" role="group" aria-label="预览方式"><button aria-pressed={display==='3d'} onClick={()=>setDisplay('3d')}>实时 3D</button><button disabled={!catalogSample&&!images&&!captureReady} aria-pressed={display!=='3d'} onClick={openImages}>商品图片</button></div>
          <Configurator {...{configuration,dispatch,quality,onQualityChange,autoRotate,onAutoRotateChange}} reference={modelMode!=='procedural'} hideStructure={modelMode!=='procedural'} stoneOnly={modelMode==='gem'} onResetEditing={resetEditing} onResetView={()=>setResetToken(n=>n+1)}/>
        </fieldset>
        <section className="capture-panel" aria-label="商品图输出"><button className="capture-button" disabled={captureBusy||!captureReady||display!=='3d'} onClick={capture}>{captureBusy?'正在生成…':'生成四个角度的商品图'}</button><p className="field-help">停止旋转后生成当前配置的渲染预览，分辨率随画布与画质设置变化。</p><p className="capture-status" role="status">{captureMessage}</p>{images&&<ProductGallery images={images} downloads/>}</section>
        <div className="feedback" role="status" aria-live="polite">{message}</div>
        {slow&&quality==='high'&&<div className="performance-notice">当前渲染较慢。<button onClick={()=>onQualityChange('standard')}>切换为标准画质</button></div>}
        <AssetCredits/>
      </aside>
    </main>
    <footer className="site-footer"><span>开源渲染样板，展示比例不代表实际克拉或生产规格。</span><span>成品戒指 / 19 款切工 / 结构 DIY</span></footer>
  </div>;
}

const tabs=[{id:'showroom',label:'珠宝展台'},{id:'modules',label:'模组 DIY'}] as const;
type StudioTab=typeof tabs[number]['id'];
const readTab=():StudioTab=>window.location.hash.startsWith('#/modules')?'modules':'showroom';
export default function App(){
  const [tab,setTab]=useState<StudioTab>(readTab);
  const [modulesVisited,setModulesVisited]=useState(()=>readTab()==='modules');
  useEffect(()=>{
    const sync=()=>{const next=readTab();setTab(next);if(next==='modules')setModulesVisited(true);};
    window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);
  },[]);
  const select=(next:StudioTab)=>{setTab(next);if(next==='modules')setModulesVisited(true);window.location.hash=next==='modules'?'/modules':'/showroom';};
  return <div className="app-shell" data-workspace={tab}>
    <header className="site-header"><a className="brand" href="/" aria-label="戒指实验室首页">
      <svg viewBox="0 0 32 32" aria-hidden="true"><path d="m5 11 6-6h10l6 6-11 17L5 11Zm0 0h22M11 5l5 23L21 5M11 5l-1 6m11-6 1 6"/></svg>
      <span>戒指实验室</span></a><span className="header-note">让想法，成为形状。</span><span className="demo-tag">开源技术演示</span></header>
    <div className="workspace-tabs" role="tablist" aria-label="工作空间">
      {tabs.map((item,index)=><button key={item.id} id={`tab-${item.id}`} role="tab" aria-selected={tab===item.id} aria-controls={`panel-${item.id}`} tabIndex={tab===item.id?0:-1} onClick={()=>select(item.id)} onKeyDown={event=>{
        const target=event.key==='Home'?0:event.key==='End'?tabs.length-1:event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:null;
        if(target===null)return;event.preventDefault();select(tabs[target].id);document.getElementById(`tab-${tabs[target].id}`)?.focus();
      }}>{item.label}</button>)}
    </div>
    <section id="panel-showroom" role="tabpanel" aria-labelledby="tab-showroom" hidden={tab!=='showroom'}><JewelryStudio active={tab==='showroom'}/></section>
    <section id="panel-modules" role="tabpanel" aria-labelledby="tab-modules" hidden={tab!=='modules'}>{modulesVisited&&<ModuleStudio active={tab==='modules'}/>}</section>
  </div>;
}
