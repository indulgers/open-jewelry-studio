import {expect,it} from 'vitest';
import {cameraView} from './cameraViews';
import {PerspectiveCamera,Vector3} from 'three';
it('shows the crown face-on and keeps the full shank in frame on both layouts',()=>{
  for(const compact of [false,true]){
    const view=cameraView('front',compact,'reference'),camera=new PerspectiveCamera(32,compact?300/470:900/740,0.1,50);
    camera.position.set(...view.position);camera.lookAt(...view.target);camera.updateMatrixWorld();
    expect(camera.getWorldDirection(new Vector3()).y).toBeLessThan(-0.99);
    expect(Math.abs(new Vector3(1.2,0,0).project(camera).x)).toBeLessThan(1);
  }
});
it('frames the gemstone rather than the ring centre in detail views',()=>{
  const full=cameraView('overall'),detail=cameraView('stone'),side=cameraView('side');
  expect(detail.target[1]).toBeGreaterThan(1.3);
  expect(side.target[1]).toBeGreaterThan(1.1);
  const distance=(v:typeof full)=>Math.hypot(...v.position.map((p,i)=>p-v.target[i]));
  expect(distance(detail)).toBeLessThan(distance(full)/2);
  expect(Math.abs(side.position[1]-side.target[1])).toBeLessThan(0.2);
});
it('leaves room for the mobile heading in the overall view',()=>{
  const normal=cameraView('overall'),compact=cameraView('overall',true);
  expect(Math.hypot(...compact.position)).toBeGreaterThan(Math.hypot(...normal.position)*1.2);
  expect(compact.target).toEqual(normal.target);
});
it('pulls back compact close-ups so the crown does not fill the entire narrow viewer',()=>{
  const full=cameraView('stone'),compact=cameraView('stone',true);
  const distance=(v:typeof full)=>Math.hypot(...v.position.map((p,i)=>p-v.target[i]));
  expect(distance(compact)).toBeGreaterThan(distance(full)*1.25);
  expect(compact.target).toEqual(full.target);
});
it('reserves the upper fifth of the compact preview for its overlaid heading',()=>{
  const view=cameraView('overall',true),camera=new PerspectiveCamera(32,300/470,0.1,50);
  camera.position.set(...view.position);camera.lookAt(...view.target);camera.updateMatrixWorld();
  const crownTop=new Vector3(0,1.75,0).project(camera);
  expect(crownTop.y).toBeLessThan(0.6);
});
it('leaves header and reflection space around the taller reference assembly',()=>{
  for(const compact of [false,true]){
    const view=cameraView('overall',compact,'reference'),camera=new PerspectiveCamera(32,compact?300/470:728/740,0.1,50);
    camera.position.set(...view.position);camera.lookAt(...view.target);camera.updateMatrixWorld();
    // Catalogue framing keeps the product large; compact mode still clears the
    // overlaid mobile heading, so it is held to a tighter top margin.
    expect(new Vector3(0,1.68,0).project(camera).y).toBeLessThan(compact?0.62:0.8);
    expect(new Vector3(0,-1.287,0).project(camera).y).toBeGreaterThan(-0.62);
  }
});
it('centres the new mounted stone and keeps its halo inside reference close-ups',()=>{
  for(const kind of ['stone','side'] as const){
    for(const compact of [false,true]){
      const view=cameraView(kind,compact,'reference'),camera=new PerspectiveCamera(32,compact?300/470:786/961,0.1,50);
      camera.position.set(...view.position);camera.lookAt(...view.target);camera.updateMatrixWorld();
      // Actual atelier sample centre after its ground alignment is approximately Y=1.08.
      const centre=new Vector3(0,1.08,0).project(camera);
      expect(Math.abs(centre.y)).toBeLessThan(0.25);
      for(const x of [-0.57,0.57])expect(Math.abs(new Vector3(x,1.08,0).project(camera).x)).toBeLessThan(0.92);
    }
  }
});

it('offers a real close-up for the original ring pavé details',()=>{
  const normal=cameraView('overall',false,'reference');
  const close=cameraView('pave',false,'reference');
  const distance=(v:typeof normal)=>Math.hypot(...v.position.map((p,i)=>p-v.target[i]));
  expect(distance(close)).toBeLessThan(distance(normal)*0.6);
  expect(close.target[0]).toBeGreaterThan(0);
  expect(close.target[1]).toBeGreaterThan(1);
  expect(distance(cameraView('pave',true,'reference'))).toBeGreaterThan(distance(close));
});
