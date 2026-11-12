import {Suspense,useEffect,useLayoutEffect,useMemo,useRef,useState,type ComponentRef,type RefObject} from 'react';
import {Canvas,useThree} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import {DoubleSide,NeutralToneMapping,OrthographicCamera,Vector3,type Texture} from 'three';
import {JewelryLighting,clearJewelryLightingCache} from '../../viewer/JewelryLighting';
import {StudioFillLights} from '../../viewer/StudioFillLights';
import {createMetalMaterial} from '../../viewer/materials';
import {createGemOptics,syncGemDraw} from '../../viewer/gemOptics';
import {STUDIO_PRESETS} from '../../viewer/studioPresets';
import {ViewerBoundary} from '../../viewer/ViewerBoundary';
import {Ring02Loading} from './Ring02Loading';
import {RING02_POSTER} from './assets';
import {BASE_DESIGN,ZONES,buildMetal,type FittedStone,type RingDesign,type prepareTemplate} from './model';

export const VIEWS=[['overall','整体'],['top','戒面俯视'],['side','镶座侧面'],['macro','镶嵌特写']] as const;
export type RingView=typeof VIEWS[number][0];
export const preset={...STUDIO_PRESETS.catalog,gemIntensity:1.18,roughness:.115};
export type RingFraming={position:readonly[number,number,number];target:readonly[number,number,number];height:number};
const cameras={
  overall:{position:[2.2,2.5,3.6],target:[0,.235,0],height:2.48},
  top:{position:[0,4.2,.001],target:[0,1.1,0],height:1.35},
  side:{position:[0,.815,3.8],target:[0,.815,0],height:1.45},
  macro:{position:[1.7,2.6,2.6],target:[0,1.14,0],height:1.04},
} as const;

export function RingCamera({view,reset,frames=cameras}:{view:RingView;reset:number;frames?:Record<RingView,RingFraming>}){
  const controls=useRef<ComponentRef<typeof OrbitControls>>(null);
  const {camera,size,invalidate}=useThree();
  const previous=useRef<{view:RingView;reset:number;camera:OrthographicCamera;framing:RingFraming;fitZoom:number}>(null);
  useLayoutEffect(()=>{
    if(!(camera instanceof OrthographicCamera)||!controls.current||!size.width||!size.height)return;
    const framing=frames[view];
    const widthFit=size.width/(view==='top'?2.14:1.46);
    const fitZoom=Math.min(size.height/framing.height,widthFit);
    const last=previous.current;
    if(last?.camera===camera&&last.view===view&&last.reset===reset){
      // Resize against the previous model so swapping parts keeps the user's zoom.
      camera.zoom*=Math.min(size.height/last.framing.height,widthFit)/last.fitZoom;
      if(framing!==last.framing){
        const delta=new Vector3().fromArray(framing.target).sub(new Vector3().fromArray(last.framing.target));
        camera.position.add(delta);
        controls.current.target.add(delta);
        controls.current.update();
      }
    }else{
      camera.position.fromArray(framing.position);
      camera.zoom=fitZoom;
      controls.current.target.fromArray(framing.target);
      controls.current.update();
    }
    previous.current={view,reset,camera,framing,fitZoom};
    camera.updateProjectionMatrix();
    invalidate();
  },[view,reset,camera,size.width,size.height,invalidate,frames]);
  return <OrbitControls ref={controls} enablePan={false} minZoom={65} maxZoom={1400}/>;
}

export function RingThumbnail({captureRef,ready,frames=cameras,onCaptureReady}:{
  captureRef:RefObject<(()=>string|undefined)|null>;ready:boolean;frames?:Record<RingView,RingFraming>;onCaptureReady?:(ready:boolean)=>void;
}){
  const {gl,scene,camera,invalidate}=useThree();
  useEffect(()=>{
    if(!ready)return;
    captureRef.current=()=>{
      const source=gl.domElement;
      const side=Math.min(source.width,source.height);
      if(!side||gl.getContext().isContextLost())return;
      const thumbnail=document.createElement('canvas');
      thumbnail.width=thumbnail.height=320;
      const context=thumbnail.getContext('2d');
      if(!context)return;
      const {position,target,height}=frames.overall;
      const halfWidth=height*source.width/(2*side),halfHeight=height*source.height/(2*side);
      const photo=new OrthographicCamera(-halfWidth,halfWidth,halfHeight,-halfHeight,.03,30);
      photo.position.fromArray(position);
      photo.lookAt(...target);
      try{
        gl.render(scene,photo);
        context.drawImage(source,(source.width-side)/2,(source.height-side)/2,side,side,0,0,320,320);
        return thumbnail.toDataURL('image/jpeg',.88);
      }finally{
        // Keep the inspection angle visible while the fixed-angle photo is taken.
        gl.render(scene,camera);
        invalidate();
      }
    };
    onCaptureReady?.(true);
    return ()=>{captureRef.current=null;onCaptureReady?.(false);};
  },[captureRef,ready,gl,scene,camera,invalidate,frames,onCaptureReady]);
  return null;
}

