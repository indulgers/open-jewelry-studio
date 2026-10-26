import {Color,Vector2,Vector3,type BufferGeometry,type Camera,type ShaderMaterial,type Texture,type WebGLRenderer} from 'three';
import {MeshRefractionMaterial as BaseRefractionMaterial} from '@react-three/drei/materials/MeshRefractionMaterial';
import {MeshBVH,MeshBVHUniformStruct,SAH,shaderStructs,shaderIntersectFunction} from 'three-mesh-bvh';
import {qualitySettings,type Quality} from './quality';

export function attenuationCoefficients(color:Color,distance:number){
  if(!Number.isFinite(distance)||distance<=0)throw new Error('Absorption distance must be positive');
  return new Vector3(...[color.r,color.g,color.b].map(c=>Math.max(0,-Math.log(Math.min(1,Math.max(1e-6,c)))/distance)));
}

// Adapted from drei's MIT MeshRefractionMaterial (N8Programs). BVH traces only
// the gemstone; after exiting, rays sample the HDR environment, not scene geometry.
const fragmentShader=/* glsl */`
precision highp isampler2D;
precision highp usampler2D;
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying mat4 vModelMatrixInverse;
uniform sampler2D envMap;
uniform float bounces;
uniform float ior;
uniform float aberrationStrength;
uniform float environmentIntensity;
uniform vec3 attenuation;
uniform vec2 resolution;
uniform mat4 projectionMatrixInverse;
uniform mat4 viewMatrixInverse;
uniform mat4 modelMatrix;
${shaderStructs}
${shaderIntersectFunction}
uniform BVH bvh;
#include <common>

vec3 traceExit(vec3 incoming, vec3 normal, float eta, out float pathLength){
  vec3 direction=refract(incoming,normal,1.0/eta);
  vec3 origin=(vModelMatrixInverse*vec4(vWorldPosition+direction*0.0001,1.0)).xyz;
  direction=normalize((vModelMatrixInverse*vec4(direction,0.0)).xyz);
  pathLength=0.0;
  for(int bounce=0;bounce<10;bounce++){
    if(float(bounce)>=bounces)break;
    uvec4 indices=uvec4(0u);
    vec3 faceNormal=vec3(0.0,0.0,1.0),barycoord=vec3(0.0);
    float side=1.0,dist=0.0;
    bool hit=bvhIntersectFirstHit(bvh,origin,direction,indices,faceNormal,barycoord,side,dist);
    if(!hit)break;
    pathLength+=length((modelMatrix*vec4(direction*dist,0.0)).xyz);
    vec3 hitPosition=origin+direction*dist;
    vec3 exitDirection=refract(direction,faceNormal,eta);
    if(dot(exitDirection,exitDirection)>0.000001){direction=exitDirection;break;}
    direction=reflect(direction,faceNormal);
    origin=hitPosition+direction*0.0001;
  }
  return normalize((modelMatrix*vec4(direction,0.0)).xyz);
}
vec3 environment(vec3 direction,vec3 smoothDirection){
  vec2 uv=equirectUv(direction),smoothUv=equirectUv(smoothDirection);
  // Derivatives of the unbroken camera ray avoid blurring entire facets together.
  return textureGrad(envMap,uv,dFdx(smoothUv),dFdy(smoothUv)).rgb*environmentIntensity;
}
void main(){
  vec3 incident=normalize(vWorldPosition-cameraPosition);
  vec3 normal=normalize(vNormal);
  if(dot(incident,normal)>0.0)normal=-normal;
  vec2 uv=gl_FragCoord.xy/resolution;
  vec3 smoothRay=(projectionMatrixInverse*vec4(uv*2.0-1.0,0.0,1.0)).xyz;
  smoothRay=normalize((viewMatrixInverse*vec4(smoothRay,0.0)).xyz);
  float greenPath;
  vec3 greenDirection=traceExit(incident,normal,ior,greenPath);
  vec3 transmitted;
  #ifdef FAST_CHROMA
    vec3 redDirection=normalize(greenDirection+vec3(aberrationStrength*0.5));
    vec3 blueDirection=normalize(greenDirection-vec3(aberrationStrength*0.5));
    transmitted=vec3(environment(redDirection,smoothRay).r,environment(greenDirection,smoothRay).g,environment(blueDirection,smoothRay).b);
    transmitted*=exp(-attenuation*greenPath);
  #else
    float redPath,bluePath;
    vec3 redDirection=traceExit(incident,normal,max(ior*(1.0-aberrationStrength),1.001),redPath);
    vec3 blueDirection=traceExit(incident,normal,ior*(1.0+aberrationStrength),bluePath);
    transmitted=vec3(environment(redDirection,smoothRay).r,environment(greenDirection,smoothRay).g,environment(blueDirection,smoothRay).b);
    transmitted*=exp(-attenuation*vec3(redPath,greenPath,bluePath));
  #endif
  float f0=pow((ior-1.0)/(ior+1.0),2.0);
  float fresnel=f0+(1.0-f0)*pow(1.0-clamp(dot(-incident,normal),0.0,1.0),5.0);
  vec3 reflected=environment(reflect(incident,normal),smoothRay);
  gl_FragColor=vec4(mix(transmitted,reflected,fresnel),1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function syncGemDraw(material:ShaderMaterial,renderer:WebGLRenderer,camera:Camera){
  const uniforms=material.uniforms,target=renderer.getRenderTarget();
  uniforms.viewMatrixInverse.value.copy(camera.matrixWorld);
  // Reflector oblique clipping changes projectionMatrix without updating its inverse.
  uniforms.projectionMatrixInverse.value.copy(camera.projectionMatrix).invert();
  const resolution=uniforms.resolution.value as Vector2;
  if(target)resolution.set(target.width,target.height);else renderer.getDrawingBufferSize(resolution);
}

export function createGemOptics(geometry:BufferGeometry,environment:Texture,quality:Quality){
  const settings=qualitySettings(quality),material=new BaseRefractionMaterial();
  const bvh=new MeshBVHUniformStruct(),tracingGeometry=geometry.clone();
  // Material groups create multiple roots; one optical medium needs one BVH root.
  tracingGeometry.clearGroups();
  try{bvh.updateFrom(new MeshBVH(tracingGeometry,{strategy:SAH}));}
  catch(error){bvh.dispose();material.dispose();throw error;}
  finally{tracingGeometry.dispose();}
  material.fragmentShader=fragmentShader;
  material.defines=settings.fastChroma?{FAST_CHROMA:''}:{};
  material.uniforms.envMap.value=environment;
  material.uniforms.bvh.value=bvh;
  material.uniforms.bounces.value=settings.bounces;
  material.uniforms.ior.value=2.42;
  material.uniforms.aberrationStrength.value=settings.aberrationStrength;
  material.uniforms.environmentIntensity={value:1.0};
  material.uniforms.attenuation={value:attenuationCoefficients(new Color('white'),1)};
  material.toneMapped=true;
  let disposed=false;
  return {material,dispose(){if(disposed)return;disposed=true;bvh.dispose();material.dispose();}};
}
