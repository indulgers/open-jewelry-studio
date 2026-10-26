import {useLayoutEffect,type ReactNode} from 'react';
import {Environment} from '@react-three/drei';
import {useLoader} from '@react-three/fiber';
import {EquirectangularReflectionMapping,type Texture} from 'three';
import {EXRLoader} from 'three/addons/loaders/EXRLoader.js';
import {REFERENCE_ASSETS} from '../assets/referenceManifest';

export function clearJewelryLightingCache(){
  useLoader.clear(EXRLoader,[REFERENCE_ASSETS.metalEnvironment,REFERENCE_ASSETS.gemEnvironment]);
}

export function JewelryLighting({children}:{children:(environment:Texture)=>ReactNode}){
  // useLoader owns cached EXRs; do not dispose them when switching model modes.
  const [metal,gem]=useLoader(EXRLoader,[REFERENCE_ASSETS.metalEnvironment,REFERENCE_ASSETS.gemEnvironment]);
  useLayoutEffect(()=>{
    metal.mapping=gem.mapping=EquirectangularReflectionMapping;
    metal.needsUpdate=gem.needsUpdate=true;
  },[metal,gem]);
  return <><Environment map={metal} environmentIntensity={1}/>{children(gem)}</>;
}
