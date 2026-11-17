import {MeshPhysicalMaterial} from 'three';
/** Real-time metal display targets, not a substitute for measured 18K alloy BRDF. */
export const DISPLAY_ALLOYS={
  yellow:{label:'18K 黄金色',base:'#dbb36c'},
  rose:{label:'玫瑰金色',base:'#d6a28f'},
  silver:{label:'银白金属',base:'#ccd2d6'},
} as const;
export type Alloy=keyof typeof DISPLAY_ALLOYS;
export function polishedGoldLikeMaterial(color:string,roughness=.15){
  return new MeshPhysicalMaterial({
    color,metalness:1,roughness,envMapIntensity:1.85,
    // Subtle grain direction causes elongated reflections, not brushed-metal stripes.
    anisotropy:.08,anisotropyRotation:.36,
    clearcoat:0,
  });
}
export function metalAppearanceProps(color:string,roughness=.15){
  return {color,metalness:1,roughness,envMapIntensity:1.85,
    anisotropy:.08,anisotropyRotation:.36,clearcoat:0} as const;
}
