import {useRef,useState} from 'react';
import type {DragMode} from './inspection-camera';
import {STUDIO_PRESETS} from '../../viewer/studioPresets';
import './inspection.css';

export const MIN_INSPECTION_ZOOM=.6, MAX_INSPECTION_ZOOM=3;
export function useRingInspection(){
  const [mode,setMode]=useState<DragMode>('rotate');
  const [contrast,setContrast]=useState(false);
  const [zoom,setZoom]=useState(100);
  const cameraActions=useRef<{zoom:(factor:number)=>void;reset:()=>void}|null>(null);
  const motion=useRef({active:false,restore:()=>{}});
  return {motion,mode,setMode,contrast,setContrast,zoom,setZoom,cameraActions,
    studio:contrast?STUDIO_PRESETS.contrast:STUDIO_PRESETS.catalog};
}
export type Inspection=ReturnType<typeof useRingInspection>;

export function RingInspectionTools({inspection,enabled}:{inspection:Inspection;enabled:boolean}){
  const {mode,setMode,zoom,cameraActions,contrast,setContrast}=inspection;
  return <fieldset className="ring-inspection" aria-label="三维画布操作" disabled={!enabled}>
    <div className="ring-inspection-drag" role="group" aria-label="拖动方式">
      <button type="button" aria-pressed={mode==='rotate'} onClick={()=>setMode('rotate')}>旋转</button>
      <button type="button" aria-pressed={mode==='pan'} onClick={()=>setMode('pan')}>平移</button>
    </div>
    <div className="ring-inspection-zoom" role="group" aria-label="画布缩放">
      <button type="button" aria-label="缩小模型" disabled={zoom<=MIN_INSPECTION_ZOOM*100} onClick={()=>cameraActions.current?.zoom(.8)}>−</button>
      <span aria-label="相对当前视角的缩放比例">{zoom}%</span>
      <button type="button" aria-label="放大模型" disabled={zoom>=MAX_INSPECTION_ZOOM*100} onClick={()=>cameraActions.current?.zoom(1.25)}>＋</button>
    </div>
    <button type="button" aria-pressed={contrast} onClick={()=>setContrast(!contrast)}>切面光</button>
    <button type="button" aria-label="复位当前视角" onClick={()=>cameraActions.current?.reset()}>复位</button>
  </fieldset>;
}
