import {DataTexture,DataUtils,EquirectangularReflectionMapping,HalfFloatType,
  LinearFilter,LinearMipmapLinearFilter,LinearSRGBColorSpace,RGBAFormat} from 'three';

type Softbox={azimuth:number;elevation:number;width:number;height:number;power:number};
const metalBoxes:Softbox[]=[
  {azimuth:-1.15,elevation:0.3,width:0.48,height:0.95,power:3.4},
  {azimuth:1.1,elevation:0.2,width:0.18,height:1.05,power:5.4},
  {azimuth:0,elevation:1.2,width:1.1,height:0.26,power:2.8},
  {azimuth:2.8,elevation:0.2,width:0.62,height:0.8,power:1.8},
];
const gemBoxes:Softbox[]=[
  // Broad ceiling/floor returns keep the face-up stone luminous, while gaps between
  // the narrower side cards still resolve as dark facets rather than a blue tint.
  {azimuth:0,elevation:1.25,width:Math.PI,height:0.48,power:1.1},
  {azimuth:0,elevation:-1.15,width:Math.PI,height:0.52,power:0.9},
  {azimuth:-0.55,elevation:0.8,width:0.64,height:0.5,power:2.8},
  {azimuth:1.25,elevation:0.25,width:0.25,height:0.9,power:3.1},
  {azimuth:-2.15,elevation:0.25,width:0.36,height:0.75,power:2.5},
  {azimuth:2.7,elevation:-0.25,width:0.45,height:0.5,power:1.7},
  {azimuth:0.25,elevation:-0.7,width:0.3,height:0.22,power:1.6},
];
const smooth=(inner:number,outer:number,value:number)=>{
  const t=Math.max(0,Math.min(1,(value-inner)/(outer-inner)));
  return t*t*(3-2*t);
};
function radianceTexture(width:number,height:number,boxes:Softbox[],base:number){
  const data=new Uint16Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const azimuth=((x+0.5)/width-0.5)*Math.PI*2;
    const elevation=((y+0.5)/height-0.5)*Math.PI;
    let value=base+0.015*Math.max(0,Math.sin(elevation));
    for(const box of boxes){
      const delta=Math.abs(Math.atan2(Math.sin(azimuth-box.azimuth),Math.cos(azimuth-box.azimuth)));
      const horizontal=1-smooth(box.width*0.85,box.width,delta);
      const vertical=1-smooth(box.height*0.85,box.height,Math.abs(elevation-box.elevation));
      value+=box.power*horizontal*vertical;
    }
    const i=(y*width+x)*4,encoded=DataUtils.toHalfFloat(value);
    data[i]=data[i+1]=data[i+2]=encoded;data[i+3]=DataUtils.toHalfFloat(1);
  }
  const texture=new DataTexture(data,width,height,RGBAFormat,HalfFloatType);
  texture.mapping=EquirectangularReflectionMapping;
  texture.colorSpace=LinearSRGBColorSpace;
  texture.magFilter=LinearFilter;texture.minFilter=LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}

/** Original neutral softboxes: broad metal gradients, separate contrast for the cut stone. */
export function createStudioLighting(width=512,height=256){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<16||height<8||width>1024||height>512)
    throw new RangeError('Studio dimensions must be integer texel sizes within 16×8–1024×512');
  const metal=radianceTexture(width,height,metalBoxes,0.15);
  const gem=radianceTexture(width,height,gemBoxes,0.13);
  metal.name='Original neutral metal softboxes';gem.name='Original neutral gemstone softboxes';
  let disposed=false;
  return {metal,gem,dispose(){if(!disposed){disposed=true;metal.dispose();gem.dispose();}}};
}
