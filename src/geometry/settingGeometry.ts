import {type BufferGeometry,SphereGeometry,Vector3} from 'three';
import type {StoneSize} from '../configuration/configuration';
import {stoneScale} from './gemPlacement';
import {jewelryTube} from './jewelryTube';

/** Original six-petal gallery, not a copy of the reference's model. */
export function createSettingGeometry(size:StoneSize):BufferGeometry[]{
  const scale=stoneScale(size),result:BufferGeometry[]=[];
  const girdleY=1.5+0.108*scale;
  for(let i=0;i<6;i++){
    const theta=Math.PI/6+i*Math.PI/3;
    const p=(r:number,y:number)=>new Vector3(Math.cos(theta)*r,y,Math.sin(theta)*r);
    const tip=p(0.302*scale,girdleY+0.026);
    result.push(jewelryTube([
      p(0.09,1.18),p(0.14*scale,1.30),p(0.245*scale,girdleY-0.13),
      p(0.322*scale,girdleY-0.025),tip,
    ],0.022,false,56));
    result.push(new SphereGeometry(0.022,12,8).translate(tip.x,tip.y,tip.z));
  }
  const rail=(radius:number,y:number,thickness:number)=>{
    const circle=Array.from({length:64},(_,i)=>{
      const t=i/64*Math.PI*2;
      return new Vector3(Math.sin(t)*radius,y,Math.cos(t)*radius);
    });
    return jewelryTube(circle,thickness,true,96);
  };
  result.push(rail(0.285*scale,girdleY-0.09,0.014));
  // Continuous lower gallery connects shoulders regardless of their angular placement.
  result.push(rail(0.20*scale,1.36,0.019));
  result.push(rail(0.10,1.18,0.024));
  return result;
}
