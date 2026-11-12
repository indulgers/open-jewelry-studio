import {Box3,Matrix4,Mesh,Vector3,type BufferGeometry,type Object3D} from 'three';
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import type {RingFraming,RingView} from '../ring02/Ring02Stage';

import {isBandMetal,SEAT_Y} from './parts';

type Part={name:string;geometry:BufferGeometry;offsetY?:number};
export type SourceGem=Part&{zone:'center'|'halo'|'shoulder';matrix:Matrix4};
export function prepareReferenceRing(scene:Object3D,id?:string){
  const bounds=new Box3().setFromObject(scene);
  const width=bounds.max.x-bounds.min.x;
  if(!Number.isFinite(width)||width<=0)throw new Error('戒指模型为空');
  // These supplied sources put the finger axis above zero. Center the bore without changing proportions.
  const scale=2/width,axisY=bounds.min.y+width/2;
  const metal:Part[]=[],stones:SourceGem[]=[];
  scene.traverse(object=>{
    if(!(object instanceof Mesh))return;
    const match=/^gem_(center|halo|shoulder)(?:_|$)/.exec(object.name);
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
  const frames=ringFrames(metal,stones);
  return {id,seatY:((id?SEAT_Y[id]:0)-axisY)*scale,metal,stones,frames,
    dispose:()=>[...metal,...stones].forEach(part=>part.geometry.dispose())};
}

function ringFrames(metal:Part[],stones:SourceGem[]):Record<RingView,RingFraming>{
  const bounds=new Box3(), partBounds=new Box3();
  for(const part of metal)bounds.union(partBounds.copy(part.geometry.boundingBox!).translate(new Vector3(0,part.offsetY??0,0)));
  for(const stone of stones)bounds.union(partBounds.copy(stone.geometry.boundingBox!).applyMatrix4(stone.matrix));
  const center=stones.find(stone=>stone.zone==='center')!;
  const crown=center.geometry.boundingBox!.getCenter(new Vector3()).applyMatrix4(center.matrix).y;
  return {
    overall:{position:[2.2,2.5,3.6],target:[0,(bounds.max.y+bounds.min.y)/2,0],height:(bounds.max.y-bounds.min.y)*1.13},
    top:{position:[0,crown+4,.001],target:[0,crown,0],height:1.3},
    side:{position:[0,crown-.23,3.8],target:[0,crown-.23,0],height:1.55},
    macro:{position:[1.7,crown+1.46,2.6],target:[0,crown,0],height:1.12},
  };
}

export function combineReferenceRings(head:ReferenceRing,band:ReferenceRing){
  if(head===band)return head;
  // The older halo uses a different neck. Offsets were checked against the actual seat and stone meshes.
  const haloAsHead:Record<string,number>={'ring-floral':.072,'ring-rosette':.056,'ring-petal':.066,'ring-crown':.054};
  const haloAsBand:Record<string,number>={'ring-floral':-.092,'ring-rosette':-.043,'ring-petal':-.072,'ring-crown':-.17};
  const adjustment=head.id==='ring-02'?haloAsHead[band.id!]:band.id==='ring-02'?haloAsBand[head.id!]:0;
  const offsetY=band.seatY-head.seatY+adjustment;
  const haloOnWideBand=head.id==='ring-02'&&band.id==='ring-crown';
  const metal=[
    ...band.metal.filter(part=>isBandMetal(band.id!,part.name)&&!(haloOnWideBand&&['metal_23','metal_26'].includes(part.name))),
    ...head.metal.filter(part=>!isBandMetal(head.id!,part.name)||(haloOnWideBand&&part.name==='reference_crown_shank_shell')).map(part=>({...part,name:'head:'+part.name,offsetY})),
  ];
  const stones=[
    ...head.stones.filter(stone=>stone.zone!=='shoulder').map(stone=>({...stone,matrix:new Matrix4().makeTranslation(0,offsetY,0).multiply(stone.matrix)})),
    ...band.stones.filter(stone=>stone.zone==='shoulder'),
  ];
  return {metal,stones,frames:ringFrames(metal,stones)};
}
export type ReferenceRing=ReturnType<typeof prepareReferenceRing>;
