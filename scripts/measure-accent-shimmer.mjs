// Vite-served acceptance helper. Measure the same visible points on the same
// facets as the camera turns. Reading fixed screen coordinates would instead
// count jewelry crossing a pixel and occlusion by the metal setting as flicker.
import {_roots} from '@react-three/fiber';
import {Mesh,Raycaster,Vector2} from 'three';
import {MeshBVH,acceleratedRaycast} from 'three-mesh-bvh';

const nextFrame=()=>new Promise(requestAnimationFrame);
const zones=['halo','shoulder'];

function luminanceAt(pixels,width,height,position){
  const x=(position.x*.5+.5)*width-.5,y=(.5-position.y*.5)*height-.5;
  const left=Math.floor(x),top=Math.floor(y);
  if(left<0||top<0||left+1>=width||top+1>=height)return null;
  function luminance(ix,iy){
    const i=(width*iy+ix)*4;
    return pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722;
  }
  const fx=x-left,fy=y-top;
  return (1-fy)*((1-fx)*luminance(left,top)+fx*luminance(left+1,top))
    +fy*((1-fx)*luminance(left,top+1)+fx*luminance(left+1,top+1));
}

function zoneStatistics(probes){
  const jumps=[],light=[];
  for(const {values} of probes){
    light.push(...values.filter(value=>value!==null));
    for(let i=2;i<values.length;i++){
      const [a,b,c]=values.slice(i-2,i+1);
      // A constant-rate brightness change contributes zero; reversals and
      // abrupt changes in slope measure the visible on/off sparkle.
      if(a!==null&&b!==null&&c!==null)jumps.push(Math.abs(a-2*b+c));
    }
  }
  const sorted=(a,b)=>a-b;
  jumps.sort(sorted);light.sort(sorted);
  const at=(data,p)=>data[Math.floor(p*data.length)];
  return {count:jumps.length,p95:at(jumps,.95),contrast:at(light,.9)-at(light,.1)};
}

export function createShimmerProbe(canvas){
  const {scene,camera}=_roots.get(canvas).store.getState();
  const ray=new Raycaster(),ndc=new Vector2(),occluders=[],gems=[],geometryCopies=new Map();
  ray.firstHitOnly=true;
  // A test-only collision scene avoids replacing raycast/boundsTree on any
  // live object. During inspection the camera moves and the jewelry is fixed.
  scene.traverseVisible(source=>{
    if(!source.isMesh)return;
    let geometry=geometryCopies.get(source.geometry);
    if(!geometry){
      geometry=source.geometry.clone();
      geometry.boundsTree=new MeshBVH(geometry,{indirect:true});
      geometryCopies.set(source.geometry,geometry);
    }
    const mesh=new Mesh(geometry,source.material);
    mesh.raycast=acceleratedRaycast;
    mesh.matrixWorld.copy(source.matrixWorld);
    occluders.push(mesh);
    const zone=zones.find(zone=>source.name.includes(zone));
    if(zone&&source.material.uniforms?.stoneDiameter)gems.push({source,mesh,zone});
  });
  const closest=(x,y)=>{
    ray.setFromCamera(ndc.set(x,y),camera);
    return ray.intersectObjects(occluders,false)[0];
  };
  const probes=[];
  for(const {mesh,zone} of gems){
    mesh.geometry.computeBoundingSphere();
    const sphere=mesh.geometry.boundingSphere;
    const center=sphere.center.clone().applyMatrix4(mesh.matrixWorld).project(camera);
    const radius=sphere.radius*mesh.matrixWorld.getMaxScaleOnAxis();
    for(const dy of [-.35,0,.35])for(const dx of [-.35,0,.35]){
      const hit=closest(center.x+dx*radius*camera.projectionMatrix.elements[0],
                        center.y+dy*radius*camera.projectionMatrix.elements[5]);
      if(hit?.object===mesh)probes.push({point:hit.point,mesh,zone,values:[]});
    }
  }
  const read=document.createElement('canvas');
  read.width=canvas.width;read.height=canvas.height;
  const ctx=read.getContext('2d',{willReadFrequently:true});
  const originalCallbacks=new Map();
  let lastCamera,pointer;
  const rememberPointer=event=>{pointer={pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY};};
  canvas.addEventListener('pointerdown',rememberPointer);
  function restore(){
    for(const [mesh,callback] of originalCallbacks)mesh.onBeforeRender=callback;
    originalCallbacks.clear();
  }
  return {
    begin(reference){
      restore();
      for(const probe of probes)probe.values=[];
      pointer=undefined;
      lastCamera=camera.matrixWorld.clone();
      if(!reference)return;
      // Control changes only which pixels the final accent filter selects.
      // Optical paths, projected coverage, tone mapping, and gesture stay equal.
      for(const {source} of gems){
        const original=source.onBeforeRender;
        originalCallbacks.set(source,original);
        source.onBeforeRender=function(...args){
          original.apply(this,args);
          this.material.uniforms.accentTag.value=0;
        };
      }
    },
    async sample(step){
      if(!pointer)throw Error('No active mouse gesture');
      // Real pointer-down/up exercise capture. Fractional steps are dispatched
      // on the DOM canvas so CDP cannot quantize them to whole device pixels.
      canvas.dispatchEvent(new PointerEvent('pointermove',{
        bubbles:true,pointerType:'mouse',isPrimary:true,buttons:1,button:-1,pointerId:pointer.pointerId,
        clientX:pointer.clientX+step*.3,clientY:pointer.clientY+step*.07,
      }));
      await nextFrame();await nextFrame();
      if(canvas.dataset.inspectionDraw!=='traced-motion')throw Error('Expected a rendered rotation');
      if(camera.matrixWorld.equals(lastCamera))throw Error('Gesture did not advance the camera');
      lastCamera.copy(camera.matrixWorld);
      ctx.drawImage(canvas,0,0);
      const {width,height}=read,pixels=ctx.getImageData(0,0,width,height).data;
      for(const {point,mesh,values} of probes){
        const projected=point.clone().project(camera);
        const hit=closest(projected.x,projected.y);
        const visible=hit?.object===mesh&&hit.point.distanceTo(point)<.0005;
        values.push(visible?luminanceAt(pixels,width,height,projected):null);
      }
    },
    result(){return Object.fromEntries(zones.map(zone=>[zone,zoneStatistics(probes.filter(probe=>probe.zone===zone))]));},
    dispose(){
      restore();
      canvas.removeEventListener('pointerdown',rememberPointer);
      for(const geometry of geometryCopies.values())geometry.dispose();
    }
  };
}
