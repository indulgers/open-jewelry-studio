const halfFov = 39*Math.PI/360;
export function viewHalfHeight(cam,canvas){return cam.distance*Math.tan(halfFov)/Math.min(1,canvas.clientWidth/canvas.clientHeight);}
export function home(r,ring){
  const small=r.canvas.clientWidth<520;
  r.camera={yaw:ring?.59:0,pitch:ring?.45:.04,distance:ring?(small?35:32):(small?109:86),
    target:[0,ring?0:-1,0],projection:r.camera?.projection||'ortho'};
}
export function orient(cam,view) {
  [cam.yaw,cam.pitch]=({front:[0,0],top:[0,Math.PI/2],right:[Math.PI/2,0]})[view];
}
export function basis(cam){
  const c=Math.cos(cam.yaw),s=Math.sin(cam.yaw),u=Math.cos(cam.pitch),v=Math.sin(cam.pitch);
  return {right:[c,0,-s],up:[-s*v,u,-c*v],back:[s*u,v,c*u]};
}
export function bindCamera(r,onOrbit){
  const el=r.canvas, pts=new Map(), redraw=()=>r.fallback&&r.draw();
  function pan(dx,dy){
    const cam=r.camera, {right,up}=basis(cam),scale=2*viewHalfHeight(cam,el)/el.clientHeight;
    cam.target=cam.target.map((v,i)=>v+scale*(-dx*right[i]+dy*up[i]));
  }
  function zoom(k){r.camera.distance=Math.max(19,Math.min(180,r.camera.distance*k));}
  el.addEventListener('contextmenu',e=>e.preventDefault());
  el.addEventListener('pointerdown',e=>{
    if(pts.size>=2)return;
    e.preventDefault();el.setPointerCapture(e.pointerId);pts.set(e.pointerId,[e.clientX,e.clientY]);
  });
  el.addEventListener('pointermove',e=>{
    const prev=pts.get(e.pointerId);if(!prev)return;
    const x=e.clientX,y=e.clientY,dx=x-prev[0],dy=y-prev[1];
    if(pts.size===2){
      const other=[...pts].find(([id])=>id!==e.pointerId)[1];
      const a=Math.hypot(prev[0]-other[0],prev[1]-other[1]),b=Math.hypot(x-other[0],y-other[1]);
      pan(dx/2,dy/2);if(a>1&&b>1)zoom(a/b);
    }else if(e.buttons===2||e.buttons===4||e.shiftKey)pan(dx,dy);
    else{
      r.camera.yaw-=dx*.008;r.camera.pitch=Math.max(-Math.PI/2,Math.min(Math.PI/2,r.camera.pitch+dy*.007));onOrbit();
    }
    pts.set(e.pointerId,[x,y]);redraw();
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,e=>pts.delete(e.pointerId));
  el.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(e.deltaY*(e.deltaMode===1?.016:.001)));redraw();},{passive:false});
  el.addEventListener('dblclick',()=>r.reset());
}
