import {DataTexture,DataUtils,EquirectangularReflectionMapping,HalfFloatType,
  LinearFilter,LinearMipmapLinearFilter,LinearSRGBColorSpace,RGBAFormat} from 'three';

type Softbox={azimuth:number;elevation:number;width:number;height:number;power:number;feather?:number};
const metalBoxes:Softbox[]=[
  {azimuth:-1.15,elevation:0.35,width:0.65,height:1.05,power:1.8,feather:0.9},
  {azimuth:1.25,elevation:0.25,width:0.12,height:1.15,power:2.4,feather:0.45},
  {azimuth:0,elevation:1.2,width:1.2,height:0.35,power:0.85,feather:0.85},
  {azimuth:2.8,elevation:0.2,width:0.6,height:0.9,power:0.7,feather:0.9},
  // Negative cards remove tent fill, giving polished metal narrow dark reflections.
  {azimuth:0.42,elevation:0.05,width:0.16,height:1.3,power:-0.8,feather:0.45},
  {azimuth:-2.1,elevation:0.1,width:0.24,height:1.25,power:-0.8,feather:0.6},
  {azimuth:2.4,elevation:-0.15,width:0.1,height:1.2,power:-0.8,feather:0.45},
];
const gemBoxes:Softbox[]=[
  {azimuth:0,elevation:1.25,width:Math.PI,height:0.5,power:0.55,feather:0.5},
  {azimuth:0,elevation:-1.15,width:Math.PI,height:0.55,power:0.28,feather:0.65},
  {azimuth:-0.55,elevation:0.8,width:0.4,height:0.42,power:1.8,feather:0.55},
  {azimuth:1.25,elevation:0.25,width:0.12,height:0.85,power:2.6,feather:0.4},
  {azimuth:-2.15,elevation:0.25,width:0.28,height:0.7,power:1.6,feather:0.6},
  {azimuth:2.7,elevation:-0.25,width:0.4,height:0.45,power:1.1,feather:0.6},
  {azimuth:0.25,elevation:-0.7,width:0.17,height:0.16,power:2.2,feather:0.4},
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
      const edge=1-(box.feather??0.15);
      const horizontal=1-smooth(box.width*edge,box.width,delta);
      const vertical=1-smooth(box.height*edge,box.height,Math.abs(elevation-box.elevation));
      value+=box.power*horizontal*vertical;
    }
    const i=(y*width+x)*4,encoded=DataUtils.toHalfFloat(Math.max(0.005,value));
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
  const metal=radianceTexture(width,height,metalBoxes,0.82);
  const gem=radianceTexture(width,height,gemBoxes,0.2);
  metal.name='Original neutral metal softboxes';gem.name='Original neutral gemstone softboxes';
  let disposed=false;
  return {metal,gem,dispose(){if(!disposed){disposed=true;metal.dispose();gem.dispose();}}};
}
