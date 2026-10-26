import {useEffect,useMemo} from 'react';
import {useGLTF} from '@react-three/drei';
import {Box3,Mesh,type Texture} from 'three';
import {GEM_ASSET} from '../assets/gemManifest';
import type {StoneSize} from '../configuration/configuration';
import {getGemPlacement} from '../geometry/gemPlacement';
import {prepareGemGeometry} from '../geometry/gemPreparation';
import type {Quality} from './quality';
import {OpticalGem} from './OpticalGem';

export function GemAsset({size,quality,simplified,environment,onReady}:{size:StoneSize;quality:Quality;simplified:boolean;environment:Texture;onReady:()=>void}){
  const gltf=useGLTF(GEM_ASSET.url);
  const source=gltf.scene.getObjectByName(GEM_ASSET.meshName);
  if(!(source instanceof Mesh))throw new Error('Expected named gemstone mesh');
  const geometry=useMemo(()=>prepareGemGeometry(source.geometry,GEM_ASSET.orientationEuler),[source]);
  const placement=getGemPlacement(geometry.boundingBox as Box3,size);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useEffect(onReady,[environment,onReady]);
  return <OpticalGem geometry={geometry} position={placement.position} scale={placement.scale} {...{environment,quality,simplified}}/>;
}
