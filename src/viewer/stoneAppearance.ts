/**
 * Optical previews for the *isolated* center gem of the classic halo mount.
 * These are artistic material studies, NOT stock gemstone grading or a fitting
 * guarantee. The geometry and the metal seat remain the original asset.
 */
export const STONE_APPEARANCES={
  diamond:{name:'白钻',ior:2.42,transmittance:'#ffffff',absorptionDistance:1.8,dispersionScale:1},
  sapphire:{name:'蓝宝石',ior:1.762,transmittance:'#3c70bd',absorptionDistance:2.0,dispersionScale:0.3},
  ruby:{name:'红宝石',ior:1.77,transmittance:'#b9445a',absorptionDistance:1.9,dispersionScale:0.35},
  emerald:{name:'祖母绿',ior:1.58,transmittance:'#3e9b78',absorptionDistance:2.2,dispersionScale:0.28},
} as const;
export type StoneAppearance=keyof typeof STONE_APPEARANCES;
export const STONE_APPEARANCE_IDS=Object.keys(STONE_APPEARANCES) as StoneAppearance[];
export function stoneAppearance(id:StoneAppearance){return STONE_APPEARANCES[id];}
