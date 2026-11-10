import {useEffect,useMemo,useState} from 'react';
import {useGLTF} from '@react-three/drei';
import type {Texture} from 'three';
import {atelierGem} from '../assets/atelierManifest';
import {finishedRing,type FinishedRingId} from '../assets/finishedRings';
import {prepareFinishedRing} from '../geometry/finishedRing';
import type {MetalFinish} from '../configuration/configuration';
import {createMetalMaterial} from './materials';
import {prepareMount} from './prepareMount';
import {restoreMountData} from './mountPreparationData';
import {OpticalGem} from './OpticalGem';
import type {Quality} from './quality';
import type {StoneAppearance} from './stoneAppearance';
import type {StudioPreset} from './studioPresets';

export function ProductRing({ringStyle,metal,environment,quality,simplified,onReady,preset,stoneAppearance='diamond'}:{
  ringStyle:FinishedRingId;metal:MetalFinish;environment:Texture;quality:Quality;simplified:boolean;onReady:()=>void;preset:StudioPreset;stoneAppearance?:StoneAppearance;
}){
  const definition=finishedRing(ringStyle);
  const [gltf,round]=useGLTF(definition.replaceCenter?[definition.url,atelierGem('round').url]:[definition.url],definition.draco||false);
  const ring=useMemo(()=>prepareFinishedRing(gltf.scene,{rotation:definition.rotation,
    replaceCenter:definition.replaceCenter,replacement:round?.scene}),[gltf.scene,round?.scene,definition]);
  const [built,setBuilt]=useState<{source:typeof ring;mount?:ReturnType<typeof restoreMountData>;error?:Error}|null>(null);
  const mount=built?.source===ring?built.mount:undefined;
  useEffect(()=>{
    let active=true,owned:ReturnType<typeof restoreMountData>|undefined;
    const sources=ring.metals.map(p=>p.geometry),job=prepareMount(gltf.scene,sources);
    job.result.then(data=>{
      if(!active)return;
      owned=restoreMountData(data,sources);setBuilt({source:ring,mount:owned});
    }).catch(error=>{if(active)setBuilt({source:ring,error})});
    return ()=>{active=false;job.cancel();owned?.dispose()};
  },[ring,gltf.scene]);
  const material=useMemo(()=>createMetalMaterial(metal,preset,true),[metal,preset]);
  const optics=useMemo(()=>({environmentRotation:preset.rotation,environmentIntensity:preset.gemIntensity,dispersion:preset.dispersion,
    mount:mount?{bvh:mount.bvh,color:material.color,roughness:preset.roughness}:undefined}),[preset,mount,material]);
  const readyGems=useMemo(()=>new Set<string>(),[ring,environment,quality,simplified]);
  const largestGem=useMemo(()=>ring.gems.reduce((largest,part)=>{
    part.geometry.computeBoundingSphere();
    const diameter=part.geometry.boundingSphere?.radius??0;
    return diameter>largest.radius?{name:part.name,radius:diameter}:largest;
  },{name:'',radius:-1}).name,[ring]);
  useEffect(()=>()=>ring.dispose(),[ring]);useEffect(()=>()=>material.dispose(),[material]);
  if(built?.source===ring&&built.error)throw built.error;
  if(!mount)return null;
  return <group dispose={null}>
    {ring.metals.map(part=><mesh key={part.name} name={part.name} geometry={part.geometry} material={material}/>)}
    {ring.gems.map(part=><OpticalGem key={part.name} name={part.name} geometry={part.geometry} {...{environment,quality,simplified}} options={part.name===largestGem&&definition.replaceCenter?{...optics,appearance:stoneAppearance}:optics}
      onReady={()=>{readyGems.add(part.name);if(readyGems.size===ring.gems.length)onReady()}}/>)}
  </group>;
}
