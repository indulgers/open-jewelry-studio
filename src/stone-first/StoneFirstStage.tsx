import {Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {Canvas,useThree} from '@react-three/fiber';
import {OrbitControls,useGLTF} from '@react-three/drei';
import {type BufferGeometry,type Texture} from 'three';
import {AccentInstances} from './AccentInstances';
import {fuseDesign,type BooleanReport,type BooleanResult} from './solid/manifoldFusion';
import {firstMeshGeometry} from '../geometry/productGeometry';
import {prepareGirdleGem} from './gemFit';
import {JewelryLighting} from '../viewer/JewelryLighting';
import {StudioFillLights} from '../viewer/StudioFillLights';
import {createMetalMaterial} from '../viewer/materials';
import {OpticalGem} from '../viewer/OpticalGem';
import {createGemOptics,syncGemDraw} from '../viewer/gemOptics';
import {STUDIO_PRESETS,type StudioPresetId} from '../viewer/studioPresets';
import {bandRadius,buildStoneLayout,constrainDesign,type Design,type Site} from './recipe';

import type {Quality} from '../viewer/quality';
import type {OrbitControls as OrbitControlsImpl} from 'three-stdlib';

function OpticalAccentBatch({geometry,sites,environment,quality,preset}:{geometry:BufferGeometry;sites:Site[];environment:Texture;quality:Quality;preset:typeof STUDIO_PRESETS[StudioPresetId]}){
 const owned=useMemo(()=>createGemOptics(geometry,environment,quality,{environmentRotation:preset.rotation,
    environmentIntensity:preset.gemIntensity,dispersion:preset.dispersion}),[geometry,environment,quality,preset]);
 useEffect(()=>()=>owned.dispose(),[owned]);
 return <group dispose={null}>{sites.map(site=><mesh key={site.id} geometry={geometry} material={owned.material}
    position={[site.x,site.y,site.z]} rotation={[0,0,-site.tilt]} scale={site.diameter/2}
    onBeforeRender={(renderer,_scene,camera)=>syncGemDraw(owned.material,renderer,camera)}/>)}</group>;
}
export type FusionStatus={state:'loading'|'fused'|'fragmented'|'error';report?:BooleanReport;error?:string;retainingPreview?:boolean};
function JewelryObject({design,quality,studio,onSolidStatus}:{design:Design;quality:Quality;studio:StudioPresetId;onSolidStatus:(state:FusionStatus)=>void}){
 const d=constrainDesign(design),preset=STUDIO_PRESETS[studio];
 const modelKey=JSON.stringify(d);
 const [solid,setSolid]=useState<{key:string;design:Design;value:BooleanResult}|null>(null);
 const displayed=solid?.design??d;
 // Load supported cuts together before the first preview is declared ready.
 // Lazy-loading a new cut during an edit suspends the entire metal scene and
 // previously produced a blank canvas under an already-green CSG status.
 const gltf=useGLTF('/models/atelier/gems/round.glb');
 const ovalAsset=useGLTF('/models/atelier/gems/oval.glb');
 const rectangleAsset=useGLTF('/models/atelier/gems/rectangle.glb');
 const mainGltf=displayed.gemCut==='oval'?ovalAsset:displayed.gemCut==='rectangle'?rectangleAsset:gltf;
 const gem=useMemo(()=>{
   const source=firstMeshGeometry(gltf.scene);
   try{return prepareGirdleGem(source).geometry;}finally{source.dispose();}
 },[gltf.scene]);
 const mainGem=useMemo(()=>{
   const source=firstMeshGeometry(mainGltf.scene);
   try{return prepareGirdleGem(source).geometry;}finally{source.dispose();}
 },[mainGltf.scene]);

 useEffect(()=>{
   let cancelled=false;
   onSolidStatus({state:'loading',retainingPreview:Boolean(solid)});
   fuseDesign(d).then(value=>{
     if(cancelled){value.dispose();return;}
     setSolid({key:modelKey,design:d,value});
     onSolidStatus({state:value.report.status,report:value.report});
   }).catch(error=>{
     if(cancelled)return;
     const message=error instanceof Error?error.message:String(error);
     onSolidStatus({state:'error',error:message,retainingPreview:Boolean(solid)});
   });
   return ()=>{cancelled=true;};
 },[modelKey]);
 // Validation gates export, not visibility. A rejected candidate remains
 // inspectable, and a rebuild/error retains the last coherent full snapshot.
 const activeSolid=solid?.value??null;
 useEffect(()=>()=>solid?.value.dispose(),[solid]);
 const sites=useMemo(()=>buildStoneLayout(displayed),[displayed]);
 const draft=activeSolid?.report.status==='fragmented';
 const metal=useMemo(()=>{
   const value=createMetalMaterial(displayed.metal,preset);
   if(draft){value.color.set('#b88942');value.roughness=Math.max(value.roughness,.22);}
   return value;
 },[displayed.metal,preset,draft]);
 const accents=useMemo(()=>sites.filter(s=>s.kind==='accent'),[sites]);
 const mains=useMemo(()=>sites.filter(s=>s.kind==='main'),[sites]);

 useEffect(()=>()=>metal.dispose(),[metal]);

 useEffect(()=>()=>gem.dispose(),[gem]);
 useEffect(()=>()=>mainGem.dispose(),[mainGem]);
 const optics={environmentRotation:preset.rotation,environmentIntensity:preset.gemIntensity,dispersion:preset.dispersion};
 return <JewelryLighting preset={preset}>{environment=><group>
   {activeSolid&&<mesh name="manifold-fused-metal" geometry={activeSolid.geometry} material={metal} dispose={null}/>}
   {activeSolid&&accents.length>0&&(quality==='high'&&accents.length<=120?
    <OpticalAccentBatch geometry={gem} sites={accents} environment={environment} quality={quality} preset={preset}/>:
    <AccentInstances geometry={gem} sites={accents}/>)}
   {activeSolid&&mains.map(site=><OpticalGem key={site.id} geometry={mainGem}
      position={[site.x,site.y,site.z]} rotation={[0,0,-site.tilt]}
      scale={site.diameter/2} environment={environment} quality={quality} simplified={false} options={optics}/>)}
  </group>}</JewelryLighting>;
}
function Exposure({studio}:{studio:StudioPresetId}){
 const gl=useThree(s=>s.gl);const preset=STUDIO_PRESETS[studio];
 useEffect(()=>{gl.toneMappingExposure=preset.exposure;},[gl,preset]);
 return null;
}
export type StoneView='overall'|'top'|'side'|'macro';
function DesignCamera({view,ringRadius}:{view:StoneView;ringRadius:number}){
 const ref=useRef<OrbitControlsImpl>(null);
 const camera=useThree(s=>s.camera),invalidate=useThree(s=>s.invalidate);
 useEffect(()=>{
  const positions:Record<StoneView,[number,number,number]>={
   overall:[2.15,4.1,3.0],
   top:[0,5.0,.001],
   side:[2.65,ringRadius+.45,2.2],
   macro:[.95,ringRadius+1.5,1.22]
  };
  const targets:Record<StoneView,[number,number,number]>={
   overall:[0,ringRadius*.38,0],
   top:[0,ringRadius+.18,0],
   side:[0,ringRadius+.20,0],
   macro:[0,ringRadius+.25,0]
  };
  camera.position.set(...positions[view]);
  ref.current?.target.set(...targets[view]);
  ref.current?.update();
  invalidate();
 },[view,ringRadius,camera,invalidate]);
 return <OrbitControls ref={ref} target={[0,ringRadius*.38,0]} enablePan={false}
    minDistance={.6} maxDistance={7} minPolarAngle={.03} maxPolarAngle={Math.PI-.1}/>;
}
export function StoneFirstStage({design,quality,studio,view='overall',onFusionChange}:{design:Design;quality:Quality;studio:StudioPresetId;view?:StoneView;onFusionChange?:(status:FusionStatus)=>void}){
 const d=constrainDesign(design);
 const [fusion,setFusion]=useState<FusionStatus>({state:'loading'});
 useEffect(()=>onFusionChange?.(fusion),[fusion,onFusionChange]);
 return <div className="stone-first-canvas" aria-label="参数化珠宝三维预览" data-solid-status={fusion.state}>
  <Canvas dpr={[1,quality==='high'?2:1.5]} camera={{position:[2.15,4.1,3.0],fov:35,near:0.03,far:40}}
    gl={{antialias:true,alpha:true,powerPreference:'high-performance',preserveDrawingBuffer:true}}>
    <color attach="background" args={['#f5f3f0']}/>
    <ambientLight intensity={0.2}/><StudioFillLights/><Exposure studio={studio}/>
    <Suspense fallback={null}><JewelryObject {...{design:d,quality,studio}} onSolidStatus={setFusion}/></Suspense>
    <DesignCamera view={view} ringRadius={bandRadius(d)}/>
  </Canvas>
  <div className={'stone-fusion-status stone-fusion-'+fusion.state} role="status">
    {fusion.state==='loading'?(fusion.retainingPreview?'正在更新结构，保留上一版预览…':'正在生成金属结构与镶口…'):
     fusion.state==='error'?(fusion.retainingPreview?'更新失败，当前保留上一版模型。':'生成失败：')+fusion.error:
     fusion.state==='fragmented'?'待修复草稿：'+fusion.report?.connectedComponents+' 个金属部件。已保留预览，导出被阻止。':
     '已完成金属实体并集与镶口差集 · '+fusion.report?.triangles+' 面 · 生产工艺待验证'}
  </div>
 </div>;
}
