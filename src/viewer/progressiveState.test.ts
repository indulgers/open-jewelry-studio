import {describe,expect,it} from 'vitest';
import {Matrix4} from 'three';
import {movedSinceSample,nextRefinement,type RefinementState} from './progressiveState';

const initial:RefinementState={stableFrames:0,samples:0};
describe('idle rendering refinement',()=>{
  it('ignores the subpixel damping tail but resets once the motion adds up',()=>{
    const last=new Matrix4(),current=new Matrix4().makeTranslation(0.00001,0,0);
    expect(movedSinceSample(current,last)).toBe(false);
    current.makeTranslation(0.0001,0,0);
    expect(movedSinceSample(current,last)).toBe(true);
  });
  it('discards accumulated samples immediately when the camera or content changes',()=>{
    expect(nextRefinement({stableFrames:8,samples:23},true)).toMatchObject({
      state:{stableFrames:0,samples:0},reset:true,accumulate:false,requestFrame:true,
    });
  });
  it('converges to 32 samples and stops asking for more demand frames',()=>{
    let state=initial,result=nextRefinement(state,false);
    for(let i=0;i<40;i++){result=nextRefinement(state,false);state=result.state;}
    expect(state.samples).toBe(32);expect(result.requestFrame).toBe(false);
    expect(result.accumulate).toBe(true);
  });
  it('does not spend idle refinement frames while auto rotation is active',()=>{
    let state=initial;
    for(let i=0;i<40;i++)state=nextRefinement(state,true).state;
    expect(state.samples).toBe(0);
  });
});
