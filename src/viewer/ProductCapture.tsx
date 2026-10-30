import {useEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import type {OrbitControls} from 'three-stdlib';
import {PRODUCT_VIEWS,VIEW_LABELS,type ProductImage} from '../assets/productMedia';
import type {ModelMode} from '../assets/referenceManifest';
import {cameraView} from './cameraViews';

export function ProductCapture({request,contentKey,modelMode,simplified,ready,onImages,onProgress}:{
  request:number;contentKey:string;modelMode:ModelMode;simplified:boolean;ready:boolean;
  onImages:(images:ProductImage[])=>void;onProgress:(message:string)=>void;
}){
  const {gl,scene,camera,controls,size,invalidate}=useThree();
  const callbacks=useRef({onImages,onProgress});callbacks.current={onImages,onProgress};
  const cycle=useRef<{index:number;moving:boolean;frames:number;images:ProductImage[];restore:()=>void}|null>(null);
  const lastRequest=useRef(0);
  useEffect(()=>{
    if(!request){lastRequest.current=0;return;}
    if(request===lastRequest.current||!ready)return;
    lastRequest.current=request;
    const orbit=controls as OrbitControls|undefined,position=camera.position.clone(),quaternion=camera.quaternion.clone(),target=orbit?.target.clone(),enabled=orbit?.enabled;
    if(orbit)orbit.enabled=false;
    const restore=()=>{camera.position.copy(position);camera.quaternion.copy(quaternion);if(orbit&&target){orbit.target.copy(target);orbit.enabled=enabled!;orbit.update();}invalidate();};
    cycle.current={index:0,moving:true,frames:0,images:[],restore};invalidate();
    return()=>{if(cycle.current){cycle.current.restore();cycle.current=null;callbacks.current.onProgress('生成已取消，请重新生成当前配置。');}};
  },[request,ready,contentKey,modelMode,camera,controls,invalidate]);
  useFrame(()=>{
    // Normal mode draws through the composer at priority 1; fallback still needs a final draw.
    if(simplified)gl.render(scene,camera);
    const current=cycle.current;if(!current)return;
    const view=PRODUCT_VIEWS[current.index],orbit=controls as OrbitControls|undefined;
    if(current.moving){
      const next=cameraView(view,size.width<650,modelMode);camera.position.set(...next.position);
      if(orbit){orbit.target.set(...next.target);orbit.update();}else camera.lookAt(...next.target);
      camera.updateMatrixWorld();current.moving=false;current.frames=0;
      callbacks.current.onProgress(`正在生成 ${current.index+1}/4 · ${VIEW_LABELS[view]}`);invalidate();return;
    }
    current.frames++;
    if(current.frames>150){current.restore();cycle.current=null;callbacks.current.onProgress('画面尚未稳定，请停止操作后重试。');return;}
    if(current.frames<3||(!simplified&&Number(gl.domElement.dataset.refinementSamples??0)<32)){invalidate();return;}
    try{
      // The live canvas is transparent so the studio sweep can be styled in CSS.
      // Flatten onto paper for the downloadable product frame.
      const source=gl.domElement,flatten=document.createElement('canvas');
      flatten.width=source.width;flatten.height=source.height;
      const context=flatten.getContext('2d');
      if(!context)throw new Error('Missing 2D context');
      context.fillStyle='#ffffff';context.fillRect(0,0,flatten.width,flatten.height);
      context.drawImage(source,0,0);
      const url=flatten.toDataURL('image/jpeg',0.94);
      if(url==='data:,')throw new Error('Empty canvas');
      current.images.push({view,url,label:VIEW_LABELS[view]});current.index++;
      if(current.index===PRODUCT_VIEWS.length){
        current.restore();cycle.current=null;callbacks.current.onImages(current.images);callbacks.current.onProgress('4 张商品预览已生成，可逐张下载。');
      }else{current.moving=true;invalidate();}
    }catch{current.restore();cycle.current=null;callbacks.current.onProgress('图片生成失败，请重试或换用支持的浏览器。');}
  },2);
  return null;
}
