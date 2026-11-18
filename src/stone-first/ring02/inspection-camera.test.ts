import {expect,it} from 'vitest';
import {OrthographicCamera,Vector3} from 'three';
import {createInspectionOrbit,setInspectionDrag} from './inspection-camera';

function cameraRig(){
  const canvas=document.createElement('canvas');
  document.body.append(canvas);
  Object.defineProperty(canvas,'clientWidth',{value:600});
  Object.defineProperty(canvas,'clientHeight',{value:400});
  canvas.getBoundingClientRect=()=>new DOMRect(0,0,600,400);
  canvas.setPointerCapture=()=>{};
  canvas.releasePointerCapture=()=>{};
  const camera=new OrthographicCamera(-3,3,2,-2,.01,100);
  camera.position.set(0,0,5);
  const orbit=createInspectionOrbit(camera,canvas);
  camera.updateMatrixWorld();
  return {canvas,camera,orbit,dispose:()=>{orbit.dispose();canvas.remove();}};
}

it('zooms into an off-centre prong without moving it away from the pointer',()=>{
  const {canvas,camera,dispose}=cameraRig();
  try{
    const point=new Vector3(1.5,1,0);
    const before=point.clone().project(camera);
    canvas.dispatchEvent(new WheelEvent('wheel',{clientX:450,clientY:100,deltaY:-100,cancelable:true}));
    expect(camera.zoom).toBeGreaterThan(1);
    const after=point.clone().project(camera);
    expect(after.x).toBeCloseTo(before.x,6);
    expect(after.y).toBeCloseTo(before.y,6);
  }finally{dispose();}
});

it('pans on primary drag in move mode and orbits in rotate mode',()=>{
  const {canvas,camera,orbit,dispose}=cameraRig();
  const drag=()=>{
    canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'mouse',pointerId:1,button:0,clientX:300,clientY:200,bubbles:true}));
    document.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',pointerId:1,button:0,clientX:365,clientY:205,bubbles:true}));
    document.dispatchEvent(new PointerEvent('pointerup',{pointerType:'mouse',pointerId:1,button:0,bubbles:true}));
  };
  try{
    setInspectionDrag(orbit,'pan');drag();
    expect(orbit.target.x).toBeLessThan(-.1);
    const orientation=camera.quaternion.clone(),target=orbit.target.clone();
    setInspectionDrag(orbit,'rotate');drag();
    expect(orbit.target.distanceTo(target)).toBeLessThan(.00001);
    expect(orientation.angleTo(camera.quaternion)).toBeGreaterThan(.1);
  }finally{dispose();}
});

it('zooms with two fingers around their off-centre midpoint on a tablet',()=>{
  const {canvas,camera,dispose}=cameraRig();
  const touch=(type:string,id:number,x:number)=>{
    const target=type==='pointerdown'?canvas:document;
    target.dispatchEvent(new PointerEvent(type,{pointerType:'touch',pointerId:id,clientX:x,clientY:100,bubbles:true}));
  };
  try{
    const point=new Vector3(1.5,1,0);
    const before=point.clone().project(camera);
    touch('pointerdown',1,420);touch('pointerdown',2,480);
    touch('pointermove',1,390);touch('pointermove',2,510);
    touch('pointerup',1,390);touch('pointerup',2,510);
    expect(camera.zoom).toBeGreaterThan(1.5);
    const after=point.clone().project(camera);
    // The browser delivers two consecutive moves for a symmetric pinch.
    expect(Math.abs(after.x-before.x)).toBeLessThan(.055);
    expect(Math.abs(after.y-before.y)).toBeLessThan(.01);
  }finally{dispose();}
});
