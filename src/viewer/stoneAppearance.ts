/**
 * Optical previews for the *isolated* center gem of the classic halo mount.
 * These are artistic material studies, NOT stock gemstone grading or a fitting
 * guarantee. The geometry and the metal seat remain the original asset.
 */
const WHITE_DIAMOND={name:'白钻',ior:2.42,transmittance:'#ffffff',absorptionDistance:1.8,dispersionScale:1} as const;
// Legacy identifiers remain readable so old drafts can be migrated without losing their geometry.
export const STONE_APPEARANCES={diamond:WHITE_DIAMOND,sapphire:WHITE_DIAMOND,ruby:WHITE_DIAMOND,emerald:WHITE_DIAMOND} as const;
export type StoneAppearance=keyof typeof STONE_APPEARANCES;
export const STONE_APPEARANCE_IDS:StoneAppearance[]=['diamond'];
export function stoneAppearance(_id:StoneAppearance){return WHITE_DIAMOND;}
export function hasLegacyGemColor(design:unknown){
 if(!design||typeof design!=='object')return false;
 return ['center','halo','shoulder'].some(zone=>{const v=(design as Record<string,unknown>)[zone];const id=typeof v==='string'?v:v&&typeof v==='object'?(v as Record<string,unknown>).appearance:undefined;return ['sapphire','ruby','emerald'].includes(String(id));});
}
