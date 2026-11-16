import {Suspense,useCallback,useEffect,useMemo,useState,type RefObject} from 'react';
import {Canvas,useThree} from '@react-three/fiber';
import {DoubleSide,NeutralToneMapping,type Texture} from 'three';
import {JewelryLighting,clearJewelryLightingCache} from '../../viewer/JewelryLighting';
import {StudioFillLights} from '../../viewer/StudioFillLights';
import {ViewerBoundary} from '../../viewer/ViewerBoundary';
import {createMetalMaterial} from '../../viewer/materials';
import {createMountGeometry} from '../../viewer/mountGeometry';
import {STUDIO_PRESETS} from '../../viewer/studioPresets';
import {GemBatch,RingCamera,RingThumbnail,type PlacedGem,type RingView} from '../ring02/Ring02Stage';
import type {CatalogRing} from '../catalog';
import type {ReferenceDesign} from './design';
import type {applyReferencePave} from './pave';

export type SourceFrame={ring:ReturnType<typeof applyReferencePave>;design:ReferenceDesign};
// Fiber ignores undefined updates, so explicitly retire the previous mesh callback.
const ignoreRender=()=>{};
const preset=STUDIO_PRESETS.catalog;

type PreviewTemplate=Pick<CatalogRing,'name'>&Partial<Pick<CatalogRing,'image'>>;
export function SourceReferenceImage({template}:{template:PreviewTemplate}){
  return <>{template.image&&<figure className="source-reference-fallback"><img src={template.image} alt={template.name+'原款参考图'}/><figcaption>原款参考图，仅供款式参考</figcaption></figure>}<p>当前配置已保留。恢复三维预览后可继续核对搭配。</p></>;
}
export function SourceLoading({template,retry}:{template:PreviewTemplate;retry?:()=>void}){
  return <div className="ring02-stage-loading" role={retry?'alert':'status'}>
    {!retry&&<span className="ring02-spinner" aria-hidden="true"/>}
    <span>{retry?'三维预览暂未加载。':template.name+'正在准备三维预览…'}</span>
    {retry&&<><SourceReferenceImage template={template}/><button onClick={retry}>重试加载</button><a href="#/diy/collection">返回款式目录</a></>}
  </div>;
}
function ContextMonitor({onLost}:{onLost:()=>void}){
  const {gl}=useThree();
  useEffect(()=>{
    const canvas=gl.domElement;
    const lost=(event:Event)=>{event.preventDefault();onLost();};
    canvas.addEventListener('webglcontextlost',lost);
    return ()=>canvas.removeEventListener('webglcontextlost',lost);
  },[gl,onLost]);
  return null;
}
function SourceScene({ring,design,environment,onReady}:SourceFrame&{environment:Texture;onReady?:()=>void}){
  const material=useMemo(()=>{const result=createMetalMaterial('white',preset);result.side=DoubleSide;return result;},[]);
  useEffect(()=>()=>material.dispose(),[material]);
  const mountGeometry=useMemo(()=>createMountGeometry(ring.metal.map(part=>part.geometry),ring.metal.map(part=>part.offsetY??0)),[ring.metal]);
  useEffect(()=>()=>mountGeometry.dispose(),[mountGeometry]);
  const mount=useMemo(()=>({bvh:mountGeometry.bvh,color:material.color,roughness:preset.roughness}),[mountGeometry,material]);
  const batches=useMemo(()=>{
    const groups=new Map<string,PlacedGem[]>();
    for(const stone of ring.stones){
      const appearance=design[stone.zone],key=stone.zone+'/'+stone.geometry.uuid+'/'+appearance;
      const batch=groups.get(key)??[];
      batch.push({...stone,appearance});
      groups.set(key,batch);
    }
    return [...groups];
  },[ring,design]);
  return <group dispose={null}>
    {ring.metal.map((part,index)=><mesh key={part.name} geometry={part.geometry} position-y={part.offsetY??0} material={material} name={part.name}
      frustumCulled={index!==0||!onReady} onAfterRender={index===0&&onReady?onReady:ignoreRender}/>)}
    {batches.map(([key,stones])=><GemBatch key={key} environment={environment} stones={stones}
      studio={preset} mount={key.startsWith('center/')?mount:undefined}/>)}
  </group>;
}
export function SourceRingStage({ring,design,template,view,reset,captureRef,onCaptureReady,captureSize}:SourceFrame&{
  captureSize?:number;template:PreviewTemplate;view:RingView;reset:number;captureRef:RefObject<(()=>string|undefined)|null>;onCaptureReady:(frame:SourceFrame|null)=>void;
}){
  const [rendered,setRendered]=useState<SourceFrame|null>(null),[failed,setFailed]=useState(false);
  const [contextLost,setContextLost]=useState(false);
  const ready=rendered?.ring===ring&&rendered.design===design;
  const reportCapture=useCallback((available:boolean)=>onCaptureReady(available?{ring,design}:null),[onCaptureReady,ring,design]);
  const loseContext=useCallback(()=>{setContextLost(true);captureRef.current=null;onCaptureReady(null);},[captureRef,onCaptureReady]);
  const retry=()=>{clearJewelryLightingCache();setRendered(null);setFailed(false);setContextLost(false);};
  return <div className="stone-first-canvas ring02-canvas source-ring-canvas" aria-label={template.name+'三维预览'}>
    {contextLost?<div className="viewer-message error-message" role="alert"><strong>三维显示已中断</strong><SourceReferenceImage template={template}/><button onClick={retry}>重新加载模型</button><a href="#/diy/collection">返回款式目录</a></div>:
    <ViewerBoundary onError={()=>setFailed(true)} onRetry={retry} errorDetail={<><SourceReferenceImage template={template}/><a href="#/diy/collection">返回款式目录</a></>}>
      <Canvas orthographic camera={{position:[2.2,2.5,3.6],near:.03,far:30}} dpr={[1,1.5]} frameloop="demand" gl={{antialias:true,preserveDrawingBuffer:true}} onCreated={({gl})=>{gl.toneMapping=NeutralToneMapping;}}>
        <ContextMonitor onLost={loseContext}/><color attach="background" args={['#fff']}/><StudioFillLights neutral/>
        <Suspense fallback={null}>
          <JewelryLighting preset={preset}>{environment=><SourceScene ring={ring} design={design} environment={environment}
            onReady={ready?undefined:()=>setRendered(frame=>frame?.ring===ring&&frame.design===design?frame:{ring,design})}/>}</JewelryLighting>
        </Suspense>
        <RingCamera view={view} reset={reset} frames={ring.frames}/><RingThumbnail size={captureSize} captureRef={captureRef} ready={ready&&!failed} frames={ring.frames} onCaptureReady={reportCapture}/>
      </Canvas>
    </ViewerBoundary>}
    {!rendered&&!failed&&!contextLost&&<SourceLoading template={template}/>}
  </div>;
}
