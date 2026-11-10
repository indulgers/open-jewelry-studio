import {Suspense,useEffect,useMemo,useRef} from 'react';
import {Canvas,useThree} from '@react-three/fiber';
import {OrbitControls,useGLTF} from '@react-three/drei';
import {Euler,InstancedMesh,Matrix4,MeshPhysicalMaterial,Quaternion,Vector3,type BufferGeometry} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {firstMeshGeometry,normalizeLooseGem} from '../geometry/productGeometry';
import {JewelryLighting} from '../viewer/JewelryLighting';
import {StudioFillLights} from '../viewer/StudioFillLights';
import {createMetalMaterial} from '../viewer/materials';
import {OpticalGem} from '../viewer/OpticalGem';
import {STUDIO_PRESETS,type StudioPresetId} from '../viewer/studioPresets';
import {bandRadius,buildStoneLayout,constrainDesign,type Design,type Site} from './recipe';
import {createAssembly,metalSetting} from './geometry';
import type {Quality} from '../viewer/quality';

function JewelryObject({design,quality,studio}:{design:Design;quality:Quality;studio:StudioPresetId}){
 const d=constrainDesign(design),preset=STUDIO_PRESETS[studio];
 const gltf=useGLTF('/models/atelier/gems/round.glb');
 const gem=useMemo(()=>{
   const source=firstMeshGeometry(gltf.scene);
   try{return normalizeLooseGem(source);}finally{source.dispose();}
 },[gltf.scene]);
 const assembly=useMemo(()=>createAssembly(d),[JSON.stringify(d)]);
 const sites=useMemo(()=>buildStoneLayout(d),[JSON.stringify(d)]);
 const metal=useMemo(()=>createMetalMaterial(d.metal,preset),[d.metal,preset]);
 const accents=sites.filter(s=>s.kind==='accent');
 const mains=sites.filter(s=>s.kind==='main');
 const mergedSeats=useMemo(()=>{
  const geometries:BufferGeometry[]=[];
  try{
   for(const site of sites){
    const parts=metalSetting(d,site);
    const rotation=new Matrix4().makeRotationZ(-site.tilt);
    const offset=new Matrix4().makeTranslation(site.x,site.y,site.z);
    const transform=offset.multiply(rotation);
    for(const part of parts){part.geometry.applyMatrix4(transform);geometries.push(part.geometry);}
   }
   return geometries.length?mergeGeometries(geometries,false):null;
  }finally{geometries.forEach(g=>g.dispose());}
 },[JSON.stringify(sites),d.mount]);
 const instances=useRef<InstancedMesh>(null);
 useEffect(()=>{
  const mesh=instances.current;
  if(!mesh)return;
  const rotation=new Quaternion(),scale=new Vector3(),position=new Vector3(),m=new Matrix4();
  for(let i=0;i<accents.length;i++){
   const site=accents[i];
   position.set(site.x,site.y,site.z);
   rotation.setFromEuler(new Euler(0,0,-site.tilt));
   scale.setScalar(site.diameter/2);
   m.compose(position,rotation,scale);
   mesh.setMatrixAt(i,m);
  }
  mesh.instanceMatrix.needsUpdate=true;
 },[JSON.stringify(accents),gem]);
 useEffect(()=>()=>assembly.dispose(),[assembly]);
 useEffect(()=>()=>metal.dispose(),[metal]);
 useEffect(()=>()=>mergedSeats?.dispose(),[mergedSeats]);
 useEffect(()=>()=>gem.dispose(),[gem]);
 const optics={environmentRotation:preset.rotation,environmentIntensity:preset.gemIntensity,dispersion:preset.dispersion};
 return <JewelryLighting preset={preset}>{environment=><group>
   {assembly.parts.map((part,i)=><mesh key={part.name+'-'+i} geometry={part.geometry} material={metal} dispose={null}/>)}
   {mergedSeats&&<mesh geometry={mergedSeats} material={metal} dispose={null}/>}
   {accents.length>0&&<instancedMesh ref={instances} args={[gem,undefined,accents.length]} dispose={null} frustumCulled={false}>
     <meshPhysicalMaterial color="#f6f8fc" metalness={0} roughness={0.015} transmission={0.93} thickness={0.5} ior={2.42} envMapIntensity={2.1}/>
   </instancedMesh>}
   {mains.map(site=><OpticalGem key={site.id} geometry={gem}
      position={[site.x,site.y,site.z]} rotation={[0,0,-site.tilt]}
      scale={site.diameter/2} environment={environment} quality={quality} simplified={false} options={optics}/>)}
  </group>}</JewelryLighting>;
}
function Exposure({studio}:{studio:StudioPresetId}){
 const gl=useThree(s=>s.gl);const preset=STUDIO_PRESETS[studio];
 useEffect(()=>{gl.toneMappingExposure=preset.exposure;},[gl,preset]);
 return null;
}
export function StoneFirstStage({design,quality,studio}:{design:Design;quality:Quality;studio:StudioPresetId}){
 const d=constrainDesign(design);
 return <div className="stone-first-canvas" aria-label="参数化珠宝三维预览">
  <Canvas dpr={[1,quality==='high'?2:1.5]} camera={{position:[2.2,2.45,3.3],fov:36,near:0.03,far:40}}
    gl={{antialias:true,alpha:true,powerPreference:'high-performance',preserveDrawingBuffer:true}}>
    <color attach="background" args={['#f5f3f0']}/>
    <ambientLight intensity={0.2}/><StudioFillLights/><Exposure studio={studio}/>
    <Suspense fallback={null}><JewelryObject {...{design:d,quality,studio}}/></Suspense>
    <OrbitControls target={[0,bandRadius(d)*.38,0]} enablePan={false} minDistance={1.3} maxDistance={7}
      minPolarAngle={.03} maxPolarAngle={Math.PI-.1}/>
  </Canvas>
 </div>;
}
