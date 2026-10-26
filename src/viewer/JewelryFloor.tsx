import {useEffect,useState} from 'react';
import {createPlanarFloor} from './planarFloor';
import {GROUND_Y} from './contactShadowResources';
import {qualitySettings,type Quality} from './quality';
export function JewelryFloor({quality,simplified}:{quality:Quality;simplified:boolean}){
  const [owned,setOwned]=useState<ReturnType<typeof createPlanarFloor>|null>(null);
  const resolution=qualitySettings(quality).reflectionResolution;
  useEffect(()=>{
    if(simplified){setOwned(null);return;}
    const next=createPlanarFloor(resolution,GROUND_Y-0.004);setOwned(next);
    return ()=>next.dispose();
  },[resolution,simplified]);
  return owned&&!simplified&&<primitive object={owned.reflector} dispose={null}/>;
}
