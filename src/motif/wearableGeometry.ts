/**
 * Wearable assembly contract, all dimensions in millimetres.
 * These dimensions are visual engineering assumptions, not a casting specification.
 * The ring hole is along the world X axis; the top setting faces world +Y.
 * The necklace pendant faces world +Z, with links lying initially in the XY plane.
 */
import profiles from './profiles.json';
export type MotifId = keyof typeof profiles;
export type Point3 = readonly [number,number,number];
export type Point2 = readonly [number,number];

export const BAND_THICKNESS_MM = 1.5;
export const BAND_WIDTH_MM = 2.25;
export const SHANK_BEVEL_MM = 0.12;
export const RING_HOLE_MARGIN_MM = 0.18;

export function ringSizing(innerDiameter:number){
  if(!Number.isFinite(innerDiameter)||innerDiameter<15||innerDiameter>23)throw new RangeError('戒指内径必须在 15–23 mm 之间');
  const requestedInnerRadius=innerDiameter/2;
  const modeledInnerRadius=requestedInnerRadius+RING_HOLE_MARGIN_MM;
  const outerRadius=modeledInnerRadius+BAND_THICKNESS_MM;
  const motifSeatY=outerRadius+.45;
  return {
    requestedInnerDiameter:innerDiameter,
    modeledInnerRadius,outerRadius,motifSeatY,
    bandWidth:BAND_WIDTH_MM,bevel:SHANK_BEVEL_MM,
    minimumClearDiameter:2*(modeledInnerRadius-SHANK_BEVEL_MM),
  };
}
/** The end points overlap the shank and the metal base, not the bore. */
export function ringShoulders(innerDiameter:number):Point3[][]{
  const spec=ringSizing(innerDiameter);
  const z=2.75;
  const shankY=Math.sqrt(spec.outerRadius**2-z**2);
  return [-1,1].map(side=>[
    [0,shankY,side*z],
    [side*1.2,spec.outerRadius+.05,side*2.55],
    [side*2.55,spec.motifSeatY-.2,side*2.05],
  ] as Point3[]);
}
/** Locate mounting ears on the actual uploaded silhouette, not a fixed width guess. */
export function necklaceAnchors(motif:MotifId,scale=1):{left:Point3;right:Point3}{
  if(!Number.isFinite(scale)||scale<=0)throw new RangeError('invalid motif scale');
  const outline=profiles[motif].outline;
  const isClover=motif==='clover';
  const isButterfly=motif==='butterfly';
  const xTarget=isClover?5.35:isButterfly?6.7:5.2;
  const yTarget=isClover?3.05:isButterfly?5.45:4.9;
  const pointFor=(sign:number):Point3=>{
    const matching=outline.filter(p=>p[0]*sign>0);
    const nearest=matching.reduce((best,p)=>{
      const dist=(p[0]-sign*xTarget)**2+(p[1]-yTarget)**2;
      return dist<best.dist?{p,dist}:best;
    },{p:matching[0],dist:Infinity}).p;
    return [nearest[0]*scale,nearest[1]*scale,.58];
  };
  return {left:pointFor(-1),right:pointFor(1)};
}
/** Control points for a short visible segment of a full necklace; not rigid wires. */
export function visibleChainPoints(anchor:Point3,side:-1|1):Point3[]{
  const a=Math.abs(anchor[0]);
  return [
    [anchor[0]+side*.66,anchor[1]+.45,anchor[2]],
    [side*(a+2.4),anchor[1]+4.1,anchor[2]-.2],
    [side*(a+7.6),anchor[1]+13.9,anchor[2]-.55],
    [side*(a+12.3),anchor[1]+24.8,anchor[2]-.75],
  ];
}
export function checkRingNominalClearance(innerDiameter:number){
  const ring=ringSizing(innerDiameter);
  return {
    requested:innerDiameter,
    conservativeMinimum:ring.minimumClearDiameter,
    boreNotInfilled:ring.minimumClearDiameter>=innerDiameter,
    settingAboveBore:ring.motifSeatY-.92>ring.modeledInnerRadius,
  };
}
