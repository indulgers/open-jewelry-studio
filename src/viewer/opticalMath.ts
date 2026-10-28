/** CPU reference for the same lossless dielectric interface used in the shader. */
export function dielectricFresnel(cosIncident:number,etaIncident:number,etaTransmitted:number){
  if(![cosIncident,etaIncident,etaTransmitted].every(Number.isFinite)||etaIncident<=0||etaTransmitted<=0)throw new RangeError('Invalid optical interface');
  const c=Math.max(0,Math.min(1,Math.abs(cosIncident))),ratio=etaIncident/etaTransmitted;
  const sin2=ratio*ratio*(1-c*c);if(sin2>=1)return 1;
  const t=Math.sqrt(1-sin2),rs=(etaIncident*c-etaTransmitted*t)/(etaIncident*c+etaTransmitted*t),rp=(etaTransmitted*c-etaIncident*t)/(etaTransmitted*c+etaIncident*t);
  return (rs*rs+rp*rp)/2;
}
export function splitOpticalEnergy(remaining:number,fresnel:number){
  if(!Number.isFinite(remaining)||!Number.isFinite(fresnel)||remaining<0||remaining>1||fresnel<0||fresnel>1)throw new RangeError('Invalid optical energy');
  return {exit:remaining*(1-fresnel),reflected:remaining*fresnel};
}
