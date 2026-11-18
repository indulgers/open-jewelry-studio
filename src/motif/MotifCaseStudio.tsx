import {Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {Canvas, useLoader, useThree} from '@react-three/fiber';
import {Environment, OrbitControls} from '@react-three/drei';
import {
  Box3, CatmullRomCurve3, Color, ExtrudeGeometry, Group, InstancedMesh,
  Float32BufferAttribute, Mesh, MeshPhysicalMaterial, Object3D, Shape, TubeGeometry, Vector3,
  type WebGLRenderer,
} from 'three';
import {OBJLoader} from 'three/examples/jsm/loaders/OBJLoader.js';
import profiles from './profiles.json';
import {NecklaceAdapter,RingAdapter} from './WearableAdapters';
import {checkRingNominalClearance,ringSizing} from './wearableGeometry';
import {createNacreTextureSet} from './nacreMaterials';
import {createMineralTexture} from './mineralInlays';
import {createSmallBrilliantGeometry} from './brilliantGeometry';
import {metalAppearanceProps,DISPLAY_ALLOYS} from './metalMaterials';
import {comfortFitDiagnostics} from './comfortFitGeometry';
import {DesignedSurface,summarizeGemSetting} from './DesignedSurface';
import {PRESETS,TECHNIQUES,allowedTechniques,compatibleTechnique,settingPlan,
  normalizeMotifSize,minimumMotifSize,type Technique,type ShankStyle,type NecklaceMount,type DesignPreset} from './designGrammar';
import {PATTERNS, patternLayout, type PatternMode} from './patternLayout';
import {frameMotifModel} from './previewFrame';
import type {MetalFusionResult} from './motifMetalFusion';
import type {BufferGeometry} from 'three';
import './MotifCaseStudio.css';

type MotifId = keyof typeof profiles;
type Product = 'necklace' | 'ring';
type Metal = 'yellow' | 'rose' | 'silver';
type Inlay = 'pearl' | 'onyx' | 'malachite' | 'lapis' | 'carnelian';
type Edge = 'double' | 'smooth' | 'none';
type Part = 'all' | 'plate' | 'inlay' | 'edge' | 'adapter';
type View = 'angle' | 'front' | 'side' | 'fit' | 'detail';
type Shot = {view: View; sequence: number};
type Settings = {pattern:PatternMode;product:Product;motif:MotifId;metal:Metal;inlay:Inlay;edge:Edge;size:number;ringDiameter:number;centerStone:boolean;technique:Technique;shank:ShankStyle;necklaceMount:NecklaceMount;explode:number;part:Part};

const MOTIFS: {id:MotifId; name:string;source:string}[] = [
  {id:'clover',name:'四叶草',source:'四叶草.obj'},
  {id:'flower',name:'五瓣花',source:'花.obj'},
  {id:'blossom',name:'花苞',source:'花朵.obj'},
  {id:'butterfly',name:'蝴蝶',source:'蝴蝶.obj'},
  {id:'heart',name:'爱心',source:'爱心1.obj'},
  {id:'shell',name:'贝壳',source:'贝壳.obj'},
  {id:'feather',name:'孔雀羽毛',source:'孔雀羽毛.obj'},
];
const METALS: Record<Metal,{name:string;color:string}> = {
  yellow:{name:'18K 黄金色',color:DISPLAY_ALLOYS.yellow.base},
  rose:{name:'玫瑰金色',color:DISPLAY_ALLOYS.rose.base},
  silver:{name:'银白金属',color:DISPLAY_ALLOYS.silver.base},
};
const INLAYS: Record<Inlay,{name:string;color:string;roughness:number;metalness:number}> = {
  pearl:{name:'白色珍珠母贝',color:'#f3ece0',roughness:.24,metalness:.03},
  onyx:{name:'黑玛瑙效果',color:'#171d23',roughness:.16,metalness:.03},
  malachite:{name:'孔雀石效果',color:'#176a59',roughness:.25,metalness:.03},
  lapis:{name:'青金石效果',color:'#294f91',roughness:.24,metalness:.03},
  carnelian:{name:'红玉髓效果',color:'#9c261c',roughness:.20,metalness:.03},
};
const INIT:Settings = {pattern:'single',product:'necklace',motif:'clover',metal:'yellow',inlay:'pearl',edge:'double',size:15,ringDiameter:18,centerStone:true,technique:'inlay',shank:'classic',necklaceMount:'side',explode:0,part:'all'};
const PARTS:{id:Exclude<Part,'all'>;no:string;name:string;description:string}[] = [
  {id:'plate',no:'01',name:'金属底托',description:'轮廓匹配的基座与结构层'},
  {id:'inlay',no:'02',name:'主题镶面',description:'原 OBJ 嵌片 / 立体花瓣 / 密钉钻石'},
  {id:'edge',no:'03',name:'金珠包边',description:'独立环绕轮廓的珠粒与边线'},
  {id:'adapter',no:'04',name:'佩戴与连接结构',description:'交错链节 / 连续戒臂与两侧肩部'},
];
const base = import.meta.env.BASE_URL;
const assetPath=(id:MotifId)=>`${base}motif-lab/assets/${id}.obj`;
const showPart=(p:Part,id:Exclude<Part,'all'>)=>p==='all'||p===id;

// Normalized profile curves are extracted from the seven uploaded OBJ files, not a hand-drawn SVG.
function profilePath(id:MotifId){
  const shape=new Shape();
  const p=profiles[id].outline;
  if(p.length){shape.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)shape.lineTo(p[i][0],p[i][1]);shape.closePath();}
  return shape;
}
function outlineCurve(id:MotifId,factor=1,z=0){
  const p=profiles[id].outline;
  // The outline is in mm at its 15 mm reference size; scale is applied to the whole assembly.
  return new CatmullRomCurve3(p.map(([x,y])=>new Vector3(x*factor,y*factor,z)),true,'centripetal',.3);
}
function BeadLine({id,metal,factor,z,radius}:{id:MotifId;metal:string;factor:number;z:number;radius:number}){
  const ref=useRef<InstancedMesh>(null);
  const points=useMemo(()=>{
    const curve=outlineCurve(id,factor,z);
    const count=Math.max(12,Math.min(420,Math.round(curve.getLength()/(radius*1.86))));
    return Array.from({length:count},(_,i)=>curve.getPointAt(i/count));
  },[id,factor,z]);
  useLayoutEffect(()=>{
    if(!ref.current)return;
    const obj=new Object3D();
    points.forEach((p,i)=>{obj.position.copy(p);obj.updateMatrix();ref.current!.setMatrixAt(i,obj.matrix);});
    ref.current.instanceMatrix.needsUpdate=true;
    ref.current.computeBoundingBox();
    ref.current.computeBoundingSphere();
  },[points]);
  return <instancedMesh ref={ref} args={[undefined,undefined,points.length]} name="granulated-bezel" castShadow>
    <sphereGeometry args={[radius,14,11]}/><meshPhysicalMaterial {...metalAppearanceProps(metal,.18)}/>
  </instancedMesh>;
}
function Rim({id,color,edge}:{id:MotifId;color:string;edge:Edge}){
  const outer=useMemo(()=>new TubeGeometry(outlineCurve(id,.988,.50),280,.13,14,true),[id]);
  const inner=useMemo(()=>new TubeGeometry(outlineCurve(id,.938,.55),280,.09,12,true),[id]);
  useEffect(()=>()=>{outer.dispose();inner.dispose();},[outer,inner]);
  if(edge==='none')return null;
  return <group name="03-layered-beaded-edge">
    <mesh geometry={outer} castShadow><meshPhysicalMaterial {...metalAppearanceProps(color,.15)}/></mesh>
    {edge==='double'?<>
      <mesh geometry={inner} castShadow><meshPhysicalMaterial {...metalAppearanceProps(color,.17)}/></mesh>
      <BeadLine id={id} metal={color} factor={.985} z={.57} radius={.255}/>
      <BeadLine id={id} metal={color} factor={.936} z={.63} radius={.178}/>
      {id==='clover'&&[[-3.06,3.06],[3.06,3.06],[-3.06,-3.06],[3.06,-3.06]].map(([x,y],i)=><mesh key={i} position={[x,y,.67]} castShadow name="inlay-retaining-dot">
        <sphereGeometry args={[.31,14,10]}/><meshPhysicalMaterial {...metalAppearanceProps(color,.17)}/>
      </mesh>)}
    </>:null}
  </group>;
}
function Plate({id,color}:{id:MotifId;color:string}){
  const geometry=useMemo(()=>new ExtrudeGeometry(profilePath(id),{depth:.7,steps:1,bevelEnabled:true,bevelThickness:.15,bevelSize:.14,bevelSegments:4,curveSegments:10}),[id]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh name="01-metal-seat" geometry={geometry} position={[0,0,-.52]} castShadow receiveShadow>
    <meshPhysicalMaterial {...metalAppearanceProps(color,.16)}/>
  </mesh>;
}
/** Compact structural core for free-form petals, replacing the unsightly
 * silhouette-shaped slab. Still needs joint strength testing before casting. */
function FloralCoreBase({metal}:{metal:string}){
  return <group name="compact-mount-under-sculpted-petals">
    <mesh name="floral-center-support" position={[0,0,-.18]}
      rotation={[Math.PI/2,0,0]} castShadow receiveShadow>
      <cylinderGeometry args={[2.05,2.25,.72,48]}/>
      <meshPhysicalMaterial {...metalAppearanceProps(metal,.21)}/>
    </mesh>
    <mesh name="floral-rear-connector" position={[0,0,-.52]} castShadow>
      <sphereGeometry args={[.85,24,14]}/>
      <meshPhysicalMaterial {...metalAppearanceProps(metal,.21)}/>
    </mesh>
  </group>;
}
function InlayObject({id,appearance}:{id:MotifId;appearance:Inlay}){
  const original=useLoader(OBJLoader,assetPath(id));
  const finish=INLAYS[appearance];
  const nacreMaps=useMemo(()=>appearance==='pearl'?createNacreTextureSet(512):null,[appearance]);
  const mineralMap=useMemo(()=>appearance==='pearl'?null:createMineralTexture(appearance),[appearance]);
  const material=useMemo(()=>new MeshPhysicalMaterial({
    color:new Color('#ffffff'),
    map:nacreMaps?.albedo??mineralMap,
    bumpMap:nacreMaps?.bump??null,bumpScale:nacreMaps ? .075 : 0,
    roughnessMap:nacreMaps?.roughness??null,
    metalness:appearance==='pearl'?0:finish.metalness,roughness:nacreMaps?1:finish.roughness,
    clearcoat:appearance==='pearl'?.38:.7,clearcoatRoughness:appearance==='pearl'?.24:.12,
    iridescence:appearance==='pearl'?.19:0,
    iridescenceIOR:1.27,iridescenceThicknessRange:[165,275],
    envMapIntensity:1.35,side:2,
  }),[appearance,finish,nacreMaps,mineralMap]);
  const instance=useMemo(()=>{
    const clone=original.clone(true);
    const bounds=new Box3().setFromObject(original);
    const span=bounds.getSize(new Vector3());const center=bounds.getCenter(new Vector3());
    // The uploaded ZBrush OBJ files contain no vt UVs. Project XY coordinates
    // onto a clone, leaving useLoader's shared source geometry untouched.
    clone.traverse(child=>{if(child instanceof Mesh){
      const geometry=child.geometry.clone();
      const position=geometry.getAttribute('position');
      const uv=new Float32Array(position.count*2);
      for(let i=0;i<position.count;i++){
        uv[i*2]=(position.getX(i)-bounds.min.x)/Math.max(span.x,.001);
        uv[i*2+1]=(position.getY(i)-bounds.min.y)/Math.max(span.y,.001);
      }
      geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));
      child.geometry=geometry;
      child.material=material;child.castShadow=true;child.receiveShadow=true;
    }});
    const scale=15/Math.max(span.x,span.y);
    const inset=.927;
    clone.scale.set(scale*inset,scale*inset,.46/Math.max(.01,span.z));
    clone.position.set(-center.x*scale*inset,-center.y*scale*inset,.22-bounds.min.z*clone.scale.z);
    return clone;
  },[original,material]);
  useEffect(()=>()=>{material.dispose();nacreMaps?.dispose();mineralMap?.dispose();},[material,nacreMaps,mineralMap]);
  useEffect(()=>()=>instance.traverse(child=>{if(child instanceof Mesh)child.geometry.dispose();}),[instance]);
  return <group name="02-inlay"><primitive object={instance}/></group>;
}
/** Separate brilliant-inspired cut and minimal retaining prongs, not manufacturing prong data. */
function CenterStone({metal}:{metal:string}){
  const diamond=useMemo(()=>createSmallBrilliantGeometry(16),[]);
  useEffect(()=>()=>diamond.dispose(),[diamond]);
  return <group name="center-diamond-and-retaining-prongs">
    <mesh name="small-faceted-center-stone" geometry={diamond} castShadow>
      <meshPhysicalMaterial vertexColors color="#ffffff" metalness={0} roughness={.045}
        transmission={.53} dispersion={.055} thickness={.68} ior={2.333}
        clearcoat={.85} clearcoatRoughness={.025} envMapIntensity={2.2} flatShading/>
    </mesh>
    <mesh name="center-stone-metal-seat" position={[0,0,.74]} castShadow>
      <torusGeometry args={[.97,.105,16,48]}/>
      <meshPhysicalMaterial {...metalAppearanceProps(metal,.14)}/>
    </mesh>
    {[[1,0],[-1,0],[0,1],[0,-1]].map(([x,y],i)=><group key={i} name={'stone-prong-'+i}>
      <mesh name="central-prong-post" position={[x*.91,y*.91,.91]} rotation={[Math.PI/2,0,0]} castShadow>
        <cylinderGeometry args={[.10,.145,.38,12]}/>
        <meshPhysicalMaterial {...metalAppearanceProps(metal,.15)}/>
      </mesh>
      <mesh name="central-prong-tip" position={[x*.86,y*.86,1.11]} castShadow>
        <sphereGeometry args={[.17,14,12]}/>
        <meshPhysicalMaterial {...metalAppearanceProps(metal,.15)}/>
      </mesh>
    </group>)}
  </group>;
}
function Assembly({config,rootRef,onReady,fusedMetal}:{config:Settings;rootRef:React.RefObject<Group|null>;onReady:(ready:boolean)=>void;fusedMetal:BufferGeometry|null}){
  const color=METALS[config.metal].color;
  const scale=config.size/15;
  const layout=useMemo(()=>patternLayout(config.motif,config.pattern),[config.motif,config.pattern]);
  const ring=config.product==='ring';
  const mountHeight=ring?ringSizing(config.ringDiameter).motifSeatY:0;
  useEffect(()=>{onReady(true);return()=>onReady(false);},[config.motif,onReady]);
  return <group ref={rootRef} name="xiangyan-motif-assembly">
    {/* The ring seat rotates 90 degrees to face away from the finger hole. */}
    <group name="01-03-face-and-setting" scale={[scale,scale,scale]} position={[0,mountHeight,0]}
      rotation={ring?[-Math.PI/2,0,0]:[0,0,0]}>
      {showPart(config.part,'plate')&&layout.bridgeHalfWidth>0&&
        <mesh name="paired-motif-bridge" position={[0,0,-.4-config.explode*2.3]} rotation={[0,0,Math.PI/2]} castShadow>
          <capsuleGeometry args={[.36,2*layout.bridgeHalfWidth,8,16]}/>
          <meshPhysicalMaterial {...metalAppearanceProps(color,.22)}/>
        </mesh>}
      {layout.copies.map((matrix,index)=><group key={index} name={'pattern-motif-'+(index+1)} matrix={matrix} matrixAutoUpdate={false}>
      {showPart(config.part,'plate')&&<group position-z={-config.explode*2.3}>
        {(config.motif==='flower'||config.motif==='blossom')&&
          (config.technique==='sculpted'||config.technique==='pave'||config.technique==='cluster')
          ?<FloralCoreBase metal={color}/>
          :<Plate id={config.motif} color={color}/>}
      </group>}
      {showPart(config.part,'inlay')&&<group position-z={config.explode*1.6}>
        {config.technique==='inlay'
          ?<InlayObject id={config.motif} appearance={config.inlay}/>
          :<DesignedSurface motif={config.motif} technique={config.technique} metal={color} centerStone={config.centerStone}/>}
        {config.centerStone&&config.technique!=='cluster'&&<CenterStone metal={color}/>}
      </group>}
      {showPart(config.part,'edge')&&<group position-z={config.explode*.65}><Rim id={config.motif} color={color} edge={config.edge}/></group>}
      </group>)}
    </group>
    {showPart(config.part,'adapter')&&(ring
      ?<RingAdapter color={color} diameter={config.ringDiameter} explode={config.explode} shank={config.shank} fusedGeometry={config.shank==='classic'?fusedMetal:null}/>
      :<NecklaceAdapter layout={layout} color={color} motif={config.motif} scale={scale} explode={config.explode} mount={config.necklaceMount}/>)}
  </group>;
}
function ViewRig({shot,config,rootRef}:{shot:Shot;config:Settings;rootRef:React.RefObject<Group|null>}){
  const {camera,size}=useThree();
  const controls=useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const previous=useRef<{shot:Shot;product:Product;zoom:number}|null>(null);
  useEffect(()=>{
    const orbit=controls.current;
    const root=rootRef.current;
    if(!root||!orbit)return;
    const ring=config.product==='ring';
    const changedShot=previous.current?.shot!==shot||previous.current?.product!==config.product;
    const directions:Record<View,[number,number,number]>=ring?{
      angle:[26,38,15],front:[0,45,1],side:[3,2,42],fit:[45,0,0],detail:[1,12,3],
    }:{angle:[14,6,35],front:[0,0,1],side:[40,2,8],fit:[0,0,1],detail:[4,5,26]};
    const direction=changedShot ? new Vector3(...directions[shot.view]).normalize()
      : camera.position.clone().sub(orbit.target).normalize();
    const face=root.getObjectByName('01-03-face-and-setting');
    const subject=shot.view==='detail'&&config.part!=='adapter'&&face ? face : root;
    const frame=frameMotifModel(subject,direction,size.width,size.height);
    if(!frame)return;
    const zoomRatio=changedShot||!previous.current ? 1 : camera.zoom/previous.current.zoom;
    orbit.minZoom=frame.zoom*.45;
    orbit.maxZoom=frame.zoom*5;
    camera.zoom=Math.min(orbit.maxZoom,Math.max(orbit.minZoom,frame.zoom*zoomRatio));
    camera.position.copy(frame.target).addScaledVector(direction,82);
    orbit.target.copy(frame.target);
    camera.lookAt(frame.target);
    camera.updateProjectionMatrix();
    orbit.update();
    previous.current={shot,product:config.product,zoom:frame.zoom};
  },[shot,camera,size.width,size.height,rootRef,config.product,config.motif,config.technique,config.size,
    config.ringDiameter,config.part,config.explode,config.pattern,config.necklaceMount,config.shank,config.edge,config.centerStone]);
  return <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping={false}/>;
}
function ModelPreview({config,shot,rootRef,rendererRef,ready,fusedMetal}:{config:Settings;shot:Shot;rootRef:React.RefObject<Group|null>;rendererRef:React.RefObject<WebGLRenderer|null>;ready:(r:boolean)=>void;fusedMetal:BufferGeometry|null}){
  return <Canvas orthographic dpr={[1,2]} shadows frameloop="demand" camera={{position:[14,17,34],zoom:18,near:.1,far:180}} gl={{alpha:true,antialias:true,preserveDrawingBuffer:true}}
    onCreated={({gl})=>{rendererRef.current=gl;}}>
    <Environment files={`${base}environments/catalog-studio.hdr`} background={false}/>
    <ambientLight intensity={.52}/>
    <hemisphereLight args={['#fff9ee','#b4ac9f',.85]}/>
    <directionalLight position={[-8,16,17]} intensity={2.3} color="#fff5df" castShadow shadow-mapSize={[1024,1024]}/>
    <directionalLight position={[8,7,-7]} intensity={1.65} color="#dbe6ff"/>
    <directionalLight position={[0,-8,15]} intensity={.65} color="#fff7e9"/>
    <Suspense fallback={null}>
      <Assembly key={config.motif} config={config} rootRef={rootRef} onReady={ready} fusedMetal={fusedMetal}/>
      <ViewRig shot={shot} config={config} rootRef={rootRef}/>
    </Suspense>
  </Canvas>;
}
function MotifThumbnail({id}:{id:MotifId}){
  const points=profiles[id].outline.map(([x,y])=>`${(x+8)*5.5},${(8-y)*5.5}`).join(' ');
  return <svg className="motif-thumb" viewBox="0 0 88 88" aria-hidden="true"><polygon points={points}/></svg>;
}
function download(data:Blob,filename:string){const url=URL.createObjectURL(data);const a=document.createElement('a');a.href=url;a.download=filename;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1500);}
const label=(id:MotifId)=>MOTIFS.find(m=>m.id===id)?.name??id;

