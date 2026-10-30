import {useEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Matrix4,Mesh,Vector2} from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {TAARenderPass} from 'three/addons/postprocessing/TAARenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {nextRefinement,type RefinementState} from './progressiveState';
import {qualitySettings,type Quality} from './quality';

type IdlePass=TAARenderPass&{accumulateIndex:number};
type Pipeline={composer:EffectComposer;taa:IdlePass;dispose:()=>void};

// A restrained print grade: keep the whites clean but give gold its saturation
// and midtone separation back after the neutral tone map.
const GradeShader={uniforms:{tDiffuse:{value:null},contrast:{value:1.05},saturation:{value:1.07}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`uniform sampler2D tDiffuse;uniform float contrast;uniform float saturation;varying vec2 vUv;
    void main(){vec4 tex=texture2D(tDiffuse,vUv);vec3 c=(tex.rgb-0.5)*contrast+0.5;
      float l=dot(c,vec3(0.2126,0.7152,0.0722));c=mix(vec3(l),c,saturation);
      gl_FragColor=vec4(clamp(c,0.0,1.0),tex.a);}`};

export function JewelryPostprocessing({quality,contentKey,active}:{quality:Quality;contentKey:string;active:boolean}){
  const {gl,scene,camera,size,viewport,invalidate}=useThree();
  const pipeline=useRef<Pipeline|null>(null),state=useRef<RefinementState>({stableFrames:0,samples:0});
  const previous=useRef({key:'',world:new Matrix4(),projection:new Matrix4()});
  useEffect(()=>{
    const composer=new EffectComposer(gl);
    composer.setPixelRatio(viewport.dpr);composer.setSize(size.width,size.height);
    const taa=new TAARenderPass(scene,camera) as IdlePass;
    taa.sampleLevel=0;taa.unbiased=false;
    const bloom=new UnrealBloomPass(new Vector2(size.width,size.height),qualitySettings(quality).bloomIntensity,0.12,3.2);
    const output=new OutputPass();
    const grade=new ShaderPass(GradeShader);
    composer.addPass(taa);composer.addPass(bloom);composer.addPass(output);composer.addPass(grade);
    const owned={composer,taa,dispose(){taa.dispose();bloom.dispose();output.dispose();grade.dispose();composer.dispose();}};
    pipeline.current=owned;state.current={stableFrames:0,samples:0};previous.current.key='';invalidate();
    return ()=>{pipeline.current=null;owned.dispose();};
  },[gl,scene,camera,size.width,size.height,viewport.dpr,quality,invalidate]);

  // Priority 1 owns the final draw, after OrbitControls and contact-shadow capture.
  useFrame((_,delta)=>{
    const current=pipeline.current;
    if(!current){gl.render(scene,camera);invalidate();return;}
    camera.updateMatrixWorld();
    const objects:string[]=[];
    scene.traverse(object=>{
      if(object instanceof Mesh)objects.push(object.geometry.uuid,...(Array.isArray(object.material)?object.material:[object.material]).map(m=>m.uuid));
    });
    const key=`${contentKey}/${scene.environment?.uuid}/${objects.join('/')}`;
    const changed=active||previous.current.key!==key||!previous.current.world.equals(camera.matrixWorld)
      ||!previous.current.projection.equals(camera.projectionMatrix);
    previous.current.key=key;previous.current.world.copy(camera.matrixWorld);previous.current.projection.copy(camera.projectionMatrix);
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
