import {BufferGeometry,Float32BufferAttribute} from 'three';
import {ringSizing,BAND_THICKNESS_MM} from './wearableGeometry';

/**
 * Comfort-fit sweep around a YZ-plane circular finger passage.
 * Unlike extruding a flat annulus, the side and inner walls have a smooth
 * rounded cross-section; the upper shoulder is tapered continuously.
 * Separate metal-to-motif joins still require real CAD fusion.
 */
export const SHANK_PARAMETERS={
  radialWallMm:BAND_THICKNESS_MM,
  minRoundRadiusMm:.12,
  nominalWidthMm:2.25,
  shoulderWidthBoostMm:.42,
  shoulderWallBoostMm:.32,
  resolutionAround:160,
  cornerSteps:5,
} as const;
type Pair=readonly [number,number];
function roundedProfile(halfWidth:number,innerRadius:number,outerRadius:number,bevel:number):Pair[]{
  const corners:Array<[number,number,number,number]>=[
    [halfWidth-bevel,outerRadius-bevel,Math.PI/2,0],
    [halfWidth-bevel,innerRadius+bevel,0,-Math.PI/2],
    [-halfWidth+bevel,innerRadius+bevel,-Math.PI/2,-Math.PI],
    [-halfWidth+bevel,outerRadius-bevel,Math.PI,Math.PI/2],
  ];
  const arr:Pair[]=[];
  for(const [x,r,start,end] of corners)for(let i=0;i<=SHANK_PARAMETERS.cornerSteps;i++){
    const angle=start+(end-start)*i/SHANK_PARAMETERS.cornerSteps;
    arr.push([x+bevel*Math.cos(angle),r+bevel*Math.sin(angle)]);
  }
  return arr;
}
export function createComfortFitShank(innerDiameter:number):BufferGeometry{
  const spec=ringSizing(innerDiameter),thetaSteps=SHANK_PARAMETERS.resolutionAround;
  const crossSections:Pair[][]=[];
  const positions:number[]=[];
  for(let i=0;i<thetaSteps;i++){
    let a=2*Math.PI*i/thetaSteps;
    if(a>Math.PI)a-=2*Math.PI;
    const envelope=Math.exp(-Math.pow(a/.48,4));
    const halfWidth=(SHANK_PARAMETERS.nominalWidthMm+SHANK_PARAMETERS.shoulderWidthBoostMm*envelope)/2;
    const outer=spec.outerRadius+SHANK_PARAMETERS.shoulderWallBoostMm*envelope;
    const cross=roundedProfile(halfWidth,spec.modeledInnerRadius,outer,SHANK_PARAMETERS.minRoundRadiusMm);
    crossSections.push(cross);
    const theta=2*Math.PI*i/thetaSteps;
    for(const [x,radius] of cross){
      positions.push(x,radius*Math.cos(theta),radius*Math.sin(theta));
    }
  }
  const perSection=crossSections[0].length;
  const index:number[]=[];
  for(let i=0;i<thetaSteps;i++)for(let j=0;j<perSection;j++){
    const a=i*perSection+j;
    const b=((i+1)%thetaSteps)*perSection+j;
    const c=((i+1)%thetaSteps)*perSection+(j+1)%perSection;
    const d=i*perSection+(j+1)%perSection;
    index.push(a,b,c,a,c,d);
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}
export function comfortFitDiagnostics(innerDiameter:number){
  const spec=ringSizing(innerDiameter);
  return {
    nominalInnerDiameterMm:innerDiameter,
    conservativeClearDiameterMm:spec.minimumClearDiameter,
    radialWallMinimumMm:SHANK_PARAMETERS.radialWallMm,
    bandWidthMm:SHANK_PARAMETERS.nominalWidthMm,
    roundedEdgeMm:SHANK_PARAMETERS.minRoundRadiusMm,
    upperShoulderWallMm:SHANK_PARAMETERS.radialWallMm+SHANK_PARAMETERS.shoulderWallBoostMm,
    preliminaryBorePass:spec.minimumClearDiameter>=innerDiameter,
    manufacturingGrade:false,
  };
}
