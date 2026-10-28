export type StudioPresetId='catalog'|'contrast';
export type StudioPreset={id:StudioPresetId;name:string;description:string;background:string;rotation:number;
  exposure:number;metalIntensity:number;gemIntensity:number;roughness:number;floorReflection:number;occlusion:number;dispersion:number};
export const STUDIO_PRESETS:Record<StudioPresetId,StudioPreset>={
  catalog:{id:'catalog',name:'柔光商品棚',description:'柔和白底，清楚呈现戒托与切面。',background:'#f4f3ef',rotation:0.55,
    exposure:1,metalIntensity:1.05,gemIntensity:1.1,roughness:0.16,floorReflection:0.09,occlusion:0.65,dispersion:0.004},
  contrast:{id:'contrast',name:'切面特写',description:'更明确的明暗对比与细微火彩。',background:'#e6e5e2',rotation:-0.45,
    exposure:0.95,metalIntensity:0.95,gemIntensity:1.05,roughness:0.115,floorReflection:0.22,occlusion:0.72,dispersion:0.004},
};
