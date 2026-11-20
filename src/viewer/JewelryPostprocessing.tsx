import {useEffect,useRef,type RefObject} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Box3,Color,Matrix4,Mesh,OrthographicCamera} from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {TAARenderPass} from 'three/addons/postprocessing/TAARenderPass.js';
import {liveResolve} from './liveResolve';
import {installAccentFilter} from './accentFilter';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {movedSinceSample,nextRefinement,type RefinementState} from './progressiveState';
import {qualitySettings,type Quality} from './quality';

type IdlePass=TAARenderPass&{accumulateIndex:number};
type Pipeline={composer:EffectComposer;taa:IdlePass|null;renderLive:(delta:number,moving:boolean,revision?:object)=>void;dispose:()=>void};

export function JewelryPostprocessing({quality,contentKey,capturing,whiteBackground=false,motion,sceneRevision}:{sceneRevision?:object;motion?:RefObject<{active:boolean;restore:()=>void}>;quality:Quality;contentKey:string;capturing:boolean;whiteBackground?:boolean}){
  const {gl,scene,camera,size,viewport,invalidate}=useThree();
  const pipeline=useRef<Pipeline|null>(null),state=useRef<RefinementState>({stableFrames:0,samples:0});
  const previous=useRef({key:'',world:new Matrix4(),projection:new Matrix4()});
  useEffect(()=>{
    const composer=new EffectComposer(gl);
    const pixelRatio=viewport.dpr;
    composer.setPixelRatio(pixelRatio);composer.setSize(size.width,size.height);
    const taa=capturing?new TAARenderPass(scene,camera) as IdlePass:null;
    const scenePass=taa??new RenderPass(scene,camera,undefined,whiteBackground?new Color(0):undefined,whiteBackground?0:undefined);
    if(taa){
      taa.sampleLevel=0;
      taa.unbiased=false;
    }else{
      // The live scene always writes to the composer's initial read buffer.
      composer.readBuffer.samples=Math.min(gl.capabilities.maxSamples,qualitySettings(quality).multisampling);
    }
    const output=new OutputPass();
    if(motion && whiteBackground && !capturing){
      installAccentFilter(output,composer.readBuffer);
    }
    // Four bilinear taps integrate isolated subpixel highlights over a small, fixed screen footprint.
    const resolve=capturing?null:liveResolve(composer.readBuffer.width,composer.readBuffer.height,whiteBackground);
    composer.addPass(scenePass);composer.addPass(output);
    if(resolve)composer.addPass(resolve);
    const viewProjection=new Matrix4(),cachedProjection=new Matrix4(),meshProjection=new Matrix4();
    const bounds=new Box3(),meshBounds=new Box3();
    let cachedRevision:object|undefined;
    function renderLive(delta:number,inMotion:boolean,revision?:object){
      camera.updateMatrixWorld();
      viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      const pan=resolve?.uniforms.panOffset.value;
      const cacheable=!!(motion&&resolve&&whiteBackground&&revision&&camera instanceof OrthographicCamera);
      if(inMotion&&cacheable&&cachedRevision===revision){
        const old=cachedProjection.elements,now=viewProjection.elements;
        // Orthographic translation adds a constant screen offset at every depth.
        const dx=(old[12]-now[12])*.5,dy=(old[13]-now[13])*.5;
        const translationOnly=old.every((value,i)=>i===12||i===13||Math.abs(value-now[i])<1e-7);
        // A clipped mesh might enter from the newly exposed strip. Trace it normally.
        const covered=(dx<=0||bounds.max.x<1)&&(dx>=0||bounds.min.x>-1)
          &&(dy<=0||bounds.max.y<1)&&(dy>=0||bounds.min.y>-1);
        if(translationOnly&&covered){
          pan.set(dx,dy);
          // The two swapping passes leave the tone-mapped image in writeBuffer.
          try{resolve!.render(gl,composer.readBuffer,composer.writeBuffer,delta,false);}
          finally{pan.set(0,0);}
          gl.domElement.dataset.inspectionFrame='moving';
          gl.domElement.dataset.inspectionDraw='cached-pan';
          return;
        }
      }
      // Use the same display resolution, MSAA and output pass throughout the gesture.
      const sceneTexture=composer.readBuffer.texture;
      sceneTexture.userData.opticalMotion=inMotion;
      const background=scene.background;
      if(whiteBackground)scene.background=null;
      try{composer.render(delta);}finally{scene.background=background;sceneTexture.userData.opticalMotion=false;}
      if(motion){
        gl.domElement.dataset.inspectionFrame=inMotion?'moving':'settled';
        gl.domElement.dataset.inspectionDraw=inMotion?'traced-motion':'traced-full';
      }
      cachedRevision=!inMotion&&cacheable?revision:undefined;
      if(cachedRevision){
        cachedProjection.copy(viewProjection);
        bounds.makeEmpty();
        scene.traverseVisible(object=>{
          if(!(object instanceof Mesh))return;
          if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();
          meshProjection.multiplyMatrices(viewProjection,object.matrixWorld);
          bounds.union(meshBounds.copy(object.geometry.boundingBox!).applyMatrix4(meshProjection));
        });
      }
    }
    if(motion)motion.current.restore=()=>{
      if(gl.domElement.dataset.inspectionFrame==='moving')renderLive(0,false);
    };
    const owned={composer,taa,renderLive,dispose(){
      scenePass.dispose();output.dispose();resolve?.dispose();composer.dispose();
    }};
    pipeline.current=owned;state.current={stableFrames:0,samples:0};previous.current.key='';invalidate();
    return ()=>{pipeline.current=null;if(motion)motion.current.restore=()=>{};owned.dispose();};
  },[gl,scene,camera,size.width,size.height,viewport.dpr,quality,capturing,whiteBackground,invalidate,motion]);

  // Priority 1 owns the final draw, after OrbitControls and contact-shadow capture.
  useFrame((_,delta)=>{
    const current=pipeline.current;
    if(!current){gl.render(scene,camera);invalidate();return;}
    if(!current.taa){
      current.renderLive(delta,!!motion?.current.active,sceneRevision);
      gl.domElement.dataset.refinementSamples='0';
      return;
    }
    camera.updateMatrixWorld();
    const objects:string[]=[];
    scene.traverse(object=>{
      if(object instanceof Mesh)objects.push(object.geometry.uuid,...(Array.isArray(object.material)?object.material:[object.material]).map(m=>m.uuid));
    });
    const key=`${contentKey}/${scene.environment?.uuid}/${objects.join('/')}`;
    const cameraMoved=movedSinceSample(camera.matrixWorld,previous.current.world);
    const sameContent=previous.current.key===key;
    const changed=!sameContent||cameraMoved
      ||!previous.current.projection.equals(camera.projectionMatrix);
    if(changed){
      previous.current.key=key;previous.current.world.copy(camera.matrixWorld);previous.current.projection.copy(camera.projectionMatrix);
    }
    const next=nextRefinement(state.current,changed);state.current=next.state;
    if(next.reset)current.taa.accumulateIndex=-1;
    current.taa.accumulate=next.accumulate;
    // This is static jitter accumulation, not motion-reprojected TAA.
    current.composer.render(delta);
    gl.domElement.dataset.refinementSamples=String(Math.max(0,current.taa.accumulateIndex));
    if(next.requestFrame)invalidate();
  },1);
  return null;
}
