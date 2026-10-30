export type StudioPresetId='catalog'|'contrast';
export type StudioPreset={id:StudioPresetId;name:string;description:string;background:string;rotation:number;
  exposure:number;metalIntensity:number;gemIntensity:number;roughness:number;floorReflection:number;occlusion:number;dispersion:number};
export const STUDIO_PRESETS:Record<StudioPresetId,StudioPreset>={
  catalog:{id:'catalog',name:'柔光商品棚',description:'柔和白底，清楚呈现戒托与切面。',background:'#fbfaf7',rotation:0.55,
    exposure:0.87,metalIntensity:1.0,gemIntensity:1.0,roughness:0.15,floorReflection:0.025,occlusion:0.75,dispersion:0.006},
  contrast:{id:'contrast',name:'切面特写',description:'更明确的明暗对比与细微火彩。',background:'#f3f1eb',rotation:-0.45,
    exposure:0.87,metalIntensity:1.0,gemIntensity:1.1,roughness:0.1,floorReflection:0.08,occlusion:0.8,dispersion:0.009},
};
