import {MeshBVH} from 'three-mesh-bvh';
import {Box3,CylinderGeometry,DoubleSide,Ray,Matrix4,Mesh,Vector3,type BufferGeometry,type Object3D} from 'three';
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import type {RingFraming,RingView} from '../ring02/Ring02Stage';

import {isBandMetal,LEGACY_HALO_COLLARS,SEAT_Y} from './parts';
import {prepareReferencePave} from './pave';

export type Part={name:string;geometry:BufferGeometry;offsetY?:number;sourceOrder?:number};
export type SourceGem=Part&{zone:'center'|'halo'|'shoulder';matrix:Matrix4};
export type RingAssembly={metal:Part[];stones:SourceGem[];frames:Record<RingView,RingFraming>};
export type ReferenceHead=Pick<RingAssembly,'metal'|'stones'>&{id?:string;seatY:number;classified?:boolean;profileId?:string};
export type ReferenceBand=ReferenceHead&{
  paveMetalNames?:string[];supportMetal?:Part[];reflowShank?:BufferGeometry;paveRows:()=>ReturnType<typeof prepareReferencePave>;disposePave:()=>void;
};
export type ReferenceRing=RingAssembly&ReferenceBand&{dispose:()=>void};

export function prepareReferenceGeometry(scene:Object3D,scale:number,axisY:number){
  const metal:Part[]=[],stones:SourceGem[]=[];
  let reflowShank:BufferGeometry|undefined;
  scene.traverse(object=>{
    if(!(object instanceof Mesh))return;
    const match=/^gem_(center|halo|shoulder)(?:_|$)/.exec(object.name);
    const geometry=match?object.geometry:toCreasedNormals(object.geometry,Math.PI/4);
    if(geometry!==object.geometry)object.geometry.dispose();
    geometry.scale(scale,scale,scale).translate(0,-axisY*scale,0);
    geometry.computeBoundingBox();
    const part={name:object.name,geometry,sourceOrder:object.userData.sourceOrder as number|undefined};
    if(match)stones.push({...part,zone:match[1] as SourceGem['zone'],matrix:new Matrix4()});
    else if(object.name==='metal_reflow_shank')reflowShank=geometry;
    else metal.push(part);
    const materials=Array.isArray(object.material)?object.material:[object.material];
    materials.forEach(material=>material.dispose());
  });
  return {metal,stones,reflowShank,dispose(){
    reflowShank?.dispose();
    for(const part of [...metal,...stones])part.geometry.dispose();
  }};
}

export function prepareReferenceBand(band:Omit<ReferenceBand,'paveRows'|'disposePave'>):ReferenceBand{
  let paved:ReturnType<typeof prepareReferencePave>|undefined;
  return {...band,
    paveRows:()=>paved===undefined?(paved=prepareReferencePave(band)):paved,
    disposePave:()=>paved?.dispose(),
  };
}

