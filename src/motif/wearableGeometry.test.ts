import {describe,it,expect} from 'vitest';
import {checkRingNominalClearance,necklaceAnchors,ringShoulders,ringSizing,visibleChainPoints} from './wearableGeometry';
const eps=1e-6;
describe('physical wearer-space contract',()=>{
  it.each([16,16.5,17.5,18,19,20,21])('keeps a continuous nominal %s mm finger passage',d=>{
    const fit=checkRingNominalClearance(d);
    expect(fit.boreNotInfilled).toBe(true);
    expect(fit.settingAboveBore).toBe(true);
    expect(fit.conservativeMinimum).toBeGreaterThanOrEqual(d-eps);
    const ring=ringSizing(d);
    expect(ring.outerRadius-ring.modeledInnerRadius).toBeCloseTo(1.5);
  });
  it('shoulder attach points stay on or outside the band exterior, never across the hole',()=>{
    const d=18;const bore=ringSizing(d).modeledInnerRadius;
    for(const arm of ringShoulders(d))for(const [x,y,z] of arm){
      expect([x,y,z].every(Number.isFinite)).toBe(true);
      expect(Math.hypot(y,z)).toBeGreaterThan(bore);
    }
  });
  it.each(['clover','butterfly','heart'] as const)('places both chain eyelets on distinct top shoulders of %s',motif=>{
    const {left,right}=necklaceAnchors(motif);
    expect(left[0]).toBeLessThan(0);expect(right[0]).toBeGreaterThan(0);
    expect(left[1]).toBeGreaterThan(0);expect(right[1]).toBeGreaterThan(0);
    for(const [side,anchor] of [[-1,left],[1,right]] as const){
      const path=visibleChainPoints(anchor,side);
      expect(path).toHaveLength(4);
      expect(path[0][1]).toBeLessThan(path[3][1]);
      expect(Math.abs(path[3][0])).toBeGreaterThan(Math.abs(path[0][0]));
    }
  });
  it('rejects incorrect physical sizes',()=>{
    expect(()=>ringSizing(5)).toThrow();expect(()=>ringSizing(32)).toThrow();
  });
});
