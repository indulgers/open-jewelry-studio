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
import {createSmallBrilliantGeometry} from './brilliantGeometry';
import {metalAppearanceProps,DISPLAY_ALLOYS} from './metalMaterials';
import {comfortFitDiagnostics} from './comfortFitGeometry';
import './MotifCaseStudio.css';

type MotifId = keyof typeof profiles;
type Product = 'necklace' | 'ring';
type Metal = 'yellow' | 'rose' | 'silver';
type Inlay = 'pearl' | 'onyx' | 'malachite' | 'lapis';
type Edge = 'double' | 'smooth' | 'none';
type Part = 'all' | 'plate' | 'inlay' | 'edge' | 'adapter';
type View = 'angle' | 'front' | 'side' | 'fit';
type Settings = {product:Product;motif:MotifId;metal:Metal;inlay:Inlay;edge:Edge;size:number;ringDiameter:number;centerStone:boolean;explode:number;part:Part};

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
};
const INIT:Settings = {product:'necklace',motif:'clover',metal:'yellow',inlay:'pearl',edge:'double',size:15,ringDiameter:18,centerStone:true,explode:0,part:'all'};
const PARTS:{id:Exclude<Part,'all'>;no:string;name:string;description:string}[] = [
  {id:'plate',no:'01',name:'金属底托',description:'轮廓匹配的基座与结构层'},
  {id:'inlay',no:'02',name:'造型嵌片',description:'保留原 OBJ 三维表面'},
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
      <BeadLine id={id} metal={color} factor={.985} z={.55} radius={.185}/>
      <BeadLine id={id} metal={color} factor={.935} z={.59} radius={.12}/>
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
function InlayObject({id,appearance}:{id:MotifId;appearance:Inlay}){
  const original=useLoader(OBJLoader,assetPath(id));
  const finish=INLAYS[appearance];
  const nacreMaps=useMemo(()=>appearance==='pearl'?createNacreTextureSet(512):null,[appearance]);
  const material=useMemo(()=>new MeshPhysicalMaterial({
    color:new Color(appearance==='pearl'?'#ffffff':finish.color),
    map:nacreMaps?.albedo??null,
    bumpMap:nacreMaps?.bump??null,bumpScale:nacreMaps ? .075 : 0,
    roughnessMap:nacreMaps?.roughness??null,
    metalness:appearance==='pearl'?0:finish.metalness,roughness:nacreMaps?1:finish.roughness,
    clearcoat:appearance==='pearl'?.38:.7,clearcoatRoughness:appearance==='pearl'?.24:.12,
    iridescence:appearance==='pearl'?.19:0,
    iridescenceIOR:1.27,iridescenceThicknessRange:[165,275],
    envMapIntensity:1.35,side:2,
  }),[appearance,finish,nacreMaps]);
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
  useEffect(()=>()=>{material.dispose();nacreMaps?.dispose();},[material,nacreMaps]);
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
function Assembly({config,rootRef,onReady}:{config:Settings;rootRef:React.RefObject<Group|null>;onReady:(ready:boolean)=>void}){
  const color=METALS[config.metal].color;
  const scale=config.size/15;
  const ring=config.product==='ring';
  const mountHeight=ring?ringSizing(config.ringDiameter).motifSeatY:0;
  useEffect(()=>{onReady(true);return()=>onReady(false);},[config.motif,onReady]);
  return <group ref={rootRef} name="xiangyan-motif-assembly">
    {/* The ring seat rotates 90 degrees to face away from the finger hole. */}
    <group name="01-03-face-and-setting" scale={[scale,scale,scale]} position={[0,mountHeight,0]}
      rotation={ring?[-Math.PI/2,0,0]:[0,0,0]}>
      {showPart(config.part,'plate')&&<group position-z={-config.explode*2.3}><Plate id={config.motif} color={color}/></group>}
      {showPart(config.part,'inlay')&&<group position-z={config.explode*1.6}>
        <InlayObject id={config.motif} appearance={config.inlay}/>
        {ring&&config.motif==='clover'&&config.centerStone&&<CenterStone metal={color}/>}
      </group>}
      {showPart(config.part,'edge')&&<group position-z={config.explode*.65}><Rim id={config.motif} color={color} edge={config.edge}/></group>}
    </group>
    {showPart(config.part,'adapter')&&(ring
      ?<RingAdapter color={color} diameter={config.ringDiameter} explode={config.explode}/>
      :<NecklaceAdapter color={color} motif={config.motif} scale={scale} explode={config.explode}/>)}
  </group>;
}
function ViewRig({view,product}:{view:View;product:Product}){
  const {camera}=useThree();
  const controls=useRef<React.ComponentRef<typeof OrbitControls>>(null);
  useEffect(()=>{
    const ring=product==='ring';
    const target=new Vector3(0,ring?4.8:11,0);
    camera.up.set(0,1,0); // preserve world +Y as screen-up for the finger bore and setting
    const positions:Record<View,[number,number,number]>=ring?{
      angle:[26,43,15],front:[2,48,6],side:[39,15,11],fit:[45,4.8,0],
    }:{angle:[15,15,35],front:[0,7,42],side:[39,11,12],fit:[0,7,42]};
    camera.position.set(...positions[view]);camera.zoom=ring?21:17;camera.lookAt(target);camera.updateProjectionMatrix();
    controls.current?.target.copy(target);controls.current?.update();
  },[camera,view,product]);
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.08}
    target={[0,product==='ring'?4.8:11,0]} minZoom={11} maxZoom={60} enablePan={false}/>;
}
function ModelPreview({config,view,rootRef,rendererRef,ready}:{config:Settings;view:View;rootRef:React.RefObject<Group|null>;rendererRef:React.RefObject<WebGLRenderer|null>;ready:(r:boolean)=>void}){
  return <Canvas orthographic dpr={[1,2]} shadows camera={{position:[14,17,34],zoom:18,near:.1,far:180}} gl={{alpha:true,antialias:true,preserveDrawingBuffer:true}}
    onCreated={({gl})=>{rendererRef.current=gl;}}>
    <Environment files={`${base}environments/catalog-studio.hdr`} background={false}/>
    <ambientLight intensity={.52}/>
    <hemisphereLight args={['#fff9ee','#b4ac9f',.85]}/>
    <directionalLight position={[-8,16,17]} intensity={2.3} color="#fff5df" castShadow shadow-mapSize={[1024,1024]}/>
    <directionalLight position={[8,7,-7]} intensity={1.65} color="#dbe6ff"/>
    <directionalLight position={[0,-8,15]} intensity={.65} color="#fff7e9"/>
    <Suspense fallback={null}>
      <Assembly key={config.motif} config={config} rootRef={rootRef} onReady={ready}/>
    </Suspense>
    <ViewRig view={view} product={config.product}/>
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
  const [view,setView]=useState<View>('angle');
  const [ready,setReady]=useState(false);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const rootRef=useRef<Group>(null);
  const rendererRef=useRef<WebGLRenderer>(null);
  const update=<K extends keyof Settings>(key:K,value:Settings[K])=>setConfig(old=>({...old,[key]:value}));
  const downloadRecipe=()=>{
    const recipe={schema:'xiangyan.motif-case/0.1',reference:'Vintage Alhambra structural study (not a production replica)',
      units:'mm',settings:config,source:profiles[config.motif].src,
      parts:PARTS.map(p=>({code:p.no,name:p.name,independent:true})),
      productionStatus:'VISUAL_PROTOTYPE_ONLY',ring:config.product==='ring'?ringSizing(config.ringDiameter):null,
      geometryScreening:config.product==='ring'?comfortFitDiagnostics(config.ringDiameter):null,
      chain:{referenceLengthCm:42,representation:'visible articulated segment only'},
      notes:['OBJ source is unitless and normalized to 15 mm by visual span','The shank has a continuous geometric bore, but fit and manufacture have not been certified','No casting tolerances, inlay retention, or Boolean union validated']};
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
      <div><p className="motif-kicker">XIANGYAN / DESIGN SYSTEM 001</p><h1>从一枚四叶草，拆解一套珠宝语言。</h1>
        <p className="motif-heading-sub">经典四叶草结构研究 · 可替换主题 × 可组装结构 × 实时三维预览</p></div>
      <span className="motif-build-tag">内部案例 · 材质与结构 V0.3</span>
    </div>
    <div className="motif-workspace">
      <aside className="motif-controls" aria-label="DIY 配置面板">
        <div className="motif-section-caption"><span>01</span> 选择产品</div>
        <div className="motif-product-toggle" role="group" aria-label="产品类型">
          <button type="button" aria-pressed={config.product==='necklace'} onClick={()=>update('product','necklace')}>◌ <span>项链</span></button>
          <button type="button" aria-pressed={config.product==='ring'} onClick={()=>update('product','ring')}>◎ <span>戒指</span></button>
        </div>
        <div className="motif-section-caption"><span>02</span> 选择造型 <small>源自上传 OBJ</small></div>
        <div className="motif-choices">{MOTIFS.map(m=><button key={m.id} type="button" aria-pressed={config.motif===m.id}
          onClick={()=>{update('motif',m.id);setReady(false);}}><MotifThumbnail id={m.id}/><span>{m.name}</span></button>)}</div>
        <div className="motif-section-caption"><span>03</span> 材料与工艺</div>
        <p className="motif-label">金属外观 <span>{METALS[config.metal].name}</span></p>
        <div className="motif-color-row" role="group" aria-label="金属外观">{(Object.keys(METALS) as Metal[]).map(k=><button key={k} title={METALS[k].name} type="button" aria-label={METALS[k].name} aria-pressed={config.metal===k}
          onClick={()=>update('metal',k)}><span style={{background:METALS[k].color}}/></button>)}</div>
        <p className="motif-label">嵌片效果 <span>{INLAYS[config.inlay].name}</span></p>
        <div className="motif-inlay-options">{(Object.keys(INLAYS) as Inlay[]).map(k=><button key={k} type="button" aria-pressed={config.inlay===k} onClick={()=>update('inlay',k)}>
          <span style={{background:INLAYS[k].color}}/>{INLAYS[k].name}</button>)}</div>
        {config.product==='ring'&&config.motif==='clover'&&<label className="motif-center-toggle"><input type="checkbox" checked={config.centerStone} onChange={e=>update('centerStone',e.target.checked)}/>
          <span>中央小钻 <small>独立爪镶视觉结构，可关闭</small></span></label>}
        <p className="motif-label">包边样式</p>
        <div className="motif-edge-row" role="group" aria-label="包边样式">
          {([['double','双排金珠'],['smooth','光面包边'],['none','不加包边']] as const).map(([k,v])=><button type="button" key={k} aria-pressed={config.edge===k} onClick={()=>update('edge',k)}>{v}</button>)}
        </div>
        <div className="motif-section-caption"><span>04</span> 尺寸参数</div>
        <label className="motif-range-label">主题直径 <strong>{config.size} mm</strong><input type="range" min="11" max="20" step="1" value={config.size} onChange={e=>update('size',Number(e.target.value))}/></label>
        {config.product==='ring'&&<label className="motif-range-label">戒指内径（名义） <strong>{config.ringDiameter} mm</strong><input type="range" min="16" max="21" step=".5" value={config.ringDiameter} onChange={e=>update('ringDiameter',Number(e.target.value))}/></label>}
        <div className="motif-wear-check" role="status">
          <strong>{config.product==='ring'?'贯通戒臂 · 名义指孔':'交错椭圆链节 · 双侧连接环'}</strong>
          <p>{config.product==='ring'
            ?'内径 '+config.ringDiameter+' mm，保守几何孔径下限 '+checkRingNominalClearance(config.ringDiameter).conservativeMinimum.toFixed(2)+' mm。可在「指孔」视角检查；尚未做实际佩戴与生产公差认证。'
            :'每侧为独立可辨认的交错链节，不再用直杆替代。画面仅展示 42 cm 项链的局部链段。'}</p>
        </div>
      </aside>
      <main className="motif-visual" aria-label="实时三维结构预览">
        <div className="motif-preview-title"><span>INTERACTIVE 3D / LIVE ASSEMBLY</span><h2>{label(config.motif)} <em>·</em> {config.product==='necklace'?'悬挂项链':'镶饰戒指'}</h2><p>拖动旋转、滚轮缩放，实时观察各独立结构的组合</p></div>
        <ModelPreview config={config} view={view} rootRef={rootRef} rendererRef={rendererRef} ready={setReady}/>
        {!ready&&<p className="motif-loader" role="status">正在装配 3D 模组…</p>}
        <div className="motif-view-tools" role="group" aria-label="三维视角">
          {([['angle','45°'],['front','正面'],['side','侧面'],...(config.product==='ring'?[['fit','指孔'] as const]:[])] as const).map(([k,v])=><button type="button" key={k} aria-pressed={view===k} onClick={()=>setView(k)}>{v}</button>)}
        </div>
        <div className="motif-visual-status"><span className="motif-live-dot"/>真实 OBJ 源模组 <span>·</span> 正交视图 <span>·</span> {config.product==='ring'?'环形指孔 / 双肩连接':'独立链节 / 双侧连接环'}</div>
      </main>
      <aside className="motif-anatomy" aria-label="结构拆解与输出">
        <div className="motif-anatomy-head"><p className="motif-kicker">STRUCTURE / 结构</p><h2>拆开来看。</h2><p>点击一个零件单独查看它与整体的关系。</p></div>
        <button className="motif-all-parts" aria-pressed={config.part==='all'} type="button" onClick={()=>update('part','all')}>完整装配 <span>ALL PARTS ↗</span></button>
        <div className="motif-part-list">{PARTS.map(p=><button type="button" key={p.id} aria-pressed={config.part===p.id} onClick={()=>update('part',config.part===p.id?'all':p.id)}>
          <span className="motif-part-no">{p.no}</span><span><strong>{p.name}</strong><small>{p.id==='adapter'?(config.product==='necklace'?'独立椭圆链节与双侧连接环':'贯通指孔、舒适戒臂与双侧肩部'):p.description}</small></span><span className="motif-part-arrow">↗</span>
        </button>)}</div>
        <div className="motif-explode"><div className="motif-explode-label"><span>爆炸视图</span><b>{Math.round(config.explode*100)}%</b></div>
          <input aria-label="结构爆炸程度" type="range" min="0" max="1.5" step=".05" value={config.explode} onChange={e=>update('explode',Number(e.target.value))}/>
          <p>沿 Z 轴分离嵌片、边框与金属底托</p></div>
        <div className="motif-export-panel"><h3>保存这次设计</h3><button className="motif-main-download" type="button" disabled={!ready||busy} onClick={exportGlb}>{busy?'导出中…':'导出 3D GLB'} <span>↗</span></button>
          <div className="motif-secondary-downloads"><button type="button" onClick={downloadRecipe}>配置 JSON</button><button type="button" onClick={exportPng} disabled={!ready}>当前截图 PNG</button></div>
          <p className="motif-status" role="status">{status}</p></div>
        <div className="motif-disclaimer">工程边界：本案例用于结构与外观评审，不代表梵克雅宝官方 CAD。戒圈为贯通几何、链节为独立网格；初步检查环形指孔与壁厚，但尚未完成铸造布尔、实体碰撞、佩戴舒适度、连接强度和工厂公差验证。</div>
      </aside>
    </div>
  </div>;
}
export default MotifCaseStudio;
