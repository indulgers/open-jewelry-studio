import {useEffect,useState,type ReactNode} from 'react';
import {Environment} from '@react-three/drei';
import {useLoader} from '@react-three/fiber';
import {type Texture} from 'three';
import {EXRLoader} from 'three/addons/loaders/EXRLoader.js';
import {REFERENCE_ASSETS} from '../assets/referenceManifest';
import {createStudioLighting} from './studioLighting';
import {STUDIO_PRESETS,type StudioPreset} from './studioPresets';

export function clearJewelryLightingCache(){
  useLoader.clear(EXRLoader,[REFERENCE_ASSETS.metalEnvironment,REFERENCE_ASSETS.gemEnvironment]);
}

export function JewelryLighting({children,preset=STUDIO_PRESETS.catalog}:{children:(environment:Texture)=>ReactNode;preset?:StudioPreset}){
  const [studio,setStudio]=useState<ReturnType<typeof createStudioLighting>|null>(null);
  useEffect(()=>{const owned=createStudioLighting(1024,512);setStudio(owned);return()=>owned.dispose();},[]);
  return studio&&<><Environment map={studio.metal} environmentIntensity={preset.metalIntensity}
    environmentRotation={[0,preset.rotation,0]}/>{children(studio.gem)}</>;
}
