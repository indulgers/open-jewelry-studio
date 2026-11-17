import {CanvasTexture,SRGBColorSpace,type Texture} from 'three';
import {valueNoise} from './nacreMaterials';

export type StoneKind='onyx'|'malachite'|'lapis'|'carnelian';
const clamp=(x:number)=>Math.max(0,Math.min(255,Math.round(x)));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const saturate=(x:number)=>Math.max(0,Math.min(1,x));

/**
 * Procedural mineral *appearance* for an internal style study:
 * malachite banding, translucent carnelian cloud, lapis speckles and dark onyx.
 * This is not a photograph/scan or physical optical model of natural stone.
 */
export function mineralPixel(kind:StoneKind,u:number,v:number):readonly [number,number,number]{
  const low=valueNoise(u*5.1+10,v*5.5+14),high=valueNoise(u*26.4+12,v*24.1+2);
  if(kind==='malachite'){
    const warped=u*15.2+v*2.9+.62*Math.sin(v*7.8)+1.9*(low-.5);
    const band=Math.sin(warped*2.6)+.38*Math.sin(warped*6.7)+.18*Math.cos(warped*11);
    const t=saturate(.53+.26*band+.15*(high-.5));
    return [clamp(mix(8,61,t)),clamp(mix(32,133,t)),clamp(mix(29,100,t))];
  }
  if(kind==='carnelian'){
    const transparency=.58+.21*low+.08*Math.sin((u*.9+v*.7)*15+high*5);
    return [clamp(125+79*transparency),clamp(20+37*transparency),
      clamp(12+30*transparency)];
  }
  if(kind==='lapis'){
    const gold=valueNoise(u*50+5,v*52+12)>.979;
    const s=.43+.25*low+.15*(high-.5);
    return gold?[142,119,64]:[clamp(13+27*s),clamp(36+35*s),clamp(84+92*s)];
  }
  const t=.45+.32*low+.06*(high-.5);
  return [clamp(5+17*t),clamp(8+20*t),clamp(13+23*t)];
}
export function createMineralTexture(kind:StoneKind,size=384):Texture{
  if(size<32||size>2048||!Number.isInteger(size))throw new RangeError('invalid mineral texture resolution');
  const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas 2D unavailable');
  const data=ctx.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const rgb=mineralPixel(kind,x/(size-1),y/(size-1)),k=(y*size+x)*4;
    data.data[k]=rgb[0];data.data[k+1]=rgb[1];data.data[k+2]=rgb[2];data.data[k+3]=255;
  }
  ctx.putImageData(data,0,0);
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;
  texture.anisotropy=8;texture.needsUpdate=true;
  return texture;
}
