import {Suspense,useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState,type RefObject} from 'react';
import {Canvas,useThree} from '@react-three/fiber';
import {createInspectionOrbit,setInspectionDrag} from './inspection-camera';
import {RingInspectionTools,useRingInspection,MIN_INSPECTION_ZOOM,MAX_INSPECTION_ZOOM,type Inspection} from './RingInspection';
import {EngravingOverlay} from '../engraving/EngravingOverlay';
import type {EngravingStyle} from '../engraving/style';
import {DoubleSide,NeutralToneMapping,OrthographicCamera,Vector3,type Texture} from 'three';
import {JewelryLighting,clearJewelryLightingCache} from '../../viewer/JewelryLighting';
import {JewelryPostprocessing} from '../../viewer/JewelryPostprocessing';
import {createMountGeometry} from '../../viewer/mountGeometry';
import {StudioFillLights} from '../../viewer/StudioFillLights';
import {createMetalMaterial} from '../../viewer/materials';
import {createGemOptics,syncGemDraw,updateGemOptics,type GemOpticsOptions} from '../../viewer/gemOptics';
import {STUDIO_PRESETS,type StudioPreset} from '../../viewer/studioPresets';
import {ViewerBoundary} from '../../viewer/ViewerBoundary';
import {Ring02Loading} from './Ring02Loading';
import {RING02_POSTER} from './assets';
import {BASE_DESIGN,ZONES,buildMetal,type FittedStone,type RingDesign,type prepareTemplate} from './model';

export const VIEWS=[['overall','整体'],['top','戒面俯视'],['side','镶座侧面'],['macro','镶嵌特写']] as const;
export type RingView=typeof VIEWS[number][0];
export const preset=STUDIO_PRESETS.catalog;
export type RingFraming={position:readonly[number,number,number];target:readonly[number,number,number];height:number};
const cameras={
  overall:{position:[2.2,2.5,3.6],target:[0,.235,0],height:2.48},
  top:{position:[0,4.2,.001],target:[0,1.1,0],height:1.35},
  side:{position:[0,.815,3.8],target:[0,.815,0],height:1.45},
  macro:{position:[1.7,2.6,2.6],target:[0,1.14,0],height:1.04},
} as const;

const ENGRAVING_FRAME:RingFraming={position:[0,1.4,2.4],target:[0,-.85,0],height:.9};

export function RingCamera({view,reset,frames=cameras,engravingView=false,inspection}:{view:RingView;reset:number;frames?:Record<RingView,RingFraming>;engravingView?:boolean;inspection:Inspection}){
  const {camera,gl,size,invalidate}=useThree();
  const {mode,cameraActions,setZoom,motion}=inspection;
  const orbitRef=useRef<ReturnType<typeof createInspectionOrbit>|null>(null);
  const fit=useRef(1);
  const last=useRef<{framing:RingFraming;view:RingView;reset:number;engravingView:boolean;width:number;height:number}|null>(null);
  useLayoutEffect(()=>{
    if(!(camera instanceof OrthographicCamera))return;
    const orbit=createInspectionOrbit(camera,gl.domElement);
    orbitRef.current=orbit;
    let dragging=false;
    let settleTimer:ReturnType<typeof setTimeout>;
    const start=()=>{dragging=true;clearTimeout(settleTimer);};
    const settle=()=>{motion.current.active=false;invalidate();};
    const end=()=>{
      dragging=false;
      clearTimeout(settleTimer);
      // Wheel events each start and end synchronously. Keep a burst in the same render mode.
      settleTimer=setTimeout(settle,100);
    };
    let lastCameraZoom=camera.zoom;
    const refresh=()=>{
      if(dragging)motion.current.active=true;
      const percent=Math.round(camera.zoom/fit.current*100);
      if(camera.zoom!==lastCameraZoom){setZoom(percent);lastCameraZoom=camera.zoom;}
      invalidate();
    };
    orbit.addEventListener('start',start);
    orbit.addEventListener('end',end);
    orbit.addEventListener('change',refresh);
    return ()=>{clearTimeout(settleTimer);motion.current.active=false;orbit.removeEventListener('start',start);orbit.removeEventListener('end',end);orbit.removeEventListener('change',refresh);orbit.dispose();orbitRef.current=null;last.current=null;};
  },[camera,gl,invalidate,setZoom,motion]);
  useLayoutEffect(()=>{if(orbitRef.current)setInspectionDrag(orbitRef.current,mode);},[mode,camera,gl]);
  useLayoutEffect(()=>{
    const orbit=orbitRef.current;
    if(!(camera instanceof OrthographicCamera)||!orbit||!size.width||!size.height)return;
    const framing=engravingView?ENGRAVING_FRAME:frames[view];
    const width=view==='top'&&!engravingView?2.14:1.46;
    const fitAt=(w:number,h:number,f:RingFraming)=>Math.min(h/f.height,w/width);
    const naturalZoom=fitAt(size.width,size.height,framing);
    fit.current=naturalZoom;
    orbit.minZoom=naturalZoom*MIN_INSPECTION_ZOOM;
    orbit.maxZoom=naturalZoom*MAX_INSPECTION_ZOOM;
    const update=()=>{
      camera.zoom=Math.max(orbit.minZoom,Math.min(orbit.maxZoom,camera.zoom));
      camera.updateProjectionMatrix();orbit.update();setZoom(Math.round(camera.zoom/naturalZoom*100));invalidate();
    };
    const resetCamera=()=>{
      camera.position.fromArray(framing.position);
      orbit.target.fromArray(framing.target);
      camera.zoom=naturalZoom;update();
    };
    const prior=last.current;
    if(prior&&prior.view===view&&prior.reset===reset&&prior.engravingView===engravingView){
      // Reframe a resized canvas without throwing away the inspection offset on a part swap.
      camera.zoom*=fitAt(size.width,size.height,prior.framing)/fitAt(prior.width,prior.height,prior.framing);
      if(prior.framing!==framing){
        const delta=new Vector3().fromArray(framing.target).sub(new Vector3().fromArray(prior.framing.target));
        camera.position.add(delta);orbit.target.add(delta);
      }
      update();
    }else resetCamera();
    last.current={framing,view,reset,engravingView,width:size.width,height:size.height};
    cameraActions.current={zoom:factor=>{camera.zoom*=factor;update();},reset:resetCamera};
    return ()=>{cameraActions.current=null;};
  },[camera,gl,size.width,size.height,frames,reset,view,engravingView,cameraActions,setZoom,invalidate]);
  return null;
}

