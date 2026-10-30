import {MeshPhysicalMaterial} from 'three';
import type {MetalFinish} from '../configuration/configuration';
import type {StudioPreset} from './studioPresets';
export const METALS={
  yellow:{name:'黄金色',color:'#edc987',swatch:'#c3a05e'},
  white:{name:'白金色',color:'#f0f0f0',swatch:'#c9cece'},
  rose:{name:'玫瑰金色',color:'#c68f76',swatch:'#c79078'},
};
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
        reflectedLight.indirectSpecular*=mix(1.0,localAO,0.75);
        // A thin grazing-angle highlight along polished bevels. Real metal almost
        // always shows this bright edge; without it a smooth band reads as plastic.
        float rimTerm=pow(1.0-clamp(dot(normalize(vNormal),normalize(vViewPosition)),0.0,1.0),6.0);
        reflectedLight.directSpecular+=mix(vec3(1.0),diffuseColor.rgb,0.7)*rimTerm*0.22;`);
    };
    material.customProgramCacheKey=()=>`atelier-local-ao-${preset?.occlusion??0.65}`;
  }
  return material;
}
