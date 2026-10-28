import {expect,it} from 'vitest';
import {dielectricFresnel,splitOpticalEnergy} from './opticalMath';
it('conserves interface energy and treats critical angles as total reflection',()=>{
  expect(dielectricFresnel(1,1,2.42)).toBeCloseTo(((2.42-1)/(2.42+1))**2);
  expect(dielectricFresnel(Math.cos(Math.PI/4),2.42,1)).toBe(1);
  for(let i=0;i<=100;i++){const f=dielectricFresnel(i/100,2.42,1),energy=splitOpticalEnergy(0.8,f);expect(f).toBeGreaterThanOrEqual(0);expect(f).toBeLessThanOrEqual(1);expect(energy.exit+energy.reflected).toBeCloseTo(0.8);}
});
it('leaves trapped energy unassigned instead of inventing an environment escape',()=>{
  let throughput=1,exit=0;for(let i=0;i<5;i++){const step=splitOpticalEnergy(throughput,1);exit+=step.exit;throughput=step.reflected;}
  expect(exit).toBe(0);expect(throughput).toBe(1);
  expect(()=>dielectricFresnel(1,0,1)).toThrow();expect(()=>splitOpticalEnergy(1,NaN)).toThrow();
});