export type RingCapture=(mode?:'inspection')=>string|undefined;
const afterFrame=()=>{};

export function RingThumbnail({captureRef,ready,frames=cameras,onCaptureReady,size=320,motion}:{
  motion?:Inspection['motion'];
  captureRef:RefObject<RingCapture|null>;ready:boolean;size?:number;frames?:Record<RingView,RingFraming>;onCaptureReady?:(ready:boolean)=>void;
}){
  const {gl,scene,camera,invalidate}=useThree();
  useLayoutEffect(()=>{
    if(!ready)return;
    captureRef.current=mode=>{
      const source=gl.domElement;
      const side=Math.min(source.width,source.height);
      if(!side||gl.getContext().isContextLost())return;
      const thumbnail=document.createElement('canvas');
      thumbnail.width=thumbnail.height=size;
      const context=thumbnail.getContext('2d');
      if(!context)return;
      if(mode==='inspection'){
        motion?.current.restore();
        const scale=Math.min(1,768/Math.max(source.width,source.height));
        thumbnail.width=Math.max(1,Math.round(source.width*scale));
        thumbnail.height=Math.max(1,Math.round(source.height*scale));
        // Capture the displayed, postprocessed frame including the inspection angle and pan.
        context.drawImage(source,0,0,thumbnail.width,thumbnail.height);
        return thumbnail.toDataURL('image/jpeg',.88);
      }
      const {position,target,height}=frames.overall;
      const halfWidth=height*source.width/(2*side),halfHeight=height*source.height/(2*side);
      const photo=new OrthographicCamera(-halfWidth,halfWidth,halfHeight,-halfHeight,.03,30);
      photo.position.fromArray(position);
      photo.lookAt(...target);
      try{
        gl.render(scene,photo);
        context.drawImage(source,(source.width-side)/2,(source.height-side)/2,side,side,0,0,size,size);
        return thumbnail.toDataURL('image/jpeg',.88);
      }finally{
        // Keep the inspection angle visible while the fixed-angle photo is taken.
        gl.render(scene,camera);
        invalidate();
      }
    };
    onCaptureReady?.(true);
    return ()=>{captureRef.current=null;onCaptureReady?.(false);};
  },[captureRef,ready,gl,scene,camera,invalidate,frames,onCaptureReady,size,motion]);
  return null;
}

export type PlacedGem=Pick<FittedStone,'name'|'geometry'|'appearance'|'matrix'>;
export function GemBatch({stones,environment,studio=preset,mount,sample}:{stones:PlacedGem[];environment:Texture;studio?:StudioPreset;sample?:GemOpticsOptions['sample'];mount?:GemOpticsOptions['mount']}){
  const {geometry,appearance}=stones[0];
  const environmentOnly=!mount;
  const optics=useMemo(()=>createGemOptics(geometry,environment,'high',{environmentOnly}),[geometry,environment,environmentOnly]);
  useLayoutEffect(()=>{
    updateGemOptics(optics.material,{appearance,sample,mount,environmentRotation:studio.rotation,environmentIntensity:studio.gemIntensity,dispersion:studio.dispersion});
  },[optics,appearance,sample,mount,studio]);
  useEffect(()=>()=>optics.dispose(),[optics]);
  return stones.map(stone=><mesh key={stone.name} name={stone.name} geometry={geometry} material={optics.material}
    matrix={stone.matrix} matrixAutoUpdate={false}
    onBeforeRender={(renderer,_scene,camera)=>syncGemDraw(optics.material,renderer,camera)}/>);
}

