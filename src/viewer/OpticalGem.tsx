import {useEffect,useLayoutEffect,useState} from 'react';
import type {BufferGeometry,Texture} from 'three';
import type {ThreeElements} from '@react-three/fiber';
import {createGemOptics,syncGemDraw,updateGemOptics,type GemOpticsOptions} from './gemOptics';
import type {Quality} from './quality';
import {STONE_APPEARANCES} from './stoneAppearance';

type Props=Omit<ThreeElements['mesh'],'geometry'|'material'>&{
  geometry:BufferGeometry;environment:Texture;quality:Quality;simplified:boolean;options?:GemOpticsOptions;onReady?:()=>void;
};
export function OpticalGem({geometry,environment,quality,simplified,options,onReady,...props}:Props){
  const [built,setOwned]=useState<{geometry:BufferGeometry;environment:Texture;quality:Quality;value:ReturnType<typeof createGemOptics>}|null>(null);
  const owned=built?.geometry===geometry&&built.environment===environment&&built.quality===quality?built.value:null;
  useEffect(()=>{
    if(simplified){setOwned(null);return;}
    const next=createGemOptics(geometry,environment,quality);setOwned({geometry,environment,quality,value:next});
    return ()=>next.dispose();
  },[geometry,environment,quality,simplified]);
  useLayoutEffect(()=>{if(owned)updateGemOptics(owned.material,options);},[owned,options]);
  useEffect(()=>{if(simplified||owned)onReady?.()},[simplified,owned,onReady]);
  const appearance=STONE_APPEARANCES[options?.appearance??'diamond'];
  if(simplified)return <mesh {...props} geometry={geometry}>
    <meshPhysicalMaterial color="white" metalness={0} roughness={0.025} transmission={0.98} thickness={0.7} ior={appearance.ior} attenuationColor={appearance.transmittance} attenuationDistance={appearance.absorptionDistance}/>
  </mesh>;
  return owned&&<mesh {...props} geometry={geometry} material={owned.material} dispose={null}
    onBeforeRender={(renderer,_scene,camera)=>syncGemDraw(owned.material,renderer,camera)}/>;
}
