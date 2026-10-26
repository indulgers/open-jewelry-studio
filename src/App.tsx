import {useCallback,useEffect,useReducer,useState} from 'react';
import {configurationReducer} from './configuration/configuration';
import {loadConfiguration,saveConfiguration} from './configuration/storage';
import {Configurator} from './components/Configurator';
import {AssetCredits} from './components/AssetCredits';
import {JewelryStage} from './viewer/JewelryStage';
import {METALS} from './viewer/materials';
import type {Quality} from './viewer/quality';
import type {ModelMode} from './assets/referenceManifest';

function restore(){
  try{return loadConfiguration(window.localStorage);}
  catch{return loadConfiguration({getItem:()=>{throw new Error('Storage blocked');}});}
}
export default function App(){
  const [initial]=useState(restore);
  const [configuration,dispatch]=useReducer(configurationReducer,initial.configuration);
  const [quality,onQualityChange]=useState<Quality>('standard');
  const [modelMode,setModelMode]=useState<ModelMode>('reference');
  const [autoRotate,onAutoRotateChange]=useState(false);
  const [resetToken,setResetToken]=useState(0);
  const [message,setMessage]=useState(initial.warning??'');
  const [slow,setSlow]=useState(false);
  useEffect(()=>{
    const query=window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed=()=>{if(query.matches)onAutoRotateChange(false);};
    query.addEventListener('change',changed);return()=>query.removeEventListener('change',changed);
  },[]);
  const onPerformanceWarning=useCallback(()=>setSlow(true),[]);
  const save=()=>{
    try{const result=saveConfiguration(window.localStorage,configuration);setMessage(result.ok?'已保存，刷新页面后可继续。':result.warning??'保存失败。');}
    catch{setMessage('浏览器未允许保存，当前选择仍然保留。');}
  };
  return <div className="app-shell">
    <header className="site-header"><a className="brand" href="/" aria-label="戒指实验室首页">
      <svg viewBox="0 0 32 32" aria-hidden="true"><path d="m5 11 6-6h10l6 6-11 17L5 11Zm0 0h22M11 5l5 23L21 5M11 5l-1 6m11-6 1 6"/></svg>
      <span>戒指实验室</span></a><span className="header-note">让想法，成为形状。</span><span className="demo-tag">开源技术演示</span></header>
    <main className="studio-layout">
      <div className="preview-column"><div className="preview-heading"><h1>{modelMode==='reference'?'光，落在切面之间。':configuration.shankStyle==='plain'?'纯粹，恰如其分。':'交汇，自有光芒。'}</h1>
        <p>{modelMode==='reference'?'六爪实模':configuration.shankStyle==='plain'?'素圈戒臂':'分叉戒臂'}<span> / </span>{METALS[configuration.metalFinish].name}</p></div>
        <JewelryStage {...{configuration,quality,autoRotate,resetToken,onPerformanceWarning,modelMode}}/>
        <div className="preview-footer"><span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7h14M6 4 3 7l3 3m8 0 3-3-3-3M7 13h6m-3-2v6"/></svg>拖动旋转 · 滚轮或双指缩放</span><span>实时 3D</span></div>
      </div>
      <aside className="configuration-column" aria-label="戒指配置">
        <div className="panel-heading"><h2>设计你的戒指</h2><p>选择结构与光泽，慢慢找到你的组合。</p></div>
        <div className="model-modes" role="group" aria-label="模型模式">
          <button aria-pressed={modelMode==='reference'} onClick={()=>setModelMode('reference')}>六爪参考实模</button>
          <button aria-pressed={modelMode==='procedural'} onClick={()=>setModelMode('procedural')}>参数化 DIY</button>
        </div>
        <Configurator {...{configuration,dispatch,quality,onQualityChange,autoRotate,onAutoRotateChange}} reference={modelMode==='reference'} onSave={save} onResetView={()=>setResetToken(n=>n+1)}/>
        <div className="feedback" role="status" aria-live="polite">{message}</div>
        {slow&&quality==='high'&&<div className="performance-notice">当前渲染较慢。<button onClick={()=>onQualityChange('standard')}>切换为标准画质</button></div>}
        <AssetCredits/>
      </aside>
    </main>
    <footer className="site-footer"><span>开源渲染技术演示，参考素材仅作效果研究。</span><span>六爪实模 / 参数化 DIY × WebGL</span></footer>
  </div>;
}
