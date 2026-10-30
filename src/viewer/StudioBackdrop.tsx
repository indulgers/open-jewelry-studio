import {useEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Color,Mesh,PlaneGeometry,ShaderMaterial,Vector3,type PerspectiveCamera} from 'three';

const VERTEX=/* glsl */`
varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;

const FRAGMENT=/* glsl */`
precision highp float;
varying vec2 vUv;
uniform float uAspect;
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uBottom;
uniform vec3 uPool;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  vec2 uv=vUv;
  // A paper sweep: bright behind the product, settling into warm stone at the floor.
  vec3 col=mix(uBottom,uMid,smoothstep(0.0,0.52,uv.y));
  col=mix(col,uTop,smoothstep(0.52,1.0,uv.y));
  // Broad, soft lamp pool behind the ring; this is what lifts the metal off the page.
  vec2 p=(uv-vec2(0.5,0.58))*vec2(uAspect*0.86,1.28);
  float pool=exp(-dot(p,p)*4.2);
  col+=uPool*pool*0.6;
  // A whisper of floor falloff, not a visible horizon.
  col*=mix(0.982,1.0,smoothstep(0.0,0.32,uv.y));
  // Gentle gallery vignette.
  float d=length((uv-0.5)*vec2(0.94,1.0));
  col*=mix(0.918,1.0,smoothstep(0.86,0.22,d));
  // Break 8-bit banding in the long gradient.
  col+=(hash(gl_FragCoord.xy)-0.5)*0.0022;
  gl_FragColor=vec4(col,1.0);
}`;

const DISTANCE=18;

export function StudioBackdrop(){
  const {camera}=useThree();
  const mesh=useRef<Mesh>(null);
  const geometry=useMemo(()=>new PlaneGeometry(1,1),[]);
  const material=useMemo(()=>new ShaderMaterial({
    uniforms:{
      uAspect:{value:1},
      uTop:{value:new Color(1.93,1.91,1.87)},
      uMid:{value:new Color(1.40,1.37,1.31)},
      uBottom:{value:new Color(0.95,0.92,0.86)},
      uPool:{value:new Color(0.075,0.064,0.048)},
    },
    vertexShader:VERTEX,fragmentShader:FRAGMENT,
    depthTest:false,depthWrite:false,side:2,
  }),[]);
  useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);
  useFrame(()=>{
    const object=mesh.current;
    if(!object)return;
    const perspective=camera as PerspectiveCamera;
    const height=2*DISTANCE*Math.tan((perspective.fov*Math.PI/180)/2)*1.04;
    const aspect=perspective.aspect;
    object.scale.set(height*aspect,height,1);
    const forward=camera.getWorldDirection(new Vector3());
    object.position.copy(camera.position).addScaledVector(forward,DISTANCE);
    object.quaternion.copy(camera.quaternion);
    (material.uniforms.uAspect.value as number)=aspect;
  });
  return <mesh ref={mesh} geometry={geometry} material={material} renderOrder={-1000}
    frustumCulled={false} userData={{excludeFromContactShadow:true}}/>;
}
