import {Suspense,useCallback,useEffect,useRef,useState} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {OrbitControls,useGLTF} from '@react-three/drei';
import {ACESFilmicToneMapping,SRGBColorSpace} from 'three';
import type {OrbitControls as OrbitControlsImpl} from 'three-stdlib';
import {GEM_ASSET} from '../assets/gemManifest';
import type {Configuration} from '../configuration/configuration';
import {GemAsset} from './GemAsset';
import {RingAssembly} from './RingAssembly';
import {ViewerBoundary} from './ViewerBoundary';
import {nextPerformanceSample,qualitySettings,type Quality} from './quality';
import {cameraView,type InspectionView} from './cameraViews';
import {JewelryLighting,clearJewelryLightingCache} from './JewelryLighting';
import {JewelryShadows} from './JewelryShadows';
import {ReferenceRing} from './ReferenceRing';
import {REFERENCE_ASSETS,type ModelMode} from '../assets/referenceManifest';
import {JewelryFloor} from './JewelryFloor';
import {JewelryPostprocessing} from './JewelryPostprocessing';

function JewelryScene({configuration,quality,simplified,onReady,modelMode,autoRotate}:{
  configuration:Configuration;quality:Quality;simplified:boolean;onReady:()=>void;modelMode:ModelMode;autoRotate:boolean;
}){
  const settings=qualitySettings(quality,simplified);
  return <>
    <JewelryLighting>{environment=>modelMode==='reference'
      ?<ReferenceRing metal={configuration.metalFinish} {...{environment,quality,simplified,onReady}}/>
      :<RingAssembly configuration={configuration}>
      <GemAsset size={configuration.stoneSize} {...{quality,simplified,environment,onReady}}/>
    </RingAssembly>}</JewelryLighting>
    <JewelryShadows key={modelMode} {...{configuration,quality,simplified}}/>
    <JewelryFloor {...{quality,simplified}}/>
    {settings.postprocessing&&<JewelryPostprocessing quality={quality} active={autoRotate}
      contentKey={`${modelMode}/${configuration.shankStyle}/${configuration.metalFinish}/${configuration.stoneSize}`}/>}
  </>;
}
function CameraControl({autoRotate,resetToken,inspection,onPerformanceWarning,modelMode}:{autoRotate:boolean;resetToken:number;inspection:InspectionView;onPerformanceWarning:()=>void;modelMode:ModelMode}){
  const controls=useRef<OrbitControlsImpl>(null);
  const camera=useThree(s=>s.camera),invalidate=useThree(s=>s.invalidate);
  const compact=useThree(s=>s.size.width<650);
  const [interacting,setInteracting]=useState(false);
  const samples=useRef({seconds:0,frames:0});
  const warned=useRef(false);
  useEffect(()=>{
    const view=cameraView(inspection,compact,modelMode);
    camera.position.set(...view.position);controls.current?.target.set(...view.target);
    controls.current?.update();invalidate();
  },[resetToken,inspection,compact,camera,invalidate,modelMode]);
  useFrame((_,delta)=>{
    const result=nextPerformanceSample(samples.current,delta,document.visibilityState==='visible'&&(autoRotate||interacting));
    samples.current=result.sample;
    if(result.warn&&!warned.current){warned.current=true;onPerformanceWarning();}
  });
  return <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping dampingFactor={0.08}
    minDistance={1.5} maxDistance={9} minPolarAngle={0.18} maxPolarAngle={Math.PI/2-0.03}
    autoRotate={autoRotate&&!interacting} autoRotateSpeed={0.7}
    onStart={()=>setInteracting(true)} onEnd={()=>setInteracting(false)} target={cameraView(inspection,compact,modelMode).target}/>;
}

