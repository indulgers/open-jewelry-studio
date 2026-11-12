import {CapsuleGeometry, Matrix4, Quaternion, Vector3} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {FittedStone,Zone} from './model';

export function packPaveRow(path:Vector3[], width:number, minimumGap:number){
  const distances=[0];
  for(let i=1;i<path.length;i++){
    distances.push(distances[i-1]+path[i].distanceTo(path[i-1]));
  }
  const length=distances[distances.length-1];
  const count=Math.floor((length+minimumGap)/(width+minimumGap));
  if(count===0)return [];

  const free=length-count*width;
  const gap=count>1?Math.max(minimumGap,free/count):0;
  const endMargin=(free-gap*(count-1))/2;
  let sample=1;
  return Array.from({length:count},(_,index)=>{
    const distance=endMargin+width/2+index*(width+gap);
    while(sample<path.length-1&&distances[sample]<distance)sample++;
    const from=path[sample-1],to=path[sample];
    const t=(distance-distances[sample-1])/(distances[sample]-distances[sample-1]);
    return {
      distance,
      center:from.clone().lerp(to,t),
      tangent:to.clone().sub(from).normalize(),
    };
  });
}

export function edgeExtent(stone:Pick<FittedStone,'geometry'|'matrix'>,direction:Vector3){
  const positions=stone.geometry.getAttribute('position');
  const e=stone.matrix.elements;
  const dx=direction.x*e[0]+direction.y*e[1]+direction.z*e[2];
  const dy=direction.x*e[4]+direction.y*e[5]+direction.z*e[6];
  const dz=direction.x*e[8]+direction.y*e[9]+direction.z*e[10];
  let extent=-Infinity;
  for(let i=0;i<positions.count;i++){
    extent=Math.max(extent,positions.getX(i)*dx+positions.getY(i)*dy+positions.getZ(i)*dz);
  }
  return extent;
}

function sourceArc(a:Vector3,b:Vector3,zone:Exclude<Zone,'center'>){
  const halo=zone==='halo';
  const angle=(point:Vector3)=>halo?Math.atan2(point.z,point.x):Math.atan2(point.x,point.y);
  const radius=(point:Vector3)=>Math.hypot(point.x,halo?point.z:point.y);
  const dr=radius(b)-radius(a);
  const delta=angle(b)-angle(a);
  const arc=(radius(b)+radius(a))/2*Math.atan2(Math.sin(delta),Math.cos(delta));
  return Math.hypot(arc,dr,halo?b.y-a.y:b.z-a.z);
}

export function paveSpacing(stones:FittedStone[],zone:Exclude<Zone,'center'>){
  const rows=new Map<string,FittedStone[]>();
  for(const stone of stones){
    if(stone.zone!==zone||stone.source.divider)continue;
    const row=stone.name.replace(/_\d+$/,'');
    if(!rows.has(row))rows.set(row,[]);
    rows.get(row)!.push(stone);
  }
  const gaps:number[]=[];
  let count=0;
  for(const row of rows.values()){
    count+=row.length;
    for(let index=1;index<row.length;index++){
      const first=row[index-1],second=row[index];
      const a=new Vector3().setFromMatrixPosition(first.matrix);
      const b=new Vector3().setFromMatrixPosition(second.matrix);
      const direction=b.clone().sub(a).normalize();
      const distance=first.paveDistance!==undefined&&second.paveDistance!==undefined
        ?second.paveDistance-first.paveDistance
        :sourceArc(a,b,zone);
      gaps.push(Math.max(0,distance-edgeExtent(first,direction)-edgeExtent(second,direction.negate())));
    }
  }
  return {count,minGap:gaps.length?Math.min(...gaps):null,maxGap:gaps.length?Math.max(...gaps):null};
}

export function buildPaveSeat(stone:FittedStone){
  const center=new Vector3(),rotation=new Quaternion(),scale=new Vector3();
  stone.matrix.decompose(center,rotation,scale);
  const size=stone.geometry.boundingBox!.getSize(new Vector3()).multiply(scale);
  const basis=new Matrix4().makeRotationFromQuaternion(rotation).setPosition(center);
  const diameter=Math.min(size.x,size.z);
  const posts=[];
  for(const x of [-1,1]){
    for(const z of [-1,1]){
      // The post foot sinks into the original continuous support; its tip stays at the girdle.
      posts.push(new CapsuleGeometry(.075*diameter,.38*diameter,4,8)
        .translate(x*.37*size.x,-.18*diameter,z*.37*size.z).applyMatrix4(basis));
    }
  }
  const geometry=mergeGeometries(posts);
  posts.forEach(post=>post.dispose());
  return {name:stone.name+'_seat',geometry,owned:true};
}
