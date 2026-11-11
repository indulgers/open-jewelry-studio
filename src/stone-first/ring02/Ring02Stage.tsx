import {Suspense,useEffect,useMemo,useRef,type ComponentRef} from 'react';
import {Canvas,useThree} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import {DoubleSide,OrthographicCamera,type Texture} from 'three';
import {JewelryLighting} from '../../viewer/JewelryLighting';
import {StudioFillLights} from '../../viewer/StudioFillLights';
import {createMetalMaterial} from '../../viewer/materials';
import {createGemOptics,syncGemDraw} from '../../viewer/gemOptics';
import {STUDIO_PRESETS} from '../../viewer/studioPresets';
import {buildMetal,type FittedStone,type RingDesign,type prepareTemplate} from './model';

export const VIEWS=[['overall','整体'],['top','戒面俯视'],['side','镶座侧面'],['macro','镶嵌特写']] as const;
export type RingView=typeof VIEWS[number][0];
const preset={...STUDIO_PRESETS.catalog,gemIntensity:1.18};
const cameras={
  overall:{position:[2.2,2.5,3.6],target:[0,.235,0],height:2.48},
  top:{position:[0,4.2,.001],target:[0,1.1,0],height:1.35},
  side:{position:[0,.815,3.8],target:[0,.815,0],height:1.45},
  macro:{position:[1.7,2.6,2.6],target:[0,1.14,0],height:1.04},
} as const;

function RingCamera({view,reset}:{view:RingView;reset:number}){
  const controls=useRef<ComponentRef<typeof OrbitControls>>(null);
  const {camera,size,invalidate}=useThree();
  useEffect(()=>{
    if(!(camera instanceof OrthographicCamera)||!controls.current)return;
    const framing=cameras[view];
    camera.position.fromArray(framing.position);
    camera.zoom=Math.min(size.height/framing.height,size.width/(view==='top'?2.14:1.46));
    camera.updateProjectionMatrix();
    controls.current.target.fromArray(framing.target);
    controls.current.update();
    invalidate();
  },[view,reset,camera,size.width,size.height,invalidate]);
  return <OrbitControls ref={controls} enablePan={false} minZoom={65} maxZoom={1400}/>;
}

function GemBatch({stones,environment}:{stones:FittedStone[];environment:Texture}){
  const {geometry,appearance}=stones[0];
  const optics=useMemo(()=>createGemOptics(geometry,environment,'standard',{
    appearance,environmentRotation:preset.rotation,environmentIntensity:preset.gemIntensity,dispersion:preset.dispersion,
  }),[geometry,environment,appearance]);
  useEffect(()=>()=>optics.dispose(),[optics]);
  return stones.map(stone=><mesh key={stone.name} name={stone.name} geometry={geometry} material={optics.material}
    matrix={stone.matrix} matrixAutoUpdate={false}
    onBeforeRender={(renderer,_scene,camera)=>syncGemDraw(optics.material,renderer,camera)}/>);
}

type SceneProps={template:ReturnType<typeof prepareTemplate>;design:RingDesign;stones:FittedStone[]};
function RingScene({template,design,stones}:SceneProps){
  const metal=useMemo(()=>buildMetal(template,design,stones),[template,design,stones]);
  useEffect(()=>()=>metal.forEach(part=>{if(part.owned)part.geometry.dispose();}),[metal]);
  const metalMaterial=useMemo(()=>{
    const material=createMetalMaterial(design.metal,preset);
    material.side=DoubleSide;
    material.roughness=preset.roughness;
    return material;
  },[design.metal]);
  useEffect(()=>()=>metalMaterial.dispose(),[metalMaterial]);
  const batches=new Map<string,FittedStone[]>();
  for(const stone of stones){
    const key=stone.geometry.uuid+'/'+stone.appearance;
    const existing=batches.get(key);
    if(existing)existing.push(stone);
    else batches.set(key,[stone]);
  }

  return <JewelryLighting preset={preset}>{environment=><group scale={.1} dispose={null}>
    {metal.map(part=><mesh key={part.name} name={part.name} geometry={part.geometry} material={metalMaterial}/>)}
    {[...batches].map(([key,batch])=><GemBatch key={key} stones={batch} environment={environment}/>)}
  </group>}</JewelryLighting>;
}

export function Ring02Stage({view,reset,...scene}:SceneProps&{view:RingView;reset:number}){
  return <div className="stone-first-canvas" aria-label="戒指 02 三维预览">
    <Canvas orthographic camera={{position:[2.2,2.5,3.6],near:.03,far:30}} dpr={[1,1.5]} frameloop="demand"
      gl={{antialias:true,preserveDrawingBuffer:true}}>
      <color attach="background" args={['#ffffff']}/>
      <ambientLight intensity={.2}/>
      <StudioFillLights neutral/>
      <Suspense fallback={null}><RingScene {...scene}/></Suspense>
      <RingCamera view={view} reset={reset}/>
    </Canvas>
  </div>;
}
