import {useEffect,useMemo,type ReactNode} from 'react';
import type {Configuration} from '../configuration/configuration';
import {createRingGeometry,createSettingGeometry} from '../geometry/ringGeometry';
import {createMetalMaterial} from './materials';
export function RingAssembly({configuration,children}:{configuration:Configuration;children:ReactNode}){
  const shank=useMemo(()=>createRingGeometry(configuration.shankStyle,configuration.stoneSize),[configuration.shankStyle,configuration.stoneSize]);
  const setting=useMemo(()=>createSettingGeometry(configuration.stoneSize),[configuration.stoneSize]);
  const material=useMemo(()=>createMetalMaterial(configuration.metalFinish),[configuration.metalFinish]);
  useEffect(()=>()=>shank.forEach(g=>g.dispose()),[shank]);
  useEffect(()=>()=>setting.forEach(g=>g.dispose()),[setting]);
  useEffect(()=>()=>material.dispose(),[material]);
  return <group dispose={null}>
    {[...shank,...setting].map((geometry,i)=><mesh key={geometry.uuid} geometry={geometry} material={material} name={`ring-part-${i}`}/>)}
    {children}
  </group>;
}
