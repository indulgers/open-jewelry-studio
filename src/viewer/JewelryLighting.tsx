import {useEffect,useLayoutEffect,useState,type ReactNode} from 'react';
import {useLoader,useThree} from '@react-three/fiber';
import {EquirectangularReflectionMapping,LinearSRGBColorSpace,type Texture} from 'three';
import {EXRLoader} from 'three/addons/loaders/EXRLoader.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {REFERENCE_ASSETS} from '../assets/referenceManifest';
import {createStudioLighting} from './studioLighting';
import {STUDIO_PRESETS,type StudioPreset} from './studioPresets';

export const STUDIO_HDR = '/environments/studio_small_09_1k.hdr';

export function clearJewelryLightingCache(){
  useLoader.clear(EXRLoader,[REFERENCE_ASSETS.metalEnvironment,REFERENCE_ASSETS.gemEnvironment]);
  useLoader.clear(RGBELoader,STUDIO_HDR);
}

/**
 * Metal samples a real photographed studio HDR: broad white scrims and the dark
 * gaps between them are what make polished gold read as metal instead of beige
 * plastic. Gems keep the original high-contrast light-card env that produced the
 * facet fire, so the two media get the light each one needs.
 */
export function JewelryLighting({children,preset=STUDIO_PRESETS.catalog}:{children:(environment:Texture)=>ReactNode;preset?:StudioPreset}){
  const studioHdr=useLoader(RGBELoader,STUDIO_HDR);
  const scene=useThree(state=>state.scene);
  const [studio,setStudio]=useState<ReturnType<typeof createStudioLighting>|null>(null);
  useEffect(()=>{const owned=createStudioLighting(1024,512);setStudio(owned);return()=>owned.dispose();},[]);
  useLayoutEffect(()=>{
    studioHdr.mapping=EquirectangularReflectionMapping;
    studioHdr.colorSpace=LinearSRGBColorSpace;
    const previousMap=scene.environment,previousIntensity=scene.environmentIntensity,previousRotation=scene.environmentRotation.clone();
    scene.environment=studioHdr;
    scene.environmentIntensity=preset.metalIntensity*(preset.id==='catalog'?1.55:1.8);
    scene.environmentRotation.set(0,preset.rotation,0);
    return ()=>{scene.environment=previousMap;scene.environmentIntensity=previousIntensity;scene.environmentRotation.copy(previousRotation);};
  },[scene,studioHdr,preset]);
  return studio&&children(studio.gem);
}