export function MotifCaseStudio(){
  const [config,setConfig]=useState<Settings>(INIT);
  const [shot,setShot]=useState<Shot>({view:'angle',sequence:0});
  const setView=(view:View)=>setShot(old=>({view,sequence:old.sequence+1}));
  const [ready,setReady]=useState(false);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const [fusion,setFusion]=useState<{diameter:number;result:MetalFusionResult}|null>(null);
  useEffect(()=>()=>fusion?.result.dispose(),[fusion]);
  const rootRef=useRef<Group>(null);
  const rendererRef=useRef<WebGLRenderer>(null);
  const update=<K extends keyof Settings>(key:K,value:Settings[K])=>setConfig(old=>({...old,[key]:value}));
  const chooseMotif=(motif:MotifId)=>{
    setConfig(old=>{
      const technique=compatibleTechnique(motif,old.technique);
      return {...old,motif,technique,size:normalizeMotifSize(technique,old.size),edge:technique==='inlay'&&old.edge==='none'?'double':old.edge};
    });if(config.motif!==motif)setReady(false);
  };
  const chooseTechnique=(technique:Technique)=>{
    if(!allowedTechniques(config.motif).includes(technique))return;
    setConfig(old=>({...old,part:old.part==='edge'?'all':old.part,technique,size:normalizeMotifSize(technique,old.size),edge:technique==='inlay'||technique==='guilloche'?'double':'none'}));
    setStatus('');
  };
  const choosePreset=(preset:DesignPreset)=>{
    setConfig(old=>({...old,pattern:'single',product:preset.product,motif:preset.motif,technique:preset.technique,
      metal:preset.metal,inlay:preset.inlay,edge:preset.edge,shank:preset.shank,
      necklaceMount:preset.necklaceMount,centerStone:preset.centerStone,size:normalizeMotifSize(preset.technique,old.size),explode:0,part:'all'}));
    setView('angle');if(config.motif!==preset.motif)setReady(false);
    setStatus('已应用原创构型方案：'+preset.name);
  };
  const screenMetal=async()=>{
    if(config.product!=='ring'||busy)return;
    if(config.shank!=='classic'){setStatus('目前仅“经典素圈”完成 Manifold 初筛。分叉戒臂和侧石戒臂需要专用金属布尔与镶座校验。');return;}
    setBusy(true);setStatus('正在进行封闭金属实体布尔并集与连通性检查…');
    try{
      const {fuseWearableRing}=await import('./motifMetalFusion');
      const result=await fuseWearableRing(config.ringDiameter);
      if(result.report.status==='fused'&&result.report.closedTriangleSurface&&result.report.fingerAxisClear){
        setFusion({diameter:config.ringDiameter,result});
        setStatus('金属布尔初筛通过：'+result.report.connectedComponents+' 个连通体，'+result.report.triangles+' 个三角面。仍非制造认证。');
      }else{
        result.dispose();
        setStatus('金属布尔初筛未通过：'+result.report.warnings.join('；'));
      }
    }catch(error){
      setStatus('金属布尔初筛失败：'+(error instanceof Error?error.message:String(error)));
    }finally{setBusy(false);}
  };
  const layout=useMemo(()=>patternLayout(config.motif,config.pattern),[config.motif,config.pattern]);
  const setting=summarizeGemSetting(config.motif,config.technique,config.centerStone);
  const accentStoneCount=setting.modeledAccentStones*layout.copies.length;
  const activeParts=PARTS.filter(part=>part.id!=='edge'||config.edge!=='none');
  const downloadRecipe=()=>{
    const recipe={schema:'xiangyan.design-grammar/0.2',reference:'Structural jewelry research; independent original design recipes',
      units:'mm',settings:config,source:profiles[config.motif].src,
      pattern:{mode:config.pattern,copies:layout.copies.map(matrix=>matrix.toArray())},
      parts:activeParts.map(p=>({code:p.no,name:p.name,independent:true})),
      productionStatus:'VISUAL_PROTOTYPE_ONLY',ring:config.product==='ring'?ringSizing(config.ringDiameter):null,
      geometryScreening:config.product==='ring'?comfortFitDiagnostics(config.ringDiameter):null,
      gemstoneSetting:{...setting,perMotif:setting,modeledAccentStones:accentStoneCount,additionalCenterStones:config.centerStone&&config.technique!=='cluster'?layout.copies.length:0},
      metalFusion:config.product==='ring'&&config.shank==='classic'&&fusion?.diameter===config.ringDiameter?fusion.result.report:null,
      chain:config.product==='necklace'?{referenceLengthCm:42,mount:config.necklaceMount,representation:'visible articulated segment only'}:null,
      notes:['OBJ source is unitless and normalized to 15 mm by visual span','The shank has a continuous geometric bore, but fit and manufacture have not been certified','Manufacturing validation is technique-specific; painted or pavé stone seats are not certified']};
    download(new Blob([JSON.stringify(recipe,null,2)],{type:'application/json'}),'xiangyan-motif-recipe.json');setStatus('已导出参数化设计记录');
  };
  const exportGlb=async()=>{
    if(!ready||!rootRef.current)return;
    setBusy(true);setStatus('正在封装三维装配…');
    try{
      const {GLTFExporter}=await import('three/examples/jsm/exporters/GLTFExporter.js');
      const exporter=new GLTFExporter();
      const result=await exporter.parseAsync(rootRef.current,{binary:true,onlyVisible:true});
      if(!(result instanceof ArrayBuffer))throw new Error('GLB 导出失败');
      download(new Blob([result],{type:'model/gltf-binary'}),'xiangyan-motif-visual.glb');
      setStatus('已导出可视化 GLB；不是生产 CAD');
    }catch(e){setStatus(`导出失败：${e instanceof Error?e.message:'未知错误'}`);}
    finally{setBusy(false);}
  };
  const exportPng=()=>{
    if(!rendererRef.current)return;
    rendererRef.current.domElement.toBlob(blob=>{if(blob){download(blob,'xiangyan-motif-preview.png');setStatus('已导出当前视角 PNG');}},'image/png');
  };
  return <div className="motif-lab">
    <div className="motif-lab-heading">
      <div><h1>模组设计工坊</h1>
        <p className="motif-heading-sub">6 组工艺构型灵感 · 7 种源模组 · 镶嵌 × 戒臂 × 项链连接 · 实时 3D</p></div>
      <span className="motif-build-tag">实验工作区</span>
    </div>
    <div className="motif-workspace">
      <aside className="motif-controls" aria-label="DIY 配置面板">
        <div className="motif-section-caption"><span>01</span> 选择产品</div>
        <div className="motif-product-toggle" role="group" aria-label="产品类型">
          <button type="button" aria-pressed={config.product==='necklace'} onClick={()=>{update('product','necklace');setView('angle')}}>◌ <span>项链</span></button>
          <button type="button" aria-pressed={config.product==='ring'} onClick={()=>{update('product','ring');setView('angle')}}>◎ <span>戒指</span></button>
        </div>
        <div className="motif-section-caption"><span>02</span> 选择造型 <small>源自上传 OBJ</small></div>
        <div className="motif-choices">{MOTIFS.map(m=><button key={m.id} type="button" aria-pressed={config.motif===m.id}
          onClick={()=>chooseMotif(m.id)}><MotifThumbnail id={m.id}/><span>{m.name}</span></button>)}</div>
        <p className="motif-label">图样排列</p>
        <div className="motif-edge-row" role="group" aria-label="图样排列">
          {(Object.keys(PATTERNS) as PatternMode[]).map(mode=><button key={mode} type="button" aria-pressed={config.pattern===mode}
            onClick={()=>update('pattern',mode)}>{PATTERNS[mode]}</button>)}
        </div>
        {config.pattern!=='single'&&<p className="motif-technique-caption">{config.pattern==='axis'?'两枚主题以中线左右镜像。':'两枚主题围绕中点相差 180°。'}尺寸参数对应单枚主题。</p>}
        <div className="motif-section-caption"><span>03</span> 艺术构型 <small>基于首饰结构研究</small></div>
        <div className="motif-techniques" role="group" aria-label="工艺构型">
          {(Object.keys(TECHNIQUES) as Technique[]).map(t=>{
            const permitted=allowedTechniques(config.motif).includes(t);
            return <button key={t} type="button" disabled={!permitted} aria-pressed={config.technique===t}
              title={!permitted?'此造型不适合该构型':TECHNIQUES[t].description}
              onClick={()=>chooseTechnique(t)}>
                <strong>{TECHNIQUES[t].name}</strong><small>{permitted?TECHNIQUES[t].description:TECHNIQUES[t].requires}</small>
              </button>;
          })}
        </div>
        <p className="motif-technique-caption">{TECHNIQUES[config.technique].description}。不同工艺会生成不同的真实三维组件。</p>
        <div className="motif-section-caption"><span>04</span> 六组组合灵感 <small>点击应用完整方案</small></div>
        <div className="motif-preset-grid">{PRESETS.map(p=><button key={p.id} type="button" className="motif-preset-card"
          aria-pressed={config.pattern==='single'&&config.product===p.product&&config.motif===p.motif&&config.technique===p.technique
            &&config.inlay===p.inlay&&config.metal===p.metal&&config.edge===p.edge&&config.centerStone===p.centerStone
            &&(config.product==='ring'?config.shank===p.shank:config.necklaceMount===p.necklaceMount)}
          onClick={()=>choosePreset(p)}>
            <span className={'motif-preset-icon motif-preset-'+p.id} aria-hidden="true">
              <MotifThumbnail id={p.motif}/></span>
            <strong>{p.name}</strong><small>{p.short}</small>
          </button>)}</div>
        <div className="motif-section-caption"><span>05</span> 材料与边框</div>
        <p className="motif-label">金属外观 <span>{METALS[config.metal].name}</span></p>
        <div className="motif-color-row" role="group" aria-label="金属外观">{(Object.keys(METALS) as Metal[]).map(k=><button key={k} title={METALS[k].name} type="button" aria-label={METALS[k].name} aria-pressed={config.metal===k}
          onClick={()=>update('metal',k)}><span style={{background:METALS[k].color}}/></button>)}</div>
        {config.technique==='inlay'&&<>
          <p className="motif-label">嵌片材质 <span>{INLAYS[config.inlay].name}</span></p>
          <div className="motif-inlay-options">{(Object.keys(INLAYS) as Inlay[]).map(k=><button key={k} type="button"
            aria-pressed={config.inlay===k} onClick={()=>update('inlay',k)}>
            <span style={{background:INLAYS[k].color}}/>{INLAYS[k].name}</button>)}</div>
        </>}
        {config.technique!=='cluster'&&<label className="motif-center-toggle"><input type="checkbox" checked={config.centerStone} onChange={e=>update('centerStone',e.target.checked)}/>
          <span>中央小钻 <small>独立爪镶视觉结构，可关闭</small></span></label>}
        <p className="motif-label">主题边框 <span>依工艺选择</span></p>
        <div className="motif-edge-row" role="group" aria-label="包边样式">
          {([['double','双排金珠'],['smooth','光面包边'],['none','不加包边']] as const).map(([k,v])=><button type="button" key={k} aria-pressed={config.edge===k} disabled={config.technique==='inlay'&&k==='none'}
            onClick={()=>setConfig(old=>({...old,edge:k,part:k==='none'&&old.part==='edge'?'all':old.part}))}>{v}</button>)}
        </div>
        <div className="motif-section-caption"><span>06</span> 佩戴结构</div>
        {config.product==='ring'
          ?<div className="motif-wear-styles" role="group" aria-label="戒臂构型">{([
              ['classic','经典素圈','连续舒适型戒臂'],['split','分叉肩位','双层金属曲线'],['pave','戒臂侧石','两侧小钻镶座']
            ] as const).map(([id,name,note])=><button key={id} type="button" aria-pressed={config.shank===id}
              onClick={()=>update('shank',id)}><strong>{name}</strong><small>{note}</small></button>)}</div>
          :<div className="motif-wear-styles" role="group" aria-label="项链连接方式">{([
              ['side','双侧连接','两侧链环固定'],['bail','顶部吊环','单点顶部挂耳']
            ] as const).map(([id,name,note])=><button key={id} type="button" aria-pressed={config.necklaceMount===id}
              onClick={()=>update('necklaceMount',id)}><strong>{name}</strong><small>{note}</small></button>)}</div>}
        <div className="motif-section-caption"><span>07</span> 尺寸参数</div>
        <label className="motif-range-label">主题直径 <strong>{config.size} mm</strong><input type="range"
          min={minimumMotifSize(config.technique)} max="20" step="1" value={config.size}
          onChange={e=>update('size',normalizeMotifSize(config.technique,Number(e.target.value)))}/></label>
        {(config.technique==='pave'||config.technique==='cluster')&&<p className="motif-technique-caption">
          密钉与群镶采用固定视觉石径；当前限制主题最小 15 mm，以保持设计阶段的金属边距。
        </p>}
        {config.product==='ring'&&<label className="motif-range-label">戒指内径（名义） <strong>{config.ringDiameter} mm</strong><input type="range" min="16" max="21" step=".5" value={config.ringDiameter} onChange={e=>update('ringDiameter',Number(e.target.value))}/></label>}
        <div className="motif-wear-check" role="status">
          <strong>{config.product==='ring'?'贯通指孔 · '+({classic:'经典素圈',split:'分叉肩位',pave:'戒臂侧石'}[config.shank]):'交错椭圆链节 · '+(config.necklaceMount==='side'?'双侧':'顶部')+'连接'}</strong>
          <p>{config.product==='ring'
            ?'内径 '+config.ringDiameter+' mm，保守几何孔径下限 '+checkRingNominalClearance(config.ringDiameter).conservativeMinimum.toFixed(2)+' mm。可在「指孔」视角检查；尚未做实际佩戴与生产公差认证。'
            :'可辨认的独立链节通过'+(config.necklaceMount==='side'?'两侧连接环':'顶部吊环')+'进入主题模组。画面只展示链条局部。'}</p>
        </div>
      </aside>
      <main className="motif-visual" aria-label="实时三维结构预览">
        <div className="motif-preview-title">
          <h2>{label(config.motif)} <em>·</em> {config.product==='necklace'?'悬挂项链':'镶饰戒指'}</h2>
          <p>{TECHNIQUES[config.technique].name} / {config.product==='ring'?({classic:'经典素圈',split:'分叉肩位',pave:'戒臂侧石'}[config.shank]):config.necklaceMount==='side'?'双侧链环':'顶部吊环'} · {PATTERNS[config.pattern]}</p></div>
        <div className="motif-model-surface"><ModelPreview config={config} shot={shot} rootRef={rootRef} rendererRef={rendererRef} ready={setReady}
          fusedMetal={config.shank==='classic'&&fusion?.diameter===config.ringDiameter?fusion.result.geometry:null}/></div>
        {!ready&&<p className="motif-loader" role="status">正在装配 3D 模组…</p>}
        <div className="motif-view-tools" role="group" aria-label="三维视角">
          {([['angle','45°'],['front','正面'],['side','侧面'],['detail','近看'],...(config.product==='ring'?[['fit','指孔'] as const]:[])] as const).map(([k,v])=><button type="button" key={k} aria-pressed={shot.view===k} onClick={()=>setView(k)}>{v}</button>)}
        </div>
        <div className="motif-visual-status"><span className="motif-live-dot"/>拖动旋转，双指或滚轮缩放 <span>·</span> 正交 <span>·</span> {config.product==='ring'?'贯通指孔':config.necklaceMount==='bail'?'顶部吊环':'双侧连接环'}</div>
      </main>
      <aside className="motif-anatomy" aria-label="结构拆解与输出">
        <div className="motif-anatomy-head"><h2>结构拆解</h2><p>点击一个零件单独查看它与整体的关系。</p></div>
        <div className="motif-setting-spec">
          <strong>{TECHNIQUES[config.technique].name}</strong>
          <span>{config.technique==='pave'||config.technique==='cluster'
            ?'视觉布石 '+accentStoneCount+' 颗 · 独立镶座与小爪'
            :config.technique==='sculpted'?(5*layout.copies.length)+' 片立体花瓣'+(config.centerStone?' · 中心爪镶':'')
            :config.technique==='guilloche'?'沿原始轮廓收束的放射状金属纹'
            :'原始 OBJ 嵌片 · 独立底托与包边'}</span>
          <small>装配与镶爪尺寸为视觉研究，不可直接送厂</small>
        </div>
        <button className="motif-all-parts" aria-pressed={config.part==='all'} type="button" onClick={()=>update('part','all')}>完整装配 <span>ALL PARTS ↗</span></button>
        <div className="motif-part-list">{activeParts.map(p=><button type="button" key={p.id} aria-pressed={config.part===p.id} onClick={()=>update('part',config.part===p.id?'all':p.id)}>
          <span className="motif-part-no">{p.no}</span><span><strong>{p.name}</strong><small>{p.id==='adapter'?(config.product==='necklace'?(config.necklaceMount==='bail'?'独立椭圆链节与顶部吊环':'独立椭圆链节与双侧连接环'):'贯通指孔、舒适戒臂与双侧肩部'):p.description}</small></span><span className="motif-part-arrow">↗</span>
        </button>)}</div>
        <div className="motif-explode"><div className="motif-explode-label"><span>爆炸视图</span><b>{Math.round(config.explode*100)}%</b></div>
          <input aria-label="结构爆炸程度" type="range" min="0" max="1.5" step=".05" value={config.explode} onChange={e=>update('explode',Number(e.target.value))}/>
          <p>沿镶面法向分离嵌片、边框与底托</p></div>
        {config.product==='ring'&&<div className="motif-fusion-panel" aria-label="金属实体初筛">
          <div className="motif-fusion-title"><strong>金属实体检查</strong><span>MANIFOLD / PRECHECK</span></div>
          <p>检查戒臂、两侧肩部和底部支撑能否融合为单个闭合金属实体。嵌片和宝石仍独立。</p>
          <button type="button" disabled={busy||!ready||config.shank!=='classic'} onClick={screenMetal}>
            {busy?'检查中…':config.shank!=='classic'?'此戒臂尚无独立布尔规则':fusion?.diameter===config.ringDiameter?'重新检查金属连接':'运行布尔融合初筛'}
          </button>
          {config.shank==='classic'&&fusion?.diameter===config.ringDiameter&&<div className="motif-fusion-metrics">
            <span>金属连通实体 <strong>{fusion.result.report.connectedComponents}</strong></span>
            <span>指孔贯通 <strong>{fusion.result.report.fingerAxisClear?'是':'否'}</strong></span>
            <span>戒臂最小径向壁厚 <strong>{fusion.result.report.radialWallMinimumMm.toFixed(2)} mm*</strong></span>
          </div>}
          <small>{config.shank!=='classic'?'分叉及侧石戒臂目前仅是独立可视模型，尚未进行此构型的完整布尔验证。':fusion?.diameter===config.ringDiameter?'*壁厚为素圈的解析值，不代表全部接点和镶座。仍未通过制造认证。':'结果会列出连通体数量；失败时不会伪装成功'}</small>
        </div>}
        <div className="motif-export-panel"><h3>保存这次设计</h3><button className="motif-main-download" type="button" disabled={!ready||busy} onClick={exportGlb}>{busy?'导出中…':'导出 3D GLB'} <span>↗</span></button>
          <div className="motif-secondary-downloads"><button type="button" onClick={downloadRecipe}>配置 JSON</button><button type="button" onClick={exportPng} disabled={!ready}>当前截图 PNG</button></div>
          <p className="motif-status" role="status">{status}</p></div>
        <div className="motif-disclaimer">工程边界：本案例用于结构与外观评审，不代表梵克雅宝官方 CAD。新构型来自公开珠宝工艺的结构抽象，并非品牌复刻 CAD。彩石固定、密钉座深、分叉戒臂与侧石的整体连通性仍需工厂验证；导出只作为设计预览。</div>
      </aside>
    </div>
  </div>;
}
export default MotifCaseStudio;
