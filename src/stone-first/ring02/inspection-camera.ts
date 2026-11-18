import {MOUSE,TOUCH,type OrthographicCamera} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

export type DragMode='rotate'|'pan';

export function setInspectionDrag(orbit:OrbitControls,mode:DragMode){
  orbit.mouseButtons.LEFT=mode==='pan'?MOUSE.PAN:MOUSE.ROTATE;
  orbit.touches.ONE=mode==='pan'?TOUCH.PAN:TOUCH.ROTATE;
}

export function createInspectionOrbit(camera:OrthographicCamera,canvas:HTMLCanvasElement){
  const orbit=new OrbitControls(camera,canvas);
  orbit.screenSpacePanning=true;
  orbit.zoomToCursor=true;
  orbit.rotateSpeed=.8;
  orbit.touches.TWO=TOUCH.DOLLY_PAN;
  return orbit;
}
