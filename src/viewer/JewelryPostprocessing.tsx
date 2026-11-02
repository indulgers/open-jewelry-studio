import {useEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Matrix4,Mesh,Vector2} from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {TAARenderPass} from 'three/addons/postprocessing/TAARenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {CopyShader} from 'three/addons/shaders/CopyShader.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {movedSinceSample,nextRefinement,type RefinementState} from './progressiveState';
import {qualitySettings,type Quality} from './quality';

type IdlePass=TAARenderPass&{accumulateIndex:number};
type Pipeline={composer:EffectComposer;taa:IdlePass|null;dispose:()=>void};

export function JewelryPostprocessing({quality,contentKey,capturing}:{quality:Quality;contentKey:string;capturing:boolean}){
  const {gl,scene,camera,size,viewport,invalidate}=useThree();
  const pipeline=useRef<Pipeline|null>(null),state=useRef<RefinementState>({stableFrames:0,samples:0});
  const previous=useRef({key:'',world:new Matrix4(),projection:new Matrix4()});
  useEffect(()=>{
    const composer=new EffectComposer(gl);
    const pixelRatio=viewport.dpr;
    composer.setPixelRatio(pixelRatio);composer.setSize(size.width,size.height);
    const taa=capturing?new TAARenderPass(scene,camera) as IdlePass:null;
    const scenePass=taa??new RenderPass(scene,camera);
    if(taa){
      taa.sampleLevel=0;
      taa.unbiased=false;
    }else{
      // The live scene always writes to the composer's initial read buffer.
      composer.readBuffer.samples=Math.min(gl.capabilities.maxSamples,qualitySettings(quality).multisampling);
    }
    const output=new OutputPass();
    // Four bilinear taps integrate isolated subpixel highlights over a small, fixed screen footprint.
    const offset=new Vector2(0.32/composer.readBuffer.width,0.32/composer.readBuffer.height);
    const resolve=capturing?null:new ShaderPass({
      uniforms:{tDiffuse:{value:null},offset:{value:offset}},
      vertexShader:CopyShader.vertexShader,
      fragmentShader:`uniform sampler2D tDiffuse;
        uniform vec2 offset;
        varying vec2 vUv;
        void main(){
          vec2 mirror=vec2(offset.x,-offset.y);
          gl_FragColor=0.25*(texture2D(tDiffuse,vUv+offset)+texture2D(tDiffuse,vUv-offset)
            +texture2D(tDiffuse,vUv+mirror)+texture2D(tDiffuse,vUv-mirror));
        }`,
    });
    composer.addPass(scenePass);composer.addPass(output);
    if(resolve)composer.addPass(resolve);
    const owned={composer,taa,dispose(){scenePass.dispose();output.dispose();resolve?.dispose();composer.dispose();}};
    pipeline.current=owned;state.current={stableFrames:0,samples:0};previous.current.key='';invalidate();
    return ()=>{pipeline.current=null;owned.dispose();};
  },[gl,scene,camera,size.width,size.height,viewport.dpr,quality,capturing,invalidate]);

  // Priority 1 owns the final draw, after OrbitControls and contact-shadow capture.
  useFrame((_,delta)=>{
    const current=pipeline.current;
    if(!current){gl.render(scene,camera);invalidate();return;}
    if(!current.taa){
      current.composer.render(delta);
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