export function prepareReferenceRing(scene:Object3D,id?:string):ReferenceRing{
  const bounds=new Box3().setFromObject(scene);
  const width=bounds.max.x-bounds.min.x;
  if(!Number.isFinite(width)||width<=0)throw new Error('戒指模型为空');
  const scale=2/width,axisY=bounds.min.y+width/2;
  const parts=prepareReferenceGeometry(scene,scale,axisY);
  if(!parts.stones.some(stone=>stone.zone==='center')||!parts.metal.length){
    parts.dispose();
    throw new Error('模型缺少主石或戒托');
  }
  const band=prepareReferenceBand({id,seatY:((id?SEAT_Y[id]:0)-axisY)*scale,...parts});
  return {...band,frames:ringFrames(parts.metal,parts.stones),dispose(){band.disposePave();parts.dispose();}};
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

const collisionOptions={indirect:true,setBoundingBox:false};
const collisionTrees=new WeakMap<BufferGeometry,MeshBVH>();
export function geometryIntersects(a:BufferGeometry,b:BufferGeometry,matrix:Matrix4){
  if(!a.boundingBox!.intersectsBox(b.boundingBox!.clone().applyMatrix4(matrix)))return false;
  for(const geometry of [a,b])if(!collisionTrees.has(geometry)){
    const tree=new MeshBVH(geometry,collisionOptions);
    collisionTrees.set(geometry,tree);Object.assign(geometry,{boundsTree:tree});
  }
  for(const geometry of [a,b])Object.assign(geometry,{boundsTree:collisionTrees.get(geometry)});
  return collisionTrees.get(a)!.intersectsGeometry(b,matrix);
}

function fitHead(headMetal:Part[],headStones:SourceGem[],bandMetal:Part[],shoulders:SourceGem[],offset:number){
  const transform=new Matrix4(),relative=new Matrix4();
  const collides=(y:number)=>{
    transform.makeTranslation(0,y,0);
    return headStones.some(stone=>bandMetal.some(part=>geometryIntersects(part.geometry,stone.geometry,relative.multiplyMatrices(transform,stone.matrix))))
      ||shoulders.some(stone=>headMetal.some(part=>geometryIntersects(stone.geometry,part.geometry,relative.multiplyMatrices(stone.matrix.clone().invert(),transform))))
      ||headStones.some(stone=>shoulders.some(other=>geometryIntersects(other.geometry,stone.geometry,relative.copy(other.matrix).invert().multiply(transform).multiply(stone.matrix))));
  };
  // Search from the reviewed seat, keeping the entire head and all decoration together.
  let clear:number|undefined;
  for(let step=0;step<=160;step++)for(const direction of step?[1,-1]:[1]){
    const y=offset+direction*step*.005;
    if(collides(y))continue;
    clear??=y;
    transform.makeTranslation(0,y,0);
    if(headMetal.some(head=>bandMetal.some(band=>geometryIntersects(band.geometry,head.geometry,transform))))return y;
  }
  if(clear!==undefined)return clear;
  throw new Error('这组部件无法安全接合，请换一个戒圈或回后台复核接合点。');
}

export function connection(head:Part[],band:Part[],offset:number,stones:SourceGem[]):Part|undefined{
  const mount=new Matrix4().makeTranslation(0,offset,0);
  if(!head.length||head.some(a=>band.some(b=>geometryIntersects(b.geometry,a.geometry,mount))))return;
  const at=(parts:Part[],up:boolean,x:number,z:number)=>parts.flatMap(part=>{
    if(!collisionTrees.has(part.geometry))collisionTrees.set(part.geometry,new MeshBVH(part.geometry,collisionOptions));
    const hit=collisionTrees.get(part.geometry)!.raycastFirst(new Ray(new Vector3(x,up?-5:5,z),new Vector3(0,up?1:-1,0)),DoubleSide);
    return hit?[hit.point.y]:[];
  });
  const candidates=[0,-.08,.08,-.16,.16,-.24,.24].flatMap(x=>[0,-.08,.08,-.16,.16,-.24,.24].map(z=>({x,z,top:Math.max(...at(band,false,x,z)),bottom:Math.min(...at(head,true,x,z))+offset})))
    .filter(({top,bottom})=>Number.isFinite(top)&&Number.isFinite(bottom)&&bottom>top&&bottom-top<=.35)
    .sort((a,b)=>(a.bottom-a.top)-(b.bottom-b.top));
  for(const {x,z,top,bottom} of candidates){
    const geometry=new CylinderGeometry(.045,.045,bottom-top+.012,32).translate(x,(top+bottom)/2,z);
    geometry.computeBoundingBox();
    if(stones.some(stone=>geometryIntersects(geometry,stone.geometry,stone.matrix))){geometry.dispose();continue;}
    if(!head.some(part=>geometryIntersects(geometry,part.geometry,mount))||!band.some(part=>geometryIntersects(geometry,part.geometry,new Matrix4()))){geometry.dispose();continue;}
    return {name:'head:connection',geometry,offsetY:0};
  }
  throw new Error('接合处需要重新复核：请调整接合点或选择其他戒圈。');
}

export function combineReferenceRings(head:ReferenceHead,band:ReferenceBand,adapter?:Part):RingAssembly{
  const headProfile=head.profileId??head.id;
  const bandProfile=band.profileId??band.id;
  const same=headProfile===bandProfile;
  if(head===band&&headProfile!=='ring-starlight'&&'frames' in head)return head as ReferenceRing;
  // The older halo uses a different neck. Offsets were checked against the actual seat and stone meshes.
  const haloAsHead:Record<string,number>={'ring-floral':.072,'ring-rosette':.056,'ring-petal':.066,'ring-crown':.054,'ring-starlight':.15,'ring-solstice':.01};
  const haloAsBand:Record<string,number>={'ring-floral':-.092,'ring-rosette':-.043,'ring-petal':-.072,'ring-crown':-.17};
  const adjustment=headProfile==='ring-02'?(haloAsHead[bandProfile!]??0):bandProfile==='ring-02'?(haloAsBand[headProfile!]??0):0;
  const seatCorrection:Record<string,number>={
    'ring-starlight:ring-crown':.05,
    'ring-starlight:ring-starlight':.04,
    'ring-starlight:ring-solstice':.068,
    'ring-starlight:ring-rosette':.02,
    'ring-solstice:ring-floral':.04,
    'ring-solstice:ring-petal':.02,
    'ring-solstice:ring-crown':.10,
    'ring-solstice:ring-starlight':.10,
  };
  let offsetY=band.seatY-head.seatY+adjustment+(seatCorrection[headProfile+':'+bandProfile]??0);
  const legacyCollars=headProfile==='ring-02'?LEGACY_HALO_COLLARS[bandProfile!]:undefined;
  // Starlight brings its own collar. Keep the target band's structural shoulders.
  const starlightCollars=headProfile==='ring-starlight'?({
    'ring-floral':['metal_683'],'ring-rosette':['metal_40'],'ring-petal':['metal_14314'],
    'ring-crown':['metal_23','metal_26'],'ring-solstice':['metal_25'],
  } as Record<string,string[]>)[bandProfile!]:undefined;
  const removedCollars=legacyCollars??starlightCollars;
  const bandMetal=band.metal.filter(part=>(band.classified||isBandMetal(band.id!,part.name))&&!removedCollars?.includes(part.name));
  const headMetal=head.metal.filter(part=>head.classified||!isBandMetal(head.id!,part.name));
  if(legacyCollars){
    const shell=adapter??head.metal.find(part=>part.name==='reference_crown_shank_shell');
    if(shell)headMetal.push(shell);
  }
  if(same&&headProfile!=='ring-starlight'){
    const order=(a:Part,b:Part)=>(a.sourceOrder??0)-(b.sourceOrder??0);
    const metal=[...headMetal,...bandMetal].sort(order);
    const stones=[...head.stones.filter(stone=>stone.zone!=='shoulder'),...band.stones.filter(stone=>stone.zone==='shoulder')].sort(order);
    return {metal,stones,frames:ringFrames(metal,stones)};
  }
  if(!same&&((head.classified&&!head.profileId)||(band.classified&&!band.profileId))){
    offsetY=fitHead(headMetal,head.stones.filter(stone=>stone.zone!=='shoulder'),bandMetal,band.stones.filter(stone=>stone.zone==='shoulder'),offsetY);
  }
  const metal=[
    ...bandMetal,
    ...headMetal.map(part=>({...part,name:same?part.name:'head:'+part.name,offsetY})),
  ];
  const stones=[
    ...head.stones.filter(stone=>stone.zone!=='shoulder').map(stone=>({...stone,matrix:new Matrix4().makeTranslation(0,offsetY,0).multiply(stone.matrix)})),
    ...band.stones.filter(stone=>stone.zone==='shoulder'),
  ];
  if(!same&&((head.classified&&!head.profileId)||(band.classified&&!band.profileId))){
    const bridge=connection(headMetal,bandMetal,offsetY,stones);
    if(bridge)metal.push(bridge);
  }
  return {metal,stones,frames:ringFrames(metal,stones)};
}
