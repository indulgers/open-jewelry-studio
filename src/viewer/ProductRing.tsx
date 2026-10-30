import {useEffect,useMemo} from 'react';
import {useGLTF} from '@react-three/drei';
import type {Texture} from 'three';
import {atelierGem} from '../assets/atelierManifest';
import {finishedRing,type FinishedRingId} from '../assets/finishedRings';
import {prepareFinishedRing} from '../geometry/finishedRing';
import type {MetalFinish} from '../configuration/configuration';
import {createMetalMaterial} from './materials';
import {createMountGeometry,bakeMetalOcclusion} from './mountGeometry';
import {OpticalGem} from './OpticalGem';
import type {Quality} from './quality';
import type {StudioPreset} from './studioPresets';

export function ProductRing({ringStyle,metal,environment,quality,simplified,onReady,preset}:{
  ringStyle:FinishedRingId;metal:MetalFinish;environment:Texture;quality:Quality;simplified:boolean;onReady:()=>void;preset:StudioPreset;
}){
  const definition=finishedRing(ringStyle);
  const gltf=useGLTF(definition.url,definition.draco||false),round=useGLTF(atelierGem('round').url);
  const ring=useMemo(()=>{
    const prepared=prepareFinishedRing(gltf.scene,{rotation:definition.rotation,
      replaceCenter:definition.replaceCenter,replacement:round.scene});
    const mount=createMountGeometry(prepared.metals.map(p=>p.geometry));
    // Hand-modelled CAD has far more vertices than the study ring; a short bake keeps
    // the indirect self-occlusion cue without blocking the first frame for seconds.
    prepared.metals.forEach(p=>bakeMetalOcclusion(p.geometry,mount.tree,0.14,6));
    return {...prepared,mount,dispose(){mount.dispose();prepared.dispose();}};
  },[gltf.scene,round.scene,definition]);
  const material=useMemo(()=>createMetalMaterial(metal,preset,true),[metal,preset]);
  const optics=useMemo(()=>({environmentRotation:preset.rotation,environmentIntensity:preset.gemIntensity,dispersion:preset.dispersion,
    mount:{bvh:ring.mount.bvh,color:material.color,roughness:preset.roughness}}),[preset,ring,material]);
  useEffect(()=>()=>ring.dispose(),[ring]);useEffect(()=>()=>material.dispose(),[material]);useEffect(onReady,[environment,onReady]);
  return <group dispose={null}>
    {ring.metals.map(part=><mesh key={part.name} name={part.name} geometry={part.geometry} material={material}/>)}
    {ring.gems.map(part=><OpticalGem key={part.name} name={part.name} geometry={part.geometry} {...{environment,quality,simplified,options:optics}}/>)}
  </group>;
}
