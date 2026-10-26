export type Quality='standard'|'high';
export function qualitySettings(quality:Quality,simplified=false){
  const high=quality==='high';
  return {
    maxDpr:high?2:1.75,
    bounces:high?7:5,
    aberrationStrength:high?0.006:0.003,
    fastChroma:!high,
    reflectionResolution:simplified?0:high?1024:512,
    postprocessing:!simplified,
    shadowResolution:simplified?256:high?1024:512,
    shadowBlurPasses:!simplified&&high?2:1,
    bloomIntensity:high?0.025:0.015,
    multisampling:high?4:2,
  };
}
export type PerformanceSample={seconds:number;frames:number};
export function nextPerformanceSample(sample:PerformanceSample,delta:number,active:boolean){
  if(!active||!Number.isFinite(delta)||delta<=0||delta>0.2)
    return {sample:{seconds:0,frames:0},warn:false};
  const next={seconds:sample.seconds+delta,frames:sample.frames+1};
  return {sample:next,warn:next.seconds>=3&&next.frames/next.seconds<24};
}
