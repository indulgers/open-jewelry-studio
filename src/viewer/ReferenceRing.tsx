import {useEffect,useMemo} from 'react';
import {useGLTF} from '@react-three/drei';
import type {Texture} from 'three';
import {REFERENCE_ASSETS} from '../assets/referenceManifest';
import {prepareReferenceRing} from '../geometry/referenceRing';
import type {MetalFinish} from '../configuration/configuration';
import {createMetalMaterial} from './materials';
import {GROUND_Y} from './contactShadowResources';
import type {Quality} from './quality';
import {OpticalGem} from './OpticalGem';

export function ReferenceRing({metal,environment,quality,simplified,onReady}:{
  metal:MetalFinish;environment:Texture;quality:Quality;simplified:boolean;onReady:()=>void;
}){
  const gltf=useGLTF(REFERENCE_ASSETS.model,REFERENCE_ASSETS.draco);
  const ring=useMemo(()=>prepareReferenceRing(gltf.scene,GROUND_Y),[gltf.scene]);
  const material=useMemo(()=>createMetalMaterial(metal),[metal]);
  useEffect(()=>()=>ring.dispose(),[ring]);
  useEffect(()=>()=>material.dispose(),[material]);
  useEffect(onReady,[environment,onReady]);
  return <group dispose={null}>{ring.parts.map(part=>part.kind==='metal'
    ?<mesh key={part.name} name={part.name} geometry={part.geometry} material={material}/>
    :<OpticalGem key={part.name} name={part.name} geometry={part.geometry} {...{environment,quality,simplified}}/>)}</group>;
}
