import {Suspense,useEffect,useMemo,useState,type RefObject} from 'react';
import {Canvas} from '@react-three/fiber';
import {DoubleSide,NeutralToneMapping} from 'three';
import {JewelryLighting,clearJewelryLightingCache} from '../../viewer/JewelryLighting';
import {StudioFillLights} from '../../viewer/StudioFillLights';
import {ViewerBoundary} from '../../viewer/ViewerBoundary';
import {createMetalMaterial} from '../../viewer/materials';
import {GemBatch,RingCamera,RingThumbnail,preset,type RingView} from '../ring02/Ring02Stage';
import type {CatalogRing} from '../catalog';
import type {ReferenceDesign} from './design';
import type {ReferenceRing} from './model';

export function SourceLoading({template,retry}:{template:CatalogRing;retry?:()=>void}){
  return <div className="ring02-stage-loading" role={retry?'alert':'status'}>
    {!retry&&<span className="ring02-spinner" aria-hidden="true"/>}
    <span>{retry?'三维预览暂未加载。':template.name+'正在准备三维预览…'}</span>
    {retry&&<button onClick={retry}>重试加载</button>}
  </div>;
}
function SourceScene({ring,design,onReady}:{ring:ReferenceRing;design:ReferenceDesign;onReady?:()=>void}){
  const material=useMemo(()=>{const result=createMetalMaterial('white',preset);result.side=DoubleSide;return result;},[]);
  useEffect(()=>()=>material.dispose(),[material]);
  return <JewelryLighting preset={preset}>{environment=><group dispose={null}>
    {ring.metal.map((part,index)=><mesh key={part.name} geometry={part.geometry} material={material} name={part.name} onAfterRender={index===0?onReady:undefined}/>)}
    {ring.stones.map(stone=><GemBatch key={stone.name} environment={environment} stones={[{...stone,appearance:design[stone.zone]}]}/>)}
  </group>}</JewelryLighting>;
}
export function SourceRingStage({ring,design,template,view,reset,captureRef}:{ring:ReferenceRing;design:ReferenceDesign;template:CatalogRing;view:RingView;reset:number;captureRef:RefObject<(()=>string|undefined)|null>}){
  const [ready,setReady]=useState(false),[failed,setFailed]=useState(false);
  return <div className="stone-first-canvas ring02-canvas source-ring-canvas" aria-label={template.name+'三维预览'}>
    <ViewerBoundary onError={()=>setFailed(true)} onRetry={()=>{clearJewelryLightingCache();setReady(false);setFailed(false);}} errorDetail={<p>配置已保留。请重试加载以恢复三维预览。</p>}>
      <Canvas orthographic camera={{position:[2.2,2.5,3.6],near:.03,far:30}} dpr={[1,1.5]} frameloop="demand" gl={{antialias:true,preserveDrawingBuffer:true}} onCreated={({gl})=>{gl.toneMapping=NeutralToneMapping;}}>
        <color attach="background" args={['#fff']}/><StudioFillLights neutral/>
        <Suspense fallback={null}><SourceScene ring={ring} design={design} onReady={ready?undefined:()=>setReady(true)}/></Suspense>
        <RingCamera view={view} reset={reset} frames={ring.frames}/><RingThumbnail captureRef={captureRef} ready={ready&&!failed} frames={ring.frames}/>
      </Canvas>
    </ViewerBoundary>
    {!ready&&!failed&&<SourceLoading template={template}/>}
  </div>;
}
