import {useEffect,useMemo} from 'react';
import {useGLTF} from '@react-three/drei';
import type {Texture} from 'three';
import {atelierGem,type GemShapeId} from '../assets/atelierManifest';
import {firstMeshGeometry,normalizeLooseGem} from '../geometry/productGeometry';
import {OpticalGem} from './OpticalGem';
import type {Quality} from './quality';
import type {StudioPreset} from './studioPresets';
export function LooseGem({shape,environment,quality,simplified,onReady,preset}:{shape:GemShapeId;environment:Texture;quality:Quality;simplified:boolean;onReady:()=>void;preset:StudioPreset}){
  const gltf=useGLTF(atelierGem(shape).url);
  const geometry=useMemo(()=>{const source=firstMeshGeometry(gltf.scene);try{return normalizeLooseGem(source);}finally{source.dispose();}},[gltf.scene]);
  const options=useMemo(()=>({environmentRotation:preset.rotation,environmentIntensity:preset.gemIntensity,dispersion:preset.dispersion}),[preset]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <OpticalGem geometry={geometry} {...{environment,quality,simplified,options,onReady}}/>;
}
