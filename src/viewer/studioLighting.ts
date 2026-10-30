import {DataTexture,DataUtils,EquirectangularReflectionMapping,HalfFloatType,
  LinearFilter,LinearMipmapLinearFilter,LinearSRGBColorSpace,RGBAFormat} from 'three';

type Softbox={azimuth:number;elevation:number;width:number;height:number;power:number};
const metalBoxes:Softbox[]=[
  // Dark studio with narrow strip lights: the hard bright lines and black gaps are
  // what the eye reads as polished metal. A broad white room just makes gold beige.
  {azimuth:0,elevation:1.25,width:1.1,height:0.32,power:14},
  {azimuth:-0.92,elevation:0.1,width:0.06,height:1.4,power:26},
  {azimuth:0.98,elevation:0.1,width:0.075,height:1.4,power:22},
  {azimuth:-0.35,elevation:0.42,width:0.5,height:0.45,power:5},
  {azimuth:2.85,elevation:0.35,width:0.28,height:0.7,power:8},
  {azimuth:0,elevation:-0.75,width:1.6,height:0.45,power:4},
];
const gemBoxes:Softbox[]=[
  {azimuth:0,elevation:1.28,width:0.75,height:0.34,power:12},
  {azimuth:0,elevation:-0.95,width:Math.PI,height:0.6,power:11},
  {azimuth:-0.7,elevation:0.62,width:0.16,height:0.5,power:20},
  {azimuth:0.55,elevation:0.42,width:0.12,height:0.62,power:18},
  {azimuth:1.6,elevation:0.2,width:0.18,height:0.9,power:14},
  {azimuth:2.6,elevation:0.55,width:0.1,height:0.34,power:16},
  {azimuth:-1.85,elevation:0.18,width:0.2,height:0.8,power:13},
  {azimuth:2.95,elevation:-0.15,width:0.3,height:0.4,power:8},
  {azimuth:-2.2,elevation:-0.3,width:0.3,height:0.4,power:6},
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
    let value=base*(0.55+0.45*Math.max(0,Math.sin(elevation)));
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
  const metal=radianceTexture(width,height,metalBoxes,0.018);
  const gem=radianceTexture(width,height,gemBoxes,0.11);
  metal.name='Original neutral metal softboxes';gem.name='Original neutral gemstone softboxes';
  let disposed=false;
  return {metal,gem,dispose(){if(!disposed){disposed=true;metal.dispose();gem.dispose();}}};
}
