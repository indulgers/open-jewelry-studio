import {Color,Vector2,Vector3,type BufferGeometry,type Camera,type ShaderMaterial,type Texture,type WebGLRenderer} from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshRefractionMaterial as BaseRefractionMaterial} from '@react-three/drei/materials/MeshRefractionMaterial';
import {MeshBVH,MeshBVHUniformStruct,SAH,shaderStructs,shaderIntersectFunction} from 'three-mesh-bvh';
import {qualitySettings,type Quality} from './quality';

export function attenuationCoefficients(color:Color,distance:number){
  if(!Number.isFinite(distance)||distance<=0)throw new Error('Absorption distance must be positive');
  return new Vector3(...[color.r,color.g,color.b].map(c=>Math.max(0,-Math.log(Math.min(1,Math.max(1e-6,c)))/distance)));
}

export type GemOpticsOptions={environmentRotation?:number;environmentIntensity?:number;dispersion?:number;
  mount?:{bvh:MeshBVHUniformStruct;color:Color;roughness:number}};

// Based on drei's MIT MeshRefractionMaterial (N8Programs). Bounded deterministic
// internal reflection with exit-energy accumulation, plus optional static mount hits.
const fragmentShader=/* glsl */`
precision highp isampler2D;
precision highp usampler2D;
varying vec3 vWorldPosition;
varying mat4 vModelMatrixInverse;
uniform sampler2D envMap;
uniform float bounces;
uniform float ior;
uniform float aberrationStrength;
uniform float stoneDiameter;
uniform float environmentIntensity;
uniform float environmentRotation;
uniform bool hasMount;
uniform vec3 mountColor;
uniform float mountRoughness;
uniform vec3 attenuation;
uniform vec2 resolution;
uniform vec2 detailResolution;
uniform mat4 projectionMatrixInverse;
uniform mat4 viewMatrixInverse;
uniform mat4 modelMatrix;
${shaderStructs}
${shaderIntersectFunction}
uniform BVH bvh;
uniform BVH mountBvh;
#include <common>
float mountDetail;

vec3 rotateEnvironment(vec3 d){
  float c=cos(environmentRotation),s=sin(environmentRotation);
  return vec3(c*d.x-s*d.z,d.y,s*d.x+c*d.z);
}
vec3 environment(vec3 direction,vec3 smoothDirection){
  vec2 uv=equirectUv(rotateEnvironment(direction)),smoothUv=equirectUv(rotateEnvironment(smoothDirection));
  return textureGrad(envMap,uv,dFdx(smoothUv),dFdy(smoothUv)).rgb*environmentIntensity;
}
float fresnelDielectric(float c,float n1,float n2){
  c=clamp(abs(c),0.0,1.0);float ratio=n1/n2;
  float sin2=ratio*ratio*(1.0-c*c);if(sin2>=1.0)return 1.0;
  float t=sqrt(1.0-sin2);
  float rs=(n1*c-n2*t)/max(n1*c+n2*t,1e-6);
  float rp=(n2*c-n1*t)/max(n2*c+n1*t,1e-6);
  return (rs*rs+rp*rp)*0.5;
}
vec3 outsideRadiance(vec3 origin,vec3 direction,vec3 smoothRay){
  // A soft camera obstruction preserves dark facets against the white sweep.
  float facingObserver=dot(direction,normalize(cameraPosition-origin));
  float obstruction=smoothstep(0.9563,0.9848,facingObserver);
  vec3 studio=environment(direction,smoothRay)*mix(1.0,0.12,obstruction);
  if(hasMount&&mountDetail>0.0){
    uvec4 face=uvec4(0u);vec3 normal=vec3(0.0,1.0,0.0),bary=vec3(0.0);float side=1.0,distance=0.0;
    if(bvhIntersectFirstHit(mountBvh,origin+direction*0.00015,direction,face,normal,bary,side,distance)){
      normal=normalize(normal);if(dot(normal,direction)>0.0)normal=-normal;
      vec3 reflected=reflect(direction,normal);
      vec3 t=normalize(cross(abs(reflected.y)<0.9?vec3(0,1,0):vec3(1,0,0),reflected));
      // A bounded environment-lobe approximation, not a second full metal path tracer.
      vec3 radiance=environment(reflected,smoothRay)*0.5;
      radiance+=environment(normalize(reflected+t*mountRoughness),smoothRay)*0.25;
      radiance+=environment(normalize(reflected-t*mountRoughness),smoothRay)*0.25;
      vec3 f=mix(mountColor,vec3(1),pow(1.0-clamp(dot(-direction,normal),0.0,1.0),5.0));
      return mix(studio,radiance*f,mountDetail);
    }
  }
  return studio;
}
vec3 traceRadiance(vec3 incoming,vec3 normal,float eta,vec3 smoothRay){
  vec3 direction=refract(incoming,normal,1.0/eta);
  vec3 origin=(vModelMatrixInverse*vec4(vWorldPosition+direction*0.0001,1.0)).xyz;
  direction=normalize((vModelMatrixInverse*vec4(direction,0.0)).xyz);
  vec3 throughput=vec3(1.0),radiance=vec3(0.0);
  for(int bounce=0;bounce<10;bounce++){
    if(float(bounce)>=bounces)break;
    uvec4 indices=uvec4(0u);
    vec3 faceNormal=vec3(0.0,0.0,1.0),barycoord=vec3(0.0);
    float side=1.0,dist=0.0;
    bool hit=bvhIntersectFirstHit(bvh,origin,direction,indices,faceNormal,barycoord,side,dist);
    if(!hit)break;
    if(dot(faceNormal,direction)>0.0)faceNormal=-faceNormal;
    throughput*=exp(-attenuation*length((modelMatrix*vec4(direction*dist,0.0)).xyz));
    vec3 hitPosition=origin+direction*dist;
    vec3 exitDirection=refract(direction,faceNormal,eta);
    float f=fresnelDielectric(dot(-direction,faceNormal),eta,1.0);
    if(dot(exitDirection,exitDirection)>0.000001){
      vec3 worldExit=(modelMatrix*vec4(hitPosition,1.0)).xyz;
      vec3 worldDirection=normalize((modelMatrix*vec4(exitDirection,0.0)).xyz);
      radiance+=throughput*(1.0-f)*outsideRadiance(worldExit,worldDirection,smoothRay);
      throughput*=f;
      if(max(throughput.r,max(throughput.g,throughput.b))<0.002)break;
    }
    direction=reflect(direction,faceNormal);
    origin=hitPosition+direction*0.0001;
  }
  // Unresolved energy at the budget / missing hit is absorbed, never treated as an exit.
  return radiance;
}
void main(){
  vec3 incident=normalize(vWorldPosition-cameraPosition);
  // Use the same planar facet for entry as the BVH uses for internal hits.
  vec3 normal=normalize(cross(dFdx(vWorldPosition),dFdy(vWorldPosition)));
  if(dot(incident,normal)>0.0)normal=-normal;
  vec2 uv=gl_FragCoord.xy/resolution;
  vec3 smoothRay=(projectionMatrixInverse*vec4(uv*2.0-1.0,0.0,1.0)).xyz;
  smoothRay=normalize((viewMatrixInverse*vec4(smoothRay,0.0)).xyz);
  float scale=max(length(modelMatrix[0].xyz),max(length(modelMatrix[1].xyz),length(modelMatrix[2].xyz)));
  float pixelDiameter=stoneDiameter*scale*detailResolution.y*0.5*gl_FragCoord.w/projectionMatrixInverse[1][1];
  // A small accent samples the studio; resolve the nearby prongs as their reflection becomes visible.
  mountDetail=smoothstep(24.0,48.0,pixelDiameter);
  vec3 transmitted=traceRadiance(incident,normal,ior,smoothRay);
  // Resolve separate wavelengths as the stone grows on screen; tiny pavé keeps one full-color path.
  float spread=aberrationStrength*smoothstep(24.0,52.0,pixelDiameter);
  if(spread>0.0){
    transmitted.r=traceRadiance(incident,normal,ior*(1.0-spread),smoothRay).r;
    transmitted.b=traceRadiance(incident,normal,ior*(1.0+spread),smoothRay).b;
  }
  float fresnel=fresnelDielectric(dot(-incident,normal),1.0,ior);
  vec3 reflected=outsideRadiance(vWorldPosition,reflect(incident,normal),smoothRay);
  gl_FragColor=vec4(mix(transmitted,reflected,fresnel),1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function syncGemDraw(material:ShaderMaterial,renderer:WebGLRenderer,camera:Camera){
  const uniforms=material.uniforms,target=renderer.getRenderTarget();
  uniforms.viewMatrixInverse.value.copy(camera.matrixWorld);
  // Reflector oblique clipping changes projectionMatrix without updating its inverse.
  uniforms.projectionMatrixInverse.value.copy(camera.projectionMatrix).invert();
  // Optical detail follows the display size, even when motion lowers the render resolution.
  renderer.getDrawingBufferSize(uniforms.detailResolution.value);
  const resolution=uniforms.resolution.value as Vector2;
  if(target)resolution.set(target.width,target.height);else renderer.getDrawingBufferSize(resolution);
}

export function updateGemOptics(material:ShaderMaterial,options:GemOpticsOptions={}){
  const u=material.uniforms;
  u.environmentRotation.value=options.environmentRotation??0;
  u.environmentIntensity.value=options.environmentIntensity??1;
  u.aberrationStrength.value=options.dispersion??0.004;
  u.hasMount.value=!!options.mount;u.mountBvh.value=options.mount?.bvh??u.bvh.value;
  u.mountColor.value.copy(options.mount?.color??new Color('white'));
  u.mountRoughness.value=options.mount?.roughness??0.15;
}
export function createGemOptics(geometry:BufferGeometry,environment:Texture,quality:Quality,options:GemOpticsOptions={}){
  const settings=qualitySettings(quality),material=new BaseRefractionMaterial();
  const bvh=new MeshBVHUniformStruct();
  // Split-normal facet meshes are geometrically closed but topologically open: every
  // facet has its own vertex copies, so a ray inside never meets an exit face and the
  // stone renders as reflection only. Weld by position for tracing while the draw
  // geometry keeps its flat facet normals.
  const tracingSource=geometry.clone();
  tracingSource.deleteAttribute('normal');tracingSource.deleteAttribute('uv');tracingSource.deleteAttribute('tangent');
  const tracingGeometry=mergeVertices(tracingSource,1e-5);
  tracingSource.dispose();
  // Material groups create multiple roots; one optical medium needs one BVH root.
  tracingGeometry.clearGroups();
  try{bvh.updateFrom(new MeshBVH(tracingGeometry,{strategy:SAH}));}
  catch(error){bvh.dispose();material.dispose();throw error;}
  finally{tracingGeometry.dispose();}
  material.fragmentShader=fragmentShader;
  material.defines={};
  material.uniforms.envMap.value=environment;
  material.uniforms.bvh.value=bvh;
  material.uniforms.bounces.value=settings.bounces;
  material.uniforms.ior.value=2.42;
  if(!geometry.boundingSphere)geometry.computeBoundingSphere();
  material.uniforms.detailResolution={value:new Vector2()};
  material.uniforms.stoneDiameter={value:geometry.boundingSphere!.radius*2};
  material.uniforms.aberrationStrength.value=settings.aberrationStrength;
  material.uniforms.environmentIntensity={value:1.0};
  material.uniforms.environmentRotation={value:0};material.uniforms.hasMount={value:false};
  material.uniforms.mountBvh={value:bvh};material.uniforms.mountColor={value:new Color('white')};material.uniforms.mountRoughness={value:0.15};
  material.uniforms.attenuation={value:attenuationCoefficients(new Color('white'),1)};
  material.toneMapped=true;
  updateGemOptics(material,options);
  let disposed=false;
  return {material,dispose(){if(disposed)return;disposed=true;bvh.dispose();material.dispose();}};
}
