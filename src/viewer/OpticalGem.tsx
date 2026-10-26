import {useEffect,useState} from 'react';
import type {BufferGeometry,Texture} from 'three';
import type {ThreeElements} from '@react-three/fiber';
import {createGemOptics,syncGemDraw} from './gemOptics';
import type {Quality} from './quality';

type Props=Omit<ThreeElements['mesh'],'geometry'|'material'>&{
  geometry:BufferGeometry;environment:Texture;quality:Quality;simplified:boolean;
};
export function OpticalGem({geometry,environment,quality,simplified,...props}:Props){
  const [owned,setOwned]=useState<ReturnType<typeof createGemOptics>|null>(null);
  useEffect(()=>{
    if(simplified){setOwned(null);return;}
    const next=createGemOptics(geometry,environment,quality);setOwned(next);
    return ()=>next.dispose();
  },[geometry,environment,quality,simplified]);
  if(simplified)return <mesh {...props} geometry={geometry}>
    <meshPhysicalMaterial color="white" metalness={0} roughness={0.025} transmission={0.98} thickness={0.7} ior={2.42}/>
  </mesh>;
  return owned&&<mesh {...props} geometry={geometry} material={owned.material} dispose={null}
    onBeforeRender={(renderer,_scene,camera)=>syncGemDraw(owned.material,renderer,camera)}/>;
}
