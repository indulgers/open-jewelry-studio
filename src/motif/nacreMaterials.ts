import {CanvasTexture, SRGBColorSpace, RepeatWrapping, type Texture} from 'three';

/**
 * Deterministic, copyright-free approximation of nacre (mother-of-pearl).
 * The diffuse, height and roughness layers share the same grain field.
 * This is deliberately subtle: a pearl inlay isn't a saturated rainbow foil.
 */
export type NacreTextureSet={albedo:Texture;bump:Texture;roughness:Texture;dispose:()=>void};
const saturate=(v:number)=>Math.max(0,Math.min(1,v));
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const fract=(v:number)=>v-Math.floor(v);
const smooth=(v:number)=>v*v*(3-2*v);
const hash=(x:number,y:number)=>fract(Math.sin(x*127.1+y*311.7+19.19)*43758.5453123);

export function valueNoise(x:number,y:number):number{
  const ix=Math.floor(x),iy=Math.floor(y),fx=smooth(fract(x)),fy=smooth(fract(y));
  return lerp(lerp(hash(ix,iy),hash(ix+1,iy),fx),lerp(hash(ix,iy+1),hash(ix+1,iy+1),fx),fy);
}
export function nacreSample(u:number,v:number){
  const x=u-.5,y=v-.5;
  const warp=(valueNoise(u*5+1.2,v*5-2.1)-.5)*1.6;
  const flow=x*.88+y*.46 + warp*.085 + Math.sin(5*y+2*x)*.02;
  const waves=Math.sin(flow*67+Math.sin(flow*11)*.7);
  const striation=Math.sin(flow*171+Math.sin(v*9)*.9);
  const cloudy=valueNoise(u*8.1+13.2,v*7.9-4.4);
  const mist=valueNoise(u*23.2-8.4,v*21.4+11.7);
  const pearl=saturate(.83+.085*cloudy+.027*waves+.012*striation+.018*mist);
  // Keep spectral variation within a few RGB values; angle-dependent shift is handled by PBR.
  const warm=.55+.45*Math.sin(flow*26+cloudy*4);
  const r=Math.round(255*saturate(pearl+.045+warm*.025));
  const g=Math.round(255*saturate(pearl+.055));
  const b=Math.round(255*saturate(pearl+.075-warm*.022));
  const height=saturate(.5+.25*waves+.10*striation+.08*(mist-.5));
  const roughness=saturate(.28+.045*cloudy+.035*striation);
  return {r,g,b,height,roughness};
}
function buildCanvas(size:number,sampler:(u:number,v:number)=>[number,number,number]){
  const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Nacre texture: 2D canvas unavailable');
  const pixels=ctx.createImageData(size,size),array=pixels.data;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const [r,g,b]=sampler(x/(size-1),y/(size-1));
    const idx=4*(y*size+x);array[idx]=r;array[idx+1]=g;array[idx+2]=b;array[idx+3]=255;
  }
  ctx.putImageData(pixels,0,0);return canvas;
}
export function createNacreTextureSet(size=512):NacreTextureSet{
  if(!Number.isInteger(size)||size<64||size>2048)throw new RangeError('Texture size must be 64..2048');
  const albedo=new CanvasTexture(buildCanvas(size,(u,v)=>{
    const s=nacreSample(u,v);return [s.r,s.g,s.b];
  }));
  albedo.colorSpace=SRGBColorSpace;
  const bump=new CanvasTexture(buildCanvas(size,(u,v)=>{
    const h=Math.round(255*nacreSample(u,v).height);return [h,h,h];
  }));
  const roughness=new CanvasTexture(buildCanvas(size,(u,v)=>{
    const h=Math.round(255*nacreSample(u,v).roughness);return [h,h,h];
  }));
  for(const map of [albedo,bump,roughness]){
    map.wrapS=RepeatWrapping;map.wrapT=RepeatWrapping;map.anisotropy=8;map.needsUpdate=true;
  }
  return {albedo,bump,roughness,dispose(){albedo.dispose();bump.dispose();roughness.dispose();}};
}
