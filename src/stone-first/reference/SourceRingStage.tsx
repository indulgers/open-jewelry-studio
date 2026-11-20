import {EngravingOverlay} from '../engraving/EngravingOverlay';
import {Suspense,useCallback,useEffect,useMemo,useState,type RefObject} from 'react';
import {atelierGem,type GemShapeId} from '../../assets/atelierManifest';
import {firstMeshGeometry} from '../../geometry/productGeometry';
import {fitCenterSetting} from './center-setting';
import {gemSample} from './styling';
import {useGLTF} from '@react-three/drei';
import {Canvas} from '@react-three/fiber';
import {DoubleSide,NeutralToneMapping,type BufferGeometry,type Texture} from 'three';
import {JewelryLighting,clearJewelryLightingCache} from '../../viewer/JewelryLighting';
import {JewelryPostprocessing} from '../../viewer/JewelryPostprocessing';
import {StudioFillLights} from '../../viewer/StudioFillLights';
import {ViewerBoundary} from '../../viewer/ViewerBoundary';
import {createMetalMaterial} from '../../viewer/materials';
import {createMountGeometry} from '../../viewer/mountGeometry';
import type {StudioPreset} from '../../viewer/studioPresets';
import {RingInspectionTools,useRingInspection} from '../ring02/RingInspection';
import {GemBatch,RingCamera,RingThumbnail,type PlacedGem,type RingView,type RingCapture} from '../ring02/Ring02Stage';
import type {CatalogRing} from '../catalog';
import type {ReferenceDesign} from './design';
import type {applyReferencePave} from './pave';

export type SourceFrame={ring:ReturnType<typeof applyReferencePave>;design:ReferenceDesign};
// Fiber ignores undefined updates, so explicitly retire the previous mesh callback.
const ignoreRender=()=>{};

