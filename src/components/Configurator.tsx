import type {Dispatch,CSSProperties} from 'react';
import type {Configuration,ConfigurationAction,MetalFinish} from '../configuration/configuration';
import {METALS} from '../viewer/materials';
import type {Quality} from '../viewer/quality';
type Props={configuration:Configuration;dispatch:Dispatch<ConfigurationAction>;quality:Quality;onQualityChange:(value:Quality)=>void;
  autoRotate:boolean;onAutoRotateChange:(value:boolean)=>void;onResetEditing:()=>void;onResetView:()=>void;reference?:boolean;hideStructure?:boolean;stoneOnly?:boolean};
export function Configurator({configuration,dispatch,quality,onQualityChange,autoRotate,onAutoRotateChange,onResetEditing,onResetView,reference=false,hideStructure=false,stoneOnly=false}:Props){
  return <div className="configurator">
    {reference&&!hideStructure&&<p className="reference-note">当前为固定六爪参考模型，可切换金属。切换至「参数化 DIY」可调整戒臂与主石；原有配置不会丢失。</p>}
    {!hideStructure&&<fieldset disabled={reference}><legend>{reference?'已保留的 DIY 戒臂':'戒臂结构'}</legend><div className="choice-grid shank-choices">
      {(['plain','split'] as const).map(style=><label className="choice shank-choice" key={style}>
        <input type="radio" name="shank" value={style} checked={configuration.shankStyle===style}
          onChange={()=>dispatch({type:'set-shank',value:style})}/>
        <svg className="shank-icon" viewBox="0 0 84 55" fill="none" aria-hidden="true">
          {style==='plain'?<><ellipse cx="42" cy="30" rx="22" ry="17"/><path d="M24 20q18-13 36 0"/></>
            :<><path d="M25 19c-15 21 0 30 17 30s32-9 17-30M25 19l12-9m22 9-12-9M25 19l14 0m20 0-14 0"/></>}
          <path d="m36 7 6-4 6 4-6 10-6-10Zm0 0h12"/>
        </svg>
        <span>{style==='plain'?'素圈戒臂':'分叉戒臂'}</span>
      </label>)}
    </div></fieldset>}
    {!stoneOnly&&<fieldset><legend>金属外观 <span>{METALS[configuration.metalFinish].name}</span></legend>
      <div className="metal-choices">{(Object.keys(METALS) as MetalFinish[]).map(finish=><label className="metal-choice" key={finish}>
        <input type="radio" name="metal" checked={configuration.metalFinish===finish} onChange={()=>dispatch({type:'set-metal',value:finish})}/>
        <span className={`metal-disc metal-${finish}`} style={{'--metal':METALS[finish].swatch} as CSSProperties}/>
        <span>{METALS[finish].name}</span>
      </label>)}</div>
    </fieldset>}
    {!hideStructure&&<fieldset disabled={reference}><legend>{reference?'已保留的 DIY 主石尺寸':'主石展示尺寸'}</legend><div className="choice-grid sizes">
      {(['small','medium','large'] as const).map((size,i)=><label className="choice size-choice" key={size}>
        <input type="radio" name="size" checked={configuration.stoneSize===size} onChange={()=>dispatch({type:'set-size',value:size})}/>
        <span>{['小','中','大'][i]}</span>
      </label>)}
    </div><p className="field-help">仅调整视觉比例，不代表实际克拉或戒围。</p></fieldset>}
    <fieldset className="quality-field"><legend>预览画质</legend><div className="quality-choices">
      {(['standard','high'] as const).map(value=><label key={value}>
        <input type="radio" name="quality" checked={quality===value} onChange={()=>onQualityChange(value)}/>
        <span>{value==='standard'?'标准':'高质量'}</span>
      </label>)}
    </div></fieldset>
    <div className="view-preferences"><label><input type="checkbox" checked={autoRotate} onChange={e=>onAutoRotateChange(e.target.checked)}/><span>自动旋转</span></label>
      <button className="text-button" onClick={onResetView}>重置视角</button></div>
    {!stoneOnly&&<><button className="save-button" onClick={onResetEditing}>重置编辑<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></button>
    <p className="save-help">恢复默认戒臂、金属和 DIY 主石尺寸。</p></>}
  </div>;
}
