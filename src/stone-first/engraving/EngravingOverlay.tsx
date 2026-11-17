import {useEffect,useMemo} from 'react';
import {CanvasTexture,DoubleSide,SRGBColorSpace,MeshBasicMaterial} from 'three';
import type {Part} from '../reference/model';
import {engravingSurface} from './surface';
import {DEFAULT_ENGRAVING_STYLE,engravingFont,type EngravingStyle} from './style';
export function EngravingOverlay({parts,text,style=DEFAULT_ENGRAVING_STYLE}:{parts:Part[];text:string;style?:EngravingStyle}){
  const geometry=useMemo(()=>engravingSurface(parts),[parts]);
  useEffect(()=>()=>geometry?.dispose(),[geometry]);
  const texture=useMemo(()=>{
    if(!text)return null;
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;
    const context=canvas.getContext('2d');if(!context)return null;
    context.font=(style.font==='italic'?'italic ':'')+'84px '+engravingFont(style.font);
    context.textAlign=style.align;context.textBaseline='middle';context.fillStyle='#504b43';
    context.fillText(text,{left:24,center:512,right:1000}[style.align],64,976);
    const map=new CanvasTexture(canvas);map.colorSpace=SRGBColorSpace;return map;
  },[text,style.font,style.align]);
  useEffect(()=>()=>texture?.dispose(),[texture]);
  const material=useMemo(()=>new MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:DoubleSide,toneMapped:false}),[texture]);
  useEffect(()=>()=>material.dispose(),[material]);
  if(!geometry||!texture)return null;
  return <mesh geometry={geometry} material={material} renderOrder={1} dispose={null}/>;
}