type SceneProps={template:ReturnType<typeof prepareTemplate>;design:RingDesign;stones:FittedStone[]};
type Lettering={engraving?:string;engravingStyle?:EngravingStyle};
function RingScene({template,design,stones,studio,engraving,engravingStyle,onReady}:SceneProps&Lettering&{studio:StudioPreset;onReady?:()=>void}){
  const metal=useMemo(()=>buildMetal(template,design,stones),[template,design,stones]);
  useEffect(()=>()=>metal.forEach(part=>{if(part.owned)part.geometry.dispose();}),[metal]);
  const metalMaterial=useMemo(()=>{
    const material=createMetalMaterial('white',studio);
    material.side=DoubleSide;
    return material;
  },[studio]);
  useEffect(()=>()=>metalMaterial.dispose(),[metalMaterial]);
  const mountGeometry=useMemo(()=>{
    const worldMetal=metal.map(part=>part.geometry.clone().scale(.1,.1,.1));
    try{return createMountGeometry(worldMetal);}finally{worldMetal.forEach(geometry=>geometry.dispose());}
  },[metal]);
  useEffect(()=>()=>mountGeometry.dispose(),[mountGeometry]);
  const mount=useMemo(()=>({bvh:mountGeometry.bvh,color:metalMaterial.color,roughness:studio.roughness}),[mountGeometry,metalMaterial,studio]);
  const batches=new Map<string,FittedStone[]>();
  for(const stone of stones){
    const key=stone.geometry.uuid+'/'+stone.appearance;
    const existing=batches.get(key);
    if(existing)existing.push(stone);
    else batches.set(key,[stone]);
  }

  return <JewelryLighting preset={studio}>{environment=><><group scale={.1} dispose={null}>
    {metal.map((part,index)=><mesh key={part.name} name={part.name} geometry={part.geometry} material={metalMaterial} frustumCulled={index!==0||!onReady} onAfterRender={index===0&&onReady?onReady:afterFrame}/>)}
    {[...batches].map(([key,batch])=><GemBatch key={key} stones={batch} environment={environment} studio={studio} mount={mount}/>)}
  </group>{engraving&&<EngravingOverlay parts={metal} modelScale={.1} text={engraving} style={engravingStyle}/>}</>}</JewelryLighting>;
}

export function Ring02Stage({view,reset,design,captureRef,onCaptureReady,engravingView=false,...scene}:SceneProps&Lettering&{
  engravingView?:boolean;onCaptureReady:(design:RingDesign|null)=>void;
  view:RingView;reset:number;captureRef:RefObject<RingCapture|null>;
}){
  const inspection=useRingInspection();
  const {engraving,engravingStyle,stones}=scene;
  const frame=useMemo(()=>({design,stones,engraving,font:engravingStyle?.font,studio:inspection.studio}),
    [design,stones,engraving,engravingStyle?.font,inspection.studio]);
  const [rendered,setRendered]=useState<typeof frame|null>(null);
  const ready=rendered===frame;
  const reportReady=useCallback((available:boolean)=>onCaptureReady(available?design:null),[onCaptureReady,design]);
  const [failed,setFailed]=useState(false);
  const matchesPoster=design.head===BASE_DESIGN.head&&design.reach===BASE_DESIGN.reach
    &&ZONES.every(zone=>{
      const {cut,size,appearance}=design[zone];
      const original=BASE_DESIGN[zone];
      return cut===original.cut&&size===original.size&&appearance===original.appearance;
    });
  const errorDetail=matchesPoster?<figure className="ring02-preview-fallback">
    <img src={RING02_POSTER} alt="银色围钻戒指整体图"/>
    <figcaption>当前方案的整体参考图</figcaption>
  </figure>:<p>当前配置没有可用参考图。重新加载可尝试恢复三维预览，配置会保留。</p>;
  function retry(){
    clearJewelryLightingCache();
    setRendered(null);
    setFailed(false);
  }
  return <><RingInspectionTools inspection={inspection} enabled={ready&&!failed}/><div className="stone-first-canvas ring02-canvas" aria-label="戒指 02 三维预览">
    <ViewerBoundary onRetry={retry} onError={()=>setFailed(true)} errorDetail={errorDetail}>
      <Canvas orthographic camera={{position:[2.2,2.5,3.6],near:.03,far:30}} dpr={[1,2]} frameloop="demand"
        gl={{antialias:true,preserveDrawingBuffer:true}} onCreated={({gl})=>{gl.toneMapping=NeutralToneMapping;}}>
        <color attach="background" args={['#ffffff']}/>
        <StudioFillLights neutral/>
        <Suspense fallback={null}><RingScene {...scene} studio={inspection.studio} design={design} onReady={ready?undefined:()=>setRendered(frame)}/></Suspense>
        <JewelryPostprocessing motion={inspection.motion} sceneRevision={ready?frame:undefined} quality="high" capturing={false} whiteBackground contentKey="precision-ring"/>
        <RingCamera view={view} reset={reset} engravingView={engravingView} inspection={inspection}/>
        <RingThumbnail motion={inspection.motion} captureRef={captureRef} ready={ready&&!failed} onCaptureReady={reportReady}/>
      </Canvas>
    </ViewerBoundary>
    {!rendered&&!failed&&<Ring02Loading/>}
  </div></>;
}
