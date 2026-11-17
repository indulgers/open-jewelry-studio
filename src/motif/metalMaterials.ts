import {MeshPhysicalMaterial} from 'three';
/** Real-time metal display targets, not a substitute for measured 18K alloy BRDF. */
export const DISPLAY_ALLOYS={
  yellow:{label:'18K 黄金色',base:'#cda05a'},
  rose:{label:'玫瑰金色',base:'#c99783'},
  silver:{label:'银白金属',base:'#c4ccd2'},
} as const;
export type Alloy=keyof typeof DISPLAY_ALLOYS;
export function polishedGoldLikeMaterial(color:string,roughness=.15){
  return new MeshPhysicalMaterial({
    color,metalness:1,roughness,envMapIntensity:1.05,
    // Subtle grain direction causes elongated reflections, not brushed-metal stripes.
    anisotropy:.02,anisotropyRotation:.36,
    clearcoat:0,
  });
}
export function metalAppearanceProps(color:string,roughness=.15){
  return {color,metalness:1,roughness,envMapIntensity:1.05,
    anisotropy:.02,anisotropyRotation:.36,clearcoat:0} as const;
}
