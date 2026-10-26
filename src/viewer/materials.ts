import {MeshPhysicalMaterial} from 'three';
import type {MetalFinish} from '../configuration/configuration';
export const METALS={
  yellow:{name:'黄金色',color:'#f1d28b',swatch:'#c3a05e'},
  white:{name:'白金色',color:'#f0f0f0',swatch:'#c9cece'},
  rose:{name:'玫瑰金色',color:'#dba48b',swatch:'#c79078'},
};
export function createMetalMaterial(finish:MetalFinish){
  return new MeshPhysicalMaterial({color:METALS[finish].color,metalness:1,roughness:0.105,
    clearcoat:0,envMapIntensity:1});
}
