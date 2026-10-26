import {BufferGeometry,Float32BufferAttribute,Vector3} from 'three';
import type {ShankStyle,StoneSize} from '../configuration/configuration';
import {stoneScale} from './gemPlacement';
import {jewelryTube} from './jewelryTube';
export {createSettingGeometry} from './settingGeometry';
export function createRingGeometry(style:ShankStyle,size:StoneSize='medium'):BufferGeometry[]{
  if(style==='plain'){
    return [band(0,Math.PI*2)];
  }
  const items:BufferGeometry[]=[band(0.65,Math.PI*2-0.65)];
  const joint=0.2*stoneScale(size)/Math.sqrt(2);
  for(const side of [-1,1])for(const depth of [-1,1]){
    items.push(jewelryTube([
      new Vector3(side*0.72,0.89,depth*0.025),
      new Vector3(side*0.57,1.02,depth*0.08),
      new Vector3(side*0.37,1.19,depth*0.14),
      new Vector3(side*joint,1.36,depth*joint),
    ],0.040,false,80));
  }
  return items;
}
// Broad polished faces and softly bevelled edges, rather than a wire torus.
function band(start:number,end:number){
  const profile:[number,number][]=[];
  const bevel=0.040,halfDepth=0.145,halfThickness=0.095;
  for(let corner=0;corner<4;corner++){
    const angle=corner*Math.PI/2;
    const cr=Math.cos(angle+Math.PI/4)>0?halfThickness-bevel:-halfThickness+bevel;
    const cz=Math.sin(angle+Math.PI/4)>0?halfDepth-bevel:-halfDepth+bevel;
    for(let k=0;k<=6;k++){
      const a=angle+k/6*Math.PI/2;
      profile.push([cr+bevel*Math.cos(a),cz+bevel*Math.sin(a)]);
    }
  }
  const positions:number[]=[],indices:number[]=[];
  const count=profile.length,segments=192;
  for(let i=0;i<=segments;i++){
    const theta=start+(end-start)*i/segments;
    const edge=Math.min(i,segments-i)/segments;
    const taper=start===0?1:Math.min(1,edge/0.12);
    for(const [r,z] of profile){
      const radius=1.15+r*(0.53+0.47*taper);
      positions.push(Math.sin(theta)*radius,Math.cos(theta)*radius,z*(0.38+0.62*taper));
    }
  }
  for(let i=0;i<segments;i++)for(let j=0;j<count;j++){
    const a=i*count+j,b=i*count+(j+1)%count,c=b+count,d=a+count;
    indices.push(a,b,d,b,c,d);
  }
  if(start!==0){
    for(const endpoint of [0,segments]){
      const angle=endpoint===0?start:end;
      const centre=positions.length/3;
      positions.push(Math.sin(angle)*1.15,Math.cos(angle)*1.15,0);
      for(let j=0;j<count;j++){
        const a=endpoint*count+j,b=endpoint*count+(j+1)%count;
        if(endpoint===0)indices.push(centre,b,a);else indices.push(centre,a,b);
      }
    }
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}
