import {Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {Canvas, useLoader, useThree} from '@react-three/fiber';
import {Environment, OrbitControls} from '@react-three/drei';
import {
  Box3, CatmullRomCurve3, Color, ExtrudeGeometry, Group, InstancedMesh,
  Mesh, MeshPhysicalMaterial, Object3D, Shape, TubeGeometry, Vector3,
  type WebGLRenderer,
} from 'three';
import {OBJLoader} from 'three/examples/jsm/loaders/OBJLoader.js';
import profiles from './profiles.json';
import './MotifCaseStudio.css';

type MotifId = keyof typeof profiles;
type Product = 'necklace' | 'ring';
type Metal = 'yellow' | 'rose' | 'silver';
type Inlay = 'pearl' | 'onyx' | 'malachite' | 'lapis';
type Edge = 'double' | 'smooth' | 'none';
type Part = 'all' | 'plate' | 'inlay' | 'edge' | 'adapter';
type View = 'angle' | 'front' | 'side';
type Settings = {product:Product;motif:MotifId;metal:Metal;inlay:Inlay;edge:Edge;size:number;ringDiameter:number;explode:number;part:Part};

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
  yellow:{name:'18K 黄金色',color:'#d2ad64'},rose:{name:'玫瑰金色',color:'#d4a08b'},silver:{name:'银白金属',color:'#c3cbd0'},
};
const INLAYS: Record<Inlay,{name:string;color:string;roughness:number;metalness:number}> = {
  pearl:{name:'白色珍珠母贝',color:'#f3ece0',roughness:.24,metalness:.03},
  onyx:{name:'黑玛瑙效果',color:'#171d23',roughness:.16,metalness:.03},
  malachite:{name:'孔雀石效果',color:'#176a59',roughness:.25,metalness:.03},
  lapis:{name:'青金石效果',color:'#294f91',roughness:.24,metalness:.03},
};
const INIT:Settings = {product:'necklace',motif:'clover',metal:'yellow',inlay:'pearl',edge:'double',size:15,ringDiameter:18,explode:0,part:'all'};
const PARTS:{id:Exclude<Part,'all'>;no:string;name:string;description:string}[] = [
  {id:'plate',no:'01',name:'金属底托',description:'轮廓匹配的基座与结构层'},
  {id:'inlay',no:'02',name:'造型嵌片',description:'保留原 OBJ 三维表面'},
  {id:'edge',no:'03',name:'金珠包边',description:'独立环绕轮廓的珠粒与边线'},
  {id:'adapter',no:'04',name:'装配接口',description:'项链挂耳 / 戒臂连接结构'},
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
    const count=Math.max(12,Math.min(230,Math.round(curve.getLength()/.56)));
    return Array.from({length:count},(_,i)=>curve.getPointAt(i/count));
  },[id,factor,z]);
  useLayoutEffect(()=>{
    if(!ref.current)return;
    const obj=new Object3D();
    points.forEach((p,i)=>{obj.position.copy(p);obj.updateMatrix();ref.current!.setMatrixAt(i,obj.matrix);});
    ref.current.instanceMatrix.needsUpdate=true;
  },[points]);
  return <instancedMesh ref={ref} args={[undefined,undefined,points.length]} name="granulated-bezel" castShadow>
    <sphereGeometry args={[radius,9,7]}/><meshPhysicalMaterial color={metal} metalness={.89} roughness={.20} clearcoat={.65}/>
  </instancedMesh>;
}
function Rim({id,color,edge}:{id:MotifId;color:string;edge:Edge}){
  const outer=useMemo(()=>new TubeGeometry(outlineCurve(id,.99,.72),240,.22,10,true),[id]);
  const inner=useMemo(()=>new TubeGeometry(outlineCurve(id,.89,.80),240,.13,10,true),[id]);
  useEffect(()=>()=>{outer.dispose();inner.dispose();},[outer,inner]);
  if(edge==='none')return null;
  return <group name="03-edge" position={[0,0,.28]}>
    <mesh geometry={outer} castShadow><meshPhysicalMaterial color={color} metalness={.9} roughness={.19}/></mesh>
    {edge==='double'?<>
      <mesh geometry={inner} castShadow><meshPhysicalMaterial color={color} metalness={.9} roughness={.20}/></mesh>
      <BeadLine id={id} metal={color} factor={.98} z={.73} radius={.19}/>
      <BeadLine id={id} metal={color} factor={.88} z={.81} radius={.13}/>
    </>:null}
  </group>;
}
function Plate({id,color}:{id:MotifId;color:string}){
  const geometry=useMemo(()=>new ExtrudeGeometry(profilePath(id),{depth:.64,steps:1,bevelEnabled:true,bevelThickness:.16,bevelSize:.17,bevelSegments:3,curveSegments:8}),[id]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh name="01-metal-plate" geometry={geometry} position={[0,0,-.75]} castShadow receiveShadow>
    <meshPhysicalMaterial color={color} metalness={.9} roughness={.22} clearcoat={.4}/>
  </mesh>;
}
function InlayObject({id,appearance}:{id:MotifId;appearance:Inlay}){
  const original=useLoader(OBJLoader,assetPath(id));
  const finish=INLAYS[appearance];
  const material=useMemo(()=>new MeshPhysicalMaterial({
    color:new Color(finish.color),metalness:finish.metalness,roughness:finish.roughness,
    clearcoat:.68,clearcoatRoughness:.16,iridescence:appearance==='pearl'?.7:0,
    iridescenceIOR:1.25,iridescenceThicknessRange:[120,420],side:2,
  }),[appearance,finish]);
  const instance=useMemo(()=>{
    const clone=original.clone(true);
    clone.traverse(child=>{if(child instanceof Mesh){child.material=material;child.castShadow=true;child.receiveShadow=true;}});
    const bounds=new Box3().setFromObject(original);
    const span=bounds.getSize(new Vector3());const center=bounds.getCenter(new Vector3());
    const scale=15/Math.max(span.x,span.y);
    const inset=.85;
    clone.scale.set(scale*inset,scale*inset,.48/Math.max(.01,span.z));
    clone.position.set(-center.x*scale*inset,-center.y*scale*inset,.72-bounds.min.z*clone.scale.z);
    return clone;
  },[original,material]);
  useEffect(()=>()=>material.dispose(),[material]);
  return <group name="02-inlay"><primitive object={instance}/></group>;
}
function Wire({points,radius,color,name}:{points:Vector3[];radius:number;color:string;name:string}){
  const tube=useMemo(()=>new TubeGeometry(new CatmullRomCurve3(points),100,radius,9,false),[points,radius]);
  useEffect(()=>()=>tube.dispose(),[tube]);
  return <mesh name={name} geometry={tube} castShadow><meshPhysicalMaterial color={color} metalness={.88} roughness={.19}/></mesh>;
}
function ProductAdapter({product,metal,diameter,explode}:{product:Product;metal:string;diameter:number;explode:number}){
  const R=(diameter/2)+.8;
  const left=useMemo(()=>[new Vector3(-5,4.8,-.5),new Vector3(-8,7,-.5),new Vector3(-11,12,-.6),new Vector3(-12,20,-.9),new Vector3(-8,26,-1.5)],[product]);
  const right=useMemo(()=>left.map(p=>new Vector3(-p.x,p.y,p.z)),[left]);
  const shoulderLeft=useMemo(()=>[new Vector3(-4.5,-4,-.7),new Vector3(-6.9,-5.8,-1.7),new Vector3(-R,-8,-3.1)],[R]);
  const shoulderRight=useMemo(()=>shoulderLeft.map(p=>new Vector3(-p.x,p.y,p.z)),[shoulderLeft]);
  return <group name="04-adapter" position-z={-explode*.6}>
    {product==='necklace'?<>
      <Wire points={left} radius={.22} color={metal} name="necklace-left-chain"/>
      <Wire points={right} radius={.22} color={metal} name="necklace-right-chain"/>
      {[ -1,1 ].map(sign=><mesh key={sign} position={[sign*5.1,4.8,-.5]} rotation={[0,0,.25*sign]} castShadow name="attachment-eyelet">
        <torusGeometry args={[.77,.19,10,32]}/><meshPhysicalMaterial color={metal} metalness={.88} roughness={.22}/>
      </mesh>)}
    </>:<>
      <mesh name="ring-shank" position={[0,-8,-3.1]} castShadow>
        <torusGeometry args={[R,1.02,18,96]}/><meshPhysicalMaterial color={metal} metalness={.9} roughness={.21}/>
      </mesh>
      <Wire points={shoulderLeft} radius={.82} color={metal} name="left-ring-shoulder"/>
      <Wire points={shoulderRight} radius={.82} color={metal} name="right-ring-shoulder"/>
    </>}
  </group>;
}
function Assembly({config,rootRef,onReady}:{config:Settings;rootRef:React.RefObject<Group|null>;onReady:(ready:boolean)=>void}){
  const color=METALS[config.metal].color;
  const scale=config.size/15;
  useEffect(()=>{onReady(true);return()=>onReady(false);},[config.motif,onReady]);
  return <group ref={rootRef} name="xiangyan-motif-assembly" scale={[scale,scale,scale]}>
    {showPart(config.part,'plate')&&<group position-z={-config.explode*2.3}><Plate id={config.motif} color={color}/></group>}
    {showPart(config.part,'inlay')&&<group position-z={config.explode*1.6}><InlayObject id={config.motif} appearance={config.inlay}/></group>}
    {showPart(config.part,'edge')&&<group position-z={config.explode*.65}><Rim id={config.motif} color={color} edge={config.edge}/></group>}
    {showPart(config.part,'adapter')&&<ProductAdapter product={config.product} metal={color} diameter={config.ringDiameter/scale} explode={config.explode}/>}
  </group>;
}
function ViewRig({view,product}:{view:View;product:Product}){
  const {camera}=useThree();
  const controls=useRef<React.ComponentRef<typeof OrbitControls>>(null);
  useEffect(()=>{
    const cy=product==='necklace'?6:-6;
    const positions:Record<View,[number,number,number]>={angle:[14,cy+10,34],front:[0,cy,40],side:[37,cy+7,12]};
    camera.position.set(...positions[view]);
    camera.lookAt(0,cy,0);
    camera.updateProjectionMatrix();
    controls.current?.target.set(0,cy,0);
    controls.current?.update();
  },[camera,view,product]);
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.08} target={[0,product==='necklace'?6:-6,0]} minZoom={12} maxZoom={47} enablePan={false}/>;
}
function ModelPreview({config,view,rootRef,rendererRef,ready}:{config:Settings;view:View;rootRef:React.RefObject<Group|null>;rendererRef:React.RefObject<WebGLRenderer|null>;ready:(r:boolean)=>void}){
  return <Canvas orthographic dpr={[1,2]} shadows camera={{position:[14,17,34],zoom:21,near:.1,far:180}} gl={{alpha:true,antialias:true,preserveDrawingBuffer:true}}
    onCreated={({gl})=>{rendererRef.current=gl;}}>
    <Environment files={`${base}environments/catalog-studio.hdr`} background={false}/>
    <ambientLight intensity={1.35}/>
    <hemisphereLight args={['#fff7e8','#c1b8a4',2]}/>
    <directionalLight position={[-8,16,17]} intensity={4.5} color="#fff5df" castShadow shadow-mapSize={[1024,1024]}/>
    <directionalLight position={[8,7,-7]} intensity={3.4} color="#dbe6ff"/>
    <directionalLight position={[0,-8,15]} intensity={1.7} color="#fff7e9"/>
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
      productionStatus:'VISUAL_PROTOTYPE_ONLY',notes:['OBJ source is unitless and normalized to 15 mm by visual span','No manufacturing tolerances, prong retention, casting minimums or Boolean union validated']};
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
      <span className="motif-build-tag">内部案例 · 结构演示 V0.1</span>
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
        <p className="motif-label">包边样式</p>
        <div className="motif-edge-row" role="group" aria-label="包边样式">
          {([['double','双排金珠'],['smooth','光面包边'],['none','不加包边']] as const).map(([k,v])=><button type="button" key={k} aria-pressed={config.edge===k} onClick={()=>update('edge',k)}>{v}</button>)}
        </div>
        <div className="motif-section-caption"><span>04</span> 尺寸参数</div>
        <label className="motif-range-label">主题直径 <strong>{config.size} mm</strong><input type="range" min="11" max="20" step="1" value={config.size} onChange={e=>update('size',Number(e.target.value))}/></label>
        {config.product==='ring'&&<label className="motif-range-label">戒指内径（示意） <strong>{config.ringDiameter} mm</strong><input type="range" min="16" max="21" step=".5" value={config.ringDiameter} onChange={e=>update('ringDiameter',Number(e.target.value))}/></label>}
      </aside>
      <main className="motif-visual" aria-label="实时三维结构预览">
        <div className="motif-preview-title"><span>INTERACTIVE 3D / LIVE ASSEMBLY</span><h2>{label(config.motif)} <em>·</em> {config.product==='necklace'?'悬挂项链':'镶饰戒指'}</h2><p>拖动旋转、滚轮缩放，实时观察各独立结构的组合</p></div>
        <ModelPreview config={config} view={view} rootRef={rootRef} rendererRef={rendererRef} ready={setReady}/>
        {!ready&&<p className="motif-loader" role="status">正在装配 3D 模组…</p>}
        <div className="motif-view-tools" role="group" aria-label="三维视角">
          {([['angle','45°'],['front','正面'],['side','侧面']] as const).map(([k,v])=><button type="button" key={k} aria-pressed={view===k} onClick={()=>setView(k)}>{v}</button>)}
        </div>
        <div className="motif-visual-status"><span className="motif-live-dot"/>真实 OBJ 源模组 <span>·</span> 正交视图 <span>·</span> 独立几何组件</div>
      </main>
      <aside className="motif-anatomy" aria-label="结构拆解与输出">
        <div className="motif-anatomy-head"><p className="motif-kicker">STRUCTURE / 结构</p><h2>拆开来看。</h2><p>点击一个零件单独查看它与整体的关系。</p></div>
        <button className="motif-all-parts" aria-pressed={config.part==='all'} type="button" onClick={()=>update('part','all')}>完整装配 <span>ALL PARTS ↗</span></button>
        <div className="motif-part-list">{PARTS.map(p=><button type="button" key={p.id} aria-pressed={config.part===p.id} onClick={()=>update('part',config.part===p.id?'all':p.id)}>
          <span className="motif-part-no">{p.no}</span><span><strong>{p.name}</strong><small>{p.id==='adapter'?(config.product==='necklace'?'连接耳、链条':'戒臂、肩部接口'):p.description}</small></span><span className="motif-part-arrow">↗</span>
        </button>)}</div>
        <div className="motif-explode"><div className="motif-explode-label"><span>爆炸视图</span><b>{Math.round(config.explode*100)}%</b></div>
          <input aria-label="结构爆炸程度" type="range" min="0" max="1.5" step=".05" value={config.explode} onChange={e=>update('explode',Number(e.target.value))}/>
          <p>沿 Z 轴分离嵌片、边框与金属底托</p></div>
        <div className="motif-export-panel"><h3>保存这次设计</h3><button className="motif-main-download" type="button" disabled={!ready||busy} onClick={exportGlb}>{busy?'导出中…':'导出 3D GLB'} <span>↗</span></button>
          <div className="motif-secondary-downloads"><button type="button" onClick={downloadRecipe}>配置 JSON</button><button type="button" onClick={exportPng} disabled={!ready}>当前截图 PNG</button></div>
          <p className="motif-status" role="status">{status}</p></div>
        <div className="motif-disclaimer">工程边界：本案例展示独立零件与连接逻辑，不代表梵克雅宝官方结构。网格虽闭合，仍未完成公差、牢固度、金属布尔融合和生产可制造性验证。</div>
      </aside>
    </div>
  </div>;
}
export default MotifCaseStudio;
