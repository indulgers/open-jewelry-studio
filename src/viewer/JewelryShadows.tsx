import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import type {Mesh} from 'three';
import type {Configuration} from '../configuration/configuration';
import {qualitySettings,type Quality} from './quality';
import {createContactShadowResources,renderContactShadow,GROUND_Y,type ContactShadowResources} from './contactShadowResources';

export function JewelryShadows({configuration,quality,simplified,contentKey,ready}:{
  configuration:Configuration;quality:Quality;simplified:boolean;contentKey:string;ready:boolean;
}){
  const {gl,scene,invalidate}=useThree();
  const ground=useRef<Mesh>(null),dirty=useRef(true);
  const [resources,setResources]=useState<ContactShadowResources|null>(null);
  const {shadowResolution,shadowBlurPasses}=qualitySettings(quality,simplified);
  useEffect(()=>{
    const owned=createContactShadowResources(shadowResolution);
    setResources(owned);invalidate();
    return ()=>owned.dispose();
  },[shadowResolution,invalidate]);
  useLayoutEffect(()=>{
    dirty.current=true;invalidate();
  },[configuration.shankStyle,configuration.stoneSize,resources,shadowBlurPasses,contentKey,ready,invalidate]);
  useFrame(()=>{
    if(!ready||!dirty.current||!resources||!ground.current)return;
    renderContactShadow(gl,scene,ground.current,resources,shadowBlurPasses);
    dirty.current=false;invalidate();
  });
  return resources&&<mesh ref={ground} position={[0,GROUND_Y,0]} rotation={[-Math.PI/2,0,0]}
    scale={[1,-1,1]} geometry={resources.planeGeometry} material={resources.displayMaterial} dispose={null}/>;
}
