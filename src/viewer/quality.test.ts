import {describe, expect, it} from 'vitest';
import {qualitySettings, nextPerformanceSample} from './quality';
describe('quality budgets',()=>{
  it('gives standard quality a lower pixel and reflection budget',()=>{
    expect(qualitySettings('standard').maxDpr).toBeLessThan(qualitySettings('high').maxDpr);
    expect(qualitySettings('standard').bounces).toBeLessThan(qualitySettings('high').bounces);
    expect(qualitySettings('standard').reflectionResolution).toBeLessThan(qualitySettings('high').reflectionResolution);
  });
  it('turns off postprocessing and reduces the shadow target in compatibility mode',()=>{
    for(const quality of ['standard','high'] as const){
      expect(qualitySettings(quality,true)).toMatchObject({postprocessing:false,shadowResolution:256,shadowBlurPasses:1,reflectionResolution:0});
    }
  });
  it('increases shadow precision only in high quality',()=>{
    const standard=qualitySettings('standard'),high=qualitySettings('high');
    expect(standard).toMatchObject({postprocessing:true});
    expect(high.shadowResolution).toBeGreaterThan(standard.shadowResolution);
    expect(high.shadowBlurPasses).toBeGreaterThan(standard.shadowBlurPasses);
  });
  it('warns for sustained active slow frames, not paused or hidden pages',()=>{
    let sample={seconds:0,frames:0};
    for(let i=0;i<65;i++)sample=nextPerformanceSample(sample,0.05,true).sample;
    expect(nextPerformanceSample(sample,0.05,true).warn).toBe(true);
    expect(nextPerformanceSample(sample,3,false).warn).toBe(false);
    expect(nextPerformanceSample(sample,3,true).warn).toBe(false);
  });
});
