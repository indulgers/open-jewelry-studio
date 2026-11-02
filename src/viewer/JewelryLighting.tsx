import {useLayoutEffect,type ReactNode} from 'react';
import {useLoader,useThree} from '@react-three/fiber';
import {EquirectangularReflectionMapping,type Texture} from 'three';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {STUDIO_ENVIRONMENT} from './studioEnvironment';
import {STUDIO_PRESETS,type StudioPreset} from './studioPresets';

export function clearJewelryLightingCache(){
  useLoader.clear(HDRLoader,STUDIO_ENVIRONMENT.url);
}

export function JewelryLighting({children,preset=STUDIO_PRESETS.catalog}:{children:(environment:Texture)=>ReactNode;preset?:StudioPreset}){
  const studioHdr=useLoader(HDRLoader,STUDIO_ENVIRONMENT.url);
  const scene=useThree(state=>state.scene);
  useLayoutEffect(()=>{
    studioHdr.mapping=EquirectangularReflectionMapping;
    const previousMap=scene.environment,previousIntensity=scene.environmentIntensity,previousRotation=scene.environmentRotation.clone();
    scene.environment=studioHdr;
    scene.environmentIntensity=preset.metalIntensity;
    scene.environmentRotation.set(0,preset.rotation,0);
    return ()=>{scene.environment=previousMap;scene.environmentIntensity=previousIntensity;scene.environmentRotation.copy(previousRotation);};
  },[scene,studioHdr,preset]);
  return children(studioHdr);
}
