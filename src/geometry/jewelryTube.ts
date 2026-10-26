import {CatmullRomCurve3,Float32BufferAttribute,TubeGeometry,Vector3} from 'three';

/** Capped metal sweeps: TubeGeometry alone leaves open ends visible in close-ups. */
export function jewelryTube(points:Vector3[],radius:number,closed=false,segments=80){
  const curve=new CatmullRomCurve3(points,closed,'centripetal');
  const radial=12,geometry=new TubeGeometry(curve,segments,radius,radial,closed);
  if(closed)return geometry;
  const positions=Array.from(geometry.attributes.position.array);
  const indices=Array.from(geometry.index!.array);
  for(const end of [0,segments]){
    const point=curve.getPointAt(end/segments),center=positions.length/3;
    positions.push(point.x,point.y,point.z);
    const offset=end*(radial+1);
    for(let j=0;j<radial;j++){
      if(end===0)indices.push(center,offset+j,offset+j+1);
      else indices.push(center,offset+j+1,offset+j);
    }
  }
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}