export function JewelryStage({configuration,quality,autoRotate,resetToken,onPerformanceWarning,modelMode}:{
  configuration:Configuration;quality:Quality;autoRotate:boolean;resetToken:number;onPerformanceWarning:()=>void;modelMode:ModelMode;
}){
  const [readyMode,setReadyMode]=useState<ModelMode|null>(null),[simplified,setSimplified]=useState(false),[contextLost,setContextLost]=useState(false);
  const ready=readyMode===modelMode;
  const [attempt,setAttempt]=useState(0);
  const [inspection,setInspection]=useState<InspectionView>('overall');
  useEffect(()=>setInspection('overall'),[resetToken]);
  const readyCallback=useCallback(()=>setReadyMode(modelMode),[modelMode]);
  useEffect(()=>setInspection('overall'),[modelMode]);
  const cleanupContext=useRef<(()=>void)|null>(null);
  useEffect(()=>()=>cleanupContext.current?.(),[]);
  const retry=()=>{
    cleanupContext.current?.();
    useGLTF.clear(GEM_ASSET.url);
    useGLTF.clear(REFERENCE_ASSETS.model);
    clearJewelryLightingCache();
    setContextLost(false);setReadyMode(null);setAttempt(n=>n+1);
  };
  const settings=qualitySettings(quality,simplified);
  return <section className="stage" aria-label="戒指三维预览">
    <ViewerBoundary onRetry={retry}>
      <Canvas key={attempt} dpr={[1,settings.maxDpr]} camera={{position:[2.9,2.6,4.7],fov:32,near:0.1,far:50}}
        frameloop={autoRotate||!ready?'always':'demand'} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}}
        fallback={<div className="viewer-message" role="alert">当前浏览器无法使用 WebGL，请换用支持三维渲染的浏览器。</div>}
        onCreated={({gl})=>{
          gl.toneMapping=ACESFilmicToneMapping;gl.toneMappingExposure=1;gl.outputColorSpace=SRGBColorSpace;
          gl.debug.onShaderError=(context,program,vertex,fragment)=>{
            console.error('Jewelry material compilation failed',{
              vertex:context.getShaderInfoLog(vertex),fragment:context.getShaderInfoLog(fragment),
              program:context.getProgramInfoLog(program),
            });
            queueMicrotask(()=>setSimplified(true));
          };
          const lost=(e:Event)=>{if(!gl.domElement.isConnected)return;e.preventDefault();setContextLost(true);};
          const restored=()=>{setContextLost(false);setAttempt(n=>n+1);setReadyMode(null);};
          const element=gl.domElement;cleanupContext.current?.();
          element.addEventListener('webglcontextlost',lost);element.addEventListener('webglcontextrestored',restored);
          cleanupContext.current=()=>{element.removeEventListener('webglcontextlost',lost);element.removeEventListener('webglcontextrestored',restored);};
        }}>
        <color attach="background" args={['#ececeb']}/>
        <ambientLight intensity={0.2}/>
        <Suspense fallback={null}>
          <JewelryScene {...{configuration,quality,simplified,modelMode,autoRotate}} onReady={readyCallback}/>
        </Suspense>
        <CameraControl {...{autoRotate,resetToken,inspection,onPerformanceWarning,modelMode}}/>
      </Canvas>
      {!ready&&<div className="loading-indicator" role="status"><span/>正在准备你的戒指</div>}
    </ViewerBoundary>
    <div className="inspection-views" role="group" aria-label="观察视角">
      {(['overall','stone','side'] as const).map((view,i)=><button key={view} aria-pressed={inspection===view}
        onClick={()=>setInspection(view)}>{['整体','主石细节','镶座侧面'][i]}</button>)}
    </div>
    {contextLost&&<div className="viewer-message" role="alert"><strong>三维渲染已中断</strong><p>等待浏览器恢复，或重新载入页面。当前选择仍保留。</p><button onClick={()=>window.location.reload()}>重新载入页面</button></div>}
    <button className="compatibility-control" onClick={()=>setSimplified(v=>!v)} aria-pressed={simplified}>
      {simplified?'简化材质 · 恢复折射':'显示异常？启用简化材质'}
    </button>
  </section>;
}
