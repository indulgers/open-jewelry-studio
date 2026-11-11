import {Box3,Matrix4,Mesh,Vector3,type BufferGeometry,type Object3D} from 'three';
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import type {RingFraming,RingView} from '../ring02/Ring02Stage';

type Part={name:string;geometry:BufferGeometry};
export type SourceGem=Part&{zone:'center'|'halo'|'shoulder';matrix:Matrix4};
export function prepareReferenceRing(scene:Object3D){
  const bounds=new Box3().setFromObject(scene);
  const width=bounds.max.x-bounds.min.x;
  if(!Number.isFinite(width)||width<=0)throw new Error('戒指模型为空');
  // These supplied sources put the finger axis above zero. Center the bore without changing proportions.
  const scale=2/width,axisY=bounds.min.y+width/2;
  const metal:Part[]=[],stones:SourceGem[]=[];
  scene.traverse(object=>{
    if(!(object instanceof Mesh))return;
    const match=/^gem_(center|halo|shoulder)_/.exec(object.name);
    const geometry=match?object.geometry:toCreasedNormals(object.geometry,Math.PI/4);
    if(geometry!==object.geometry)object.geometry.dispose();
    geometry.scale(scale,scale,scale).translate(0,-axisY*scale,0);
    geometry.computeBoundingBox();
    if(match)stones.push({name:object.name,geometry,zone:match[1] as SourceGem['zone'],matrix:new Matrix4()});
    else metal.push({name:object.name,geometry});
    const materials=Array.isArray(object.material)?object.material:[object.material];
    materials.forEach(material=>material.dispose());
  });
  const center=stones.find(stone=>stone.zone==='center');
  if(!center||!metal.length){[...metal,...stones].forEach(part=>part.geometry.dispose());throw new Error('模型缺少主石或戒托');}
  const crown=center.geometry.boundingBox!.getCenter(new Vector3()).y;
  const top=(bounds.max.y-axisY)*scale;
  const height=(bounds.max.y-bounds.min.y)*scale;
  const frames:Record<RingView,RingFraming>={
    overall:{position:[2.2,2.5,3.6],target:[0,(top-1)/2,0],height:height*1.13},
    top:{position:[0,crown+4,.001],target:[0,crown,0],height:1.3},
    side:{position:[0,crown-.23,3.8],target:[0,crown-.23,0],height:1.55},
    macro:{position:[1.7,crown+1.46,2.6],target:[0,crown,0],height:1.12},
  };
  return {metal,stones,frames,dispose:()=>[...metal,...stones].forEach(part=>part.geometry.dispose())};
}
export type ReferenceRing=ReturnType<typeof prepareReferenceRing>;
