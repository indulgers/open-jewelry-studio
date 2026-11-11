import {MeshPhysicalMaterial} from 'three';
import {METALS,type MetalFinish} from '../configuration/configuration';
import type {StudioPreset} from './studioPresets';
export function createMetalMaterial(finish:MetalFinish,preset?:StudioPreset,localOcclusion=false){
  const material=new MeshPhysicalMaterial({color:METALS[finish].color,metalness:1,roughness:preset?.roughness??0.105,
    clearcoat:0,envMapIntensity:1});
  if(localOcclusion){
    material.onBeforeCompile=shader=>{
      shader.uniforms.localOcclusionStrength={value:preset?.occlusion??0.65};
      shader.vertexShader='attribute float localOcclusion; varying float vLocalOcclusion;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLocalOcclusion=localOcclusion;');
      shader.fragmentShader='uniform float localOcclusionStrength; varying float vLocalOcclusion;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>
        float localAO=mix(1.0,clamp(vLocalOcclusion,0.0,1.0),localOcclusionStrength);
        reflectedLight.indirectDiffuse*=localAO;
        reflectedLight.indirectSpecular*=mix(1.0,localAO,0.75);`);
    };
    material.customProgramCacheKey=()=>`atelier-local-ao-${preset?.occlusion??0.65}`;
  }
  return material;
}