export type PlacedGem=Pick<FittedStone,'name'|'geometry'|'appearance'|'matrix'>;
export function GemBatch({stones,environment}:{stones:PlacedGem[];environment:Texture}){
  const {geometry,appearance}=stones[0];
  const optics=useMemo(()=>createGemOptics(geometry,environment,'standard',{
    appearance,environmentOnly:true,environmentRotation:preset.rotation,environmentIntensity:preset.gemIntensity,dispersion:preset.dispersion,
  }),[geometry,environment,appearance]);
  useEffect(()=>()=>optics.dispose(),[optics]);
  return stones.map(stone=><mesh key={stone.name} name={stone.name} geometry={geometry} material={optics.material}
    matrix={stone.matrix} matrixAutoUpdate={false}
    onBeforeRender={(renderer,_scene,camera)=>syncGemDraw(optics.material,renderer,camera)}/>);
}

type SceneProps={template:ReturnType<typeof prepareTemplate>;design:RingDesign;stones:FittedStone[]};
function RingScene({template,design,stones,onReady}:SceneProps&{onReady?:()=>void}){
  const metal=useMemo(()=>buildMetal(template,design,stones),[template,design,stones]);
  useEffect(()=>()=>metal.forEach(part=>{if(part.owned)part.geometry.dispose();}),[metal]);
  const metalMaterial=useMemo(()=>{
    const material=createMetalMaterial('white',preset);
    material.side=DoubleSide;
    return material;
  },[]);
  useEffect(()=>()=>metalMaterial.dispose(),[metalMaterial]);
  const batches=new Map<string,FittedStone[]>();
  for(const stone of stones){
    const key=stone.geometry.uuid+'/'+stone.appearance;
    const existing=batches.get(key);
    if(existing)existing.push(stone);
    else batches.set(key,[stone]);
  }

  return <JewelryLighting preset={preset}>{environment=><group scale={.1} dispose={null}>
    {metal.map((part,index)=><mesh key={part.name} name={part.name} geometry={part.geometry} material={metalMaterial} onAfterRender={index===0?onReady:undefined}/>)}
    {[...batches].map(([key,batch])=><GemBatch key={key} stones={batch} environment={environment}/>)}
  </group>}</JewelryLighting>;
}

export function Ring02Stage({view,reset,design,captureRef,...scene}:SceneProps&{
  view:RingView;reset:number;captureRef:RefObject<(()=>string|undefined)|null>;
}){
  const [ready,setReady]=useState(false);
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
    setReady(false);
    setFailed(false);
  }
  return <div className="stone-first-canvas ring02-canvas" aria-label="戒指 02 三维预览">
    <ViewerBoundary onRetry={retry} onError={()=>setFailed(true)} errorDetail={errorDetail}>
      <Canvas orthographic camera={{position:[2.2,2.5,3.6],near:.03,far:30}} dpr={[1,1.5]} frameloop="demand"
        gl={{antialias:true,preserveDrawingBuffer:true}} onCreated={({gl})=>{gl.toneMapping=NeutralToneMapping;}}>
        <color attach="background" args={['#ffffff']}/>
        <StudioFillLights neutral/>
        <Suspense fallback={null}><RingScene {...scene} design={design} onReady={ready?undefined:()=>setReady(true)}/></Suspense>
        <RingCamera view={view} reset={reset}/>
        <RingThumbnail captureRef={captureRef} ready={ready&&!failed}/>
      </Canvas>
    </ViewerBoundary>
    {!ready&&!failed&&<Ring02Loading/>}
  </div>;
}
