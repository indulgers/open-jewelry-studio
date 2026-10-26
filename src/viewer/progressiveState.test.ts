import {describe,expect,it} from 'vitest';
import {nextRefinement,type RefinementState} from './progressiveState';

const initial:RefinementState={stableFrames:0,samples:0};
describe('idle rendering refinement',()=>{
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