export function SourceLoading({template,retry}:{template:Pick<CatalogRing,'name'>;retry?:()=>void}){
  return <div className="ring02-stage-loading" role={retry?'alert':'status'}>
    {!retry&&<span className="ring02-spinner" aria-hidden="true"/>}
    <span>{retry?'三维预览暂未加载。':template.name+'正在准备三维预览…'}</span>
    {retry&&<button onClick={retry}>重试加载</button>}
  </div>;
}
type SceneProps=SourceFrame&{environment:Texture;studio:StudioPreset;onReady?:(issue:string)=>void};
function CutScene({cut,...props}:SceneProps&{cut:GemShapeId}){
  const {scene}=useGLTF(atelierGem(cut).url);
  const cutGeometry=useMemo(()=>firstMeshGeometry(scene),[scene]);
  useEffect(()=>()=>cutGeometry.dispose(),[cutGeometry]);
  return <SourceScene {...props} cutGeometry={cutGeometry}/>;
}
function SourceScene({ring,design,environment,studio,onReady,cutGeometry}:SceneProps&{cutGeometry?:BufferGeometry}){
  const plating=design.styling?.plating??'white',surface=design.styling?.surface??'polished';
  const carat=design.styling?.carat??'original';
  const setting=useMemo(()=>fitCenterSetting(ring,cutGeometry,carat==='original'?1:Math.cbrt(carat)),[ring,cutGeometry,carat]);
  useEffect(()=>()=>setting.dispose(),[setting]);
  const material=useMemo(()=>{
    const result=createMetalMaterial(plating,studio);
    result.side=DoubleSide;
    if(surface==='matte')result.roughness=.43;
    return result;
  },[plating,surface,studio]);
  useEffect(()=>()=>material.dispose(),[material]);
  const mountGeometry=useMemo(()=>createMountGeometry(setting.metal.map(part=>part.geometry),setting.metal.map(part=>part.offsetY??0)),[setting.metal]);
  useEffect(()=>()=>mountGeometry.dispose(),[mountGeometry]);
  const mount=useMemo(()=>({tree:mountGeometry.tree,bvh:mountGeometry.bvh,color:material.color,roughness:material.roughness}),[mountGeometry,material]);
  const batches=useMemo(()=>{
    const groups=new Map<string,PlacedGem[]>();
    for(const stone of setting.stones){
      const geometry=stone.geometry;
      const appearance=design[stone.zone],key=stone.zone+'/'+geometry.uuid+'/'+appearance;
      const batch=groups.get(key)??[];
      batch.push({...stone,geometry,appearance});
      groups.set(key,batch);
    }
    return [...groups];
  },[setting,design]);
  return <group dispose={null}>
    {setting.metal.map((part,index)=><mesh key={part.name} geometry={part.geometry} position-y={part.offsetY??0} material={material} name={part.name}
      frustumCulled={index!==0||!onReady} onAfterRender={index===0&&onReady?()=>onReady(setting.issue):ignoreRender}/>)}
    {design.engraving&&<EngravingOverlay parts={setting.metal} text={design.engraving} style={design.engravingStyle}/>}
    {batches.map(([key,stones])=><GemBatch key={key} environment={environment} stones={stones}
      studio={studio} mount={mount} sample={key.startsWith('center/')&&design.styling?gemSample(design.styling.gem).optics:undefined}/>)}
  </group>;
}
export function SourceRingStage({ring,design,template,view,reset,captureRef,onCaptureReady,captureSize,engravingView=false}:SourceFrame&{
  engravingView?:boolean;captureSize?:number;template:Pick<CatalogRing,'name'>;view:RingView;reset:number;captureRef:RefObject<RingCapture|null>;onCaptureReady:(frame:SourceFrame|null)=>void;
}){
  const inspection=useRingInspection();
  const [rendered,setRendered]=useState<(SourceFrame&{studio:StudioPreset;issue:string})|null>(null),[failed,setFailed]=useState(false);
  const ready=rendered?.ring===ring&&rendered.design===design&&rendered.studio===inspection.studio;
  const issue=ready?rendered.issue:'';
  const reportCapture=useCallback((available:boolean)=>onCaptureReady(available?{ring,design}:null),[onCaptureReady,ring,design]);
  return <><RingInspectionTools inspection={inspection} enabled={!!rendered&&!failed}/><div className="stone-first-canvas ring02-canvas source-ring-canvas" aria-label={template.name+'三维预览'}>
    <ViewerBoundary onError={()=>setFailed(true)} onRetry={()=>{clearJewelryLightingCache();if(design.styling&&design.styling.cut!=='original')useGLTF.clear(atelierGem(design.styling.cut).url);setRendered(null);setFailed(false);}} errorDetail={<p>配置已保留。请重试加载以恢复三维预览。</p>}>
      <Canvas orthographic camera={{position:[2.2,2.5,3.6],near:.03,far:30}} dpr={[1,2]} frameloop="demand" gl={{antialias:true,preserveDrawingBuffer:true}} onCreated={({gl})=>{gl.toneMapping=NeutralToneMapping;}}>
        <color attach="background" args={['#fff']}/><StudioFillLights neutral/>
        <Suspense fallback={null}>
          <JewelryLighting preset={inspection.studio}>{environment=>{
            const props={ring,design,environment,studio:inspection.studio,onReady:ready?undefined:(issue:string)=>setRendered(frame=>frame?.ring===ring&&frame.design===design&&frame.studio===inspection.studio?frame:{ring,design,studio:inspection.studio,issue})};
            return design.styling&&design.styling.cut!=='original'?<CutScene {...props} cut={design.styling.cut}/>:<SourceScene {...props}/>;
          }}</JewelryLighting>
        </Suspense>
        <JewelryPostprocessing motion={inspection.motion} sceneRevision={ready&&rendered?rendered:undefined} quality="high" capturing={false} whiteBackground contentKey="source-ring"/>
        <RingCamera view={view} reset={reset} frames={ring.frames} engravingView={engravingView} inspection={inspection}/><RingThumbnail motion={inspection.motion} size={captureSize} captureRef={captureRef} ready={ready&&!failed&&!issue} frames={ring.frames} onCaptureReady={reportCapture}/>
      </Canvas>
    </ViewerBoundary>
    {issue&&<p className="source-fit-issue" role="alert">当前显示原款镶座。{issue}</p>}
    {!rendered&&!failed&&<SourceLoading template={template}/>}
  </div></>;
}
