import {it,expect} from 'vitest';
import {home,orient,basis,bindCamera} from '../public/forme/camera.js';

it('orbits, pans in the view plane, and pinch zooms without spinning the model',()=>{
  const canvas=document.createElement('canvas');
  Object.defineProperty(canvas,'clientHeight',{value:500});canvas.setPointerCapture=()=>{};
  const r={canvas};home(r,true);bindCamera(r,()=>{});
  function send(type,id,x,y,buttons=1){
    const e=new MouseEvent('pointer'+type,{clientX:x,clientY:y,buttons});
    Object.defineProperty(e,'pointerId',{value:id});canvas.dispatchEvent(e);
  }
  send('down',1,0,0);send('move',1,25,10);send('up',1,25,10);
  expect(r.camera.yaw).not.toBe(.59);
  orient(r.camera,'top');expect(basis(r.camera).back[1]).toBe(1);
  send('down',1,0,0,2);send('move',1,30,10,2);send('up',1,30,10,2);
  expect(r.camera.target[0]).toBeLessThan(0);expect(r.camera.target[1]).toBeCloseTo(0);
  const before=r.camera.distance;
  send('down',1,0,0);send('down',2,50,0);send('move',2,100,0);
  expect(r.camera.distance).toBeCloseTo(before/2);expect(r.camera.pitch).toBe(Math.PI/2);
  send('cancel',2,100,0);send('move',2,200,10);expect(r.camera.distance).toBeCloseTo(before/2);
});
