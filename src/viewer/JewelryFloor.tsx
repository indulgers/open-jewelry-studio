import {useEffect,useState} from 'react';
import {createPlanarFloor} from './planarFloor';
import {GROUND_Y} from './contactShadowResources';
import {qualitySettings,type Quality} from './quality';
import {STUDIO_PRESETS,type StudioPreset} from './studioPresets';
export function JewelryFloor({quality,simplified,preset=STUDIO_PRESETS.catalog}:{quality:Quality;simplified:boolean;preset?:StudioPreset}){
  const [owned,setOwned]=useState<ReturnType<typeof createPlanarFloor>|null>(null);
  const resolution=qualitySettings(quality).reflectionResolution;
  useEffect(()=>{
    if(simplified){setOwned(null);return;}
    const next=createPlanarFloor(resolution,GROUND_Y-0.004,preset.background,preset.floorReflection);setOwned(next);
    return ()=>next.dispose();
  },[resolution,simplified,preset]);
  return owned&&!simplified&&<primitive object={owned.reflector} dispose={null}/>;
}
