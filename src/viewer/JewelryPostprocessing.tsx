import {useEffect,useRef,type RefObject} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Color,Matrix4,Mesh} from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {TAARenderPass} from 'three/addons/postprocessing/TAARenderPass.js';
import {liveResolve} from './liveResolve';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {movedSinceSample,nextRefinement,type RefinementState} from './progressiveState';
import {qualitySettings,type Quality} from './quality';

type IdlePass=TAARenderPass&{accumulateIndex:number};
type Pipeline={composer:EffectComposer;moving:EffectComposer|null;taa:IdlePass|null;dispose:()=>void};

export function JewelryPostprocessing({quality,contentKey,capturing,whiteBackground=false,motion}:{motion?:RefObject<{active:boolean;restore:()=>void}>;quality:Quality;contentKey:string;capturing:boolean;whiteBackground?:boolean}){
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
    // Four bilinear taps integrate isolated subpixel highlights over a small, fixed screen footprint.
    const resolve=capturing?null:liveResolve(composer.readBuffer.width,composer.readBuffer.height,whiteBackground);
    composer.addPass(scenePass);composer.addPass(output);
    if(resolve)composer.addPass(resolve);
    // Keep both target sizes allocated across gestures. Resizing the live targets on
    // every pointer event would stall the GPU and disturb a saved inspection frame.
    const moving=motion&&!capturing?new EffectComposer(gl):null;
    const movingScene=moving?new RenderPass(scene,camera,undefined,whiteBackground?new Color(0):undefined,0):null;
    const movingOutput=moving?new OutputPass():null;
    let movingResolve:ReturnType<typeof liveResolve>|undefined;
    if(moving&&movingScene&&movingOutput){
      moving.setPixelRatio(Math.min(1,pixelRatio*.7));
      moving.setSize(size.width,size.height);
      moving.readBuffer.texture.userData.movingInspection=true;
      moving.writeBuffer.texture.userData.movingInspection=true;
      movingResolve=liveResolve(moving.readBuffer.width,moving.readBuffer.height,whiteBackground);
      moving.addPass(movingScene);
      moving.addPass(movingOutput);
      moving.addPass(movingResolve);
    }
    if(motion)motion.current.restore=()=>{
      if(gl.domElement.dataset.inspectionFrame!=='moving')return;
      const background=scene.background;
      if(whiteBackground)scene.background=null;
      try{composer.render(0);}finally{scene.background=background;}
      gl.domElement.dataset.inspectionFrame='settled';
    };
    const owned={composer,taa,moving,dispose(){
      movingScene?.dispose();movingOutput?.dispose();movingResolve?.dispose();moving?.dispose();
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
      const background=scene.background;
      if(whiteBackground)scene.background=null;
      const moving=motion?.current.active?current.moving:null;
      try{(moving??current.composer).render(delta);}finally{scene.background=background;}
      if(motion)gl.domElement.dataset.inspectionFrame=moving?'moving':'settled';
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
