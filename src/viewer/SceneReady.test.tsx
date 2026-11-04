import {act,render} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {SceneReady} from './SceneReady';
const context=vi.hoisted(()=>({gl:{info:{render:{frame:0}}},invalidate:vi.fn()}));
vi.mock('@react-three/fiber',()=>({useThree:()=>context}));
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks()});
it('keeps interaction pending until the loaded scene has actually rendered',()=>{
  context.gl.info.render.frame=7;
  const frames:FrameRequestCallback[]=[];vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>{frames.push(cb);return frames.length});vi.stubGlobal('cancelAnimationFrame',vi.fn());
  const ready=vi.fn(),view=render(<SceneReady prepared={false} onReady={ready}/>);
  expect(context.invalidate).not.toHaveBeenCalled();
  view.rerender(<SceneReady prepared onReady={ready}/>);
  expect(ready).not.toHaveBeenCalled();
  act(()=>frames.shift()!(0));expect(ready).not.toHaveBeenCalled();
  context.gl.info.render.frame++;
  act(()=>frames.shift()!(16));expect(ready).toHaveBeenCalledOnce();
});
it('does not reveal a stale model when preparation changes before the frame',()=>{
  const frames:FrameRequestCallback[]=[];vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>{frames.push(cb);return frames.length});vi.stubGlobal('cancelAnimationFrame',vi.fn());
  const ready=vi.fn(),view=render(<SceneReady prepared onReady={ready}/>);
  view.rerender(<SceneReady prepared={false} onReady={ready}/>);
  context.gl.info.render.frame++;
  act(()=>frames.shift()!(16));
  expect(ready).not.toHaveBeenCalled();
});
