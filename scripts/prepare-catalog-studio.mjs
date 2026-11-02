// Bake a neutral light tent over the bundled Studio Small 09 photograph.
import {readFileSync,writeFileSync} from 'node:fs';
import {FloatType} from 'three';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';

const folder=new URL('../public/environments/',import.meta.url);
const source=readFileSync(new URL('studio_small_09_1k.hdr',folder));
const photo=new HDRLoader().setDataType(FloatType).parse(
  source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength));
const width=512,height=256,pixels=Buffer.alloc(width*height*4);

// Azimuth, elevation and angular half-widths in radians; the last value is radiance.
const softboxes=[
  [-1.1,0.25,0.105,0.76,1.7], [0.89,0.26,0.25,0.60,1.18],
  [2.43,0.32,0.10,0.60,2.4], [-2.04,0.83,0.34,0.18,1.42], [0.1,1.19,0.65,0.17,1.13],
];
const flags=[[-0.78,0.05,0.22,0.61],[1.62,0.04,0.14,0.73],[-2.85,0.06,0.12,0.58],[2.80,-0.06,0.42,0.56]];

for(let y=0;y<height;y++){
  const elevation=(0.5-(y+0.5)/height)*Math.PI;
  for(let x=0;x<width;x++){
    const azimuth=((x+0.5)/width-0.5)*Math.PI*2;
    function windowAt(a,e,w,h,power=2){
      const distance=Math.abs(azimuth-a),dx=Math.min(distance,2*Math.PI-distance)/w;
      return Math.exp(-0.5*(dx**power+((elevation-e)/h)**power));
    }
    let tent=0.30+0.13*(1+Math.sin(elevation))+0.78*windowAt(0.5,0.4,1.25,0.9)
      +0.60*windowAt(-2.4,0.05,0.82,0.63)+0.46*windowAt(0.9,-1.1,1.3,0.52);
    for(const [a,e,w,h] of flags)tent*=1-0.94*windowAt(a,e,w,h,4);
    const horizon=(elevation+0.18+0.15*Math.cos(azimuth+0.28))/0.11;
    tent*=1-0.70*Math.exp(-0.5*horizon*horizon)*(0.58+0.42*Math.cos(azimuth-0.55));
    for(const [a,e,w,h,light] of softboxes)tent+=light*windowAt(a,e,w,h);

    const i=4*(Math.floor(y*photo.height/height)*photo.width+Math.floor(x*photo.width/width));
    const luminance=0.2126*photo.data[i]+0.7152*photo.data[i+1]+0.0722*photo.data[i+2];
    const radiance=tent*(0.32+0.62*(1-Math.exp(-2.2*luminance)))+0.38*luminance/(1+luminance/5);
    const exponent=Math.floor(Math.log2(radiance))+1;
    const offset=4*(y*width+x);
    pixels.fill(Math.floor(radiance*2**(8-exponent)),offset,offset+3);
    pixels[offset+3]=128+exponent;
  }
}
const header=Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`);
writeFileSync(new URL('catalog-studio.hdr',folder),Buffer.concat([header,pixels]));
