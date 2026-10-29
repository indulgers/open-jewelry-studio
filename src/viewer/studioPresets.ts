export type StudioPresetId='catalog'|'contrast';
export type StudioPreset={id:StudioPresetId;name:string;description:string;background:string;rotation:number;
  exposure:number;metalIntensity:number;gemIntensity:number;roughness:number;floorReflection:number;occlusion:number;dispersion:number};
export const STUDIO_PRESETS:Record<StudioPresetId,StudioPreset>={
  catalog:{id:'catalog',name:'柔光商品棚',description:'柔和白底，清楚呈现戒托与切面。',background:'#f4f3ef',rotation:0.55,
    exposure:1,metalIntensity:1,gemIntensity:0.95,roughness:0.065,floorReflection:0.06,occlusion:0.65,dispersion:0.003},
  contrast:{id:'contrast',name:'切面特写',description:'更明确的明暗对比与细微火彩。',background:'#e6e5e2',rotation:-0.45,
    exposure:0.95,metalIntensity:0.9,gemIntensity:0.9,roughness:0.055,floorReflection:0.14,occlusion:0.72,dispersion:0.003},
};
