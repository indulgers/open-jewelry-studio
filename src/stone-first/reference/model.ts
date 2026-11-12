import {Box3,Matrix4,Mesh,Vector3,type BufferGeometry,type Object3D} from 'three';
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import type {RingFraming,RingView} from '../ring02/Ring02Stage';

import {isBandMetal,LEGACY_HALO_COLLARS,SEAT_Y} from './parts';
import {prepareReferencePave} from './pave';

type Part={name:string;geometry:BufferGeometry;offsetY?:number;sourceOrder?:number};
export type SourceGem=Part&{zone:'center'|'halo'|'shoulder';matrix:Matrix4};
export type RingAssembly={metal:Part[];stones:SourceGem[];frames:Record<RingView,RingFraming>};
export type ReferenceHead=Pick<RingAssembly,'metal'|'stones'>&{id?:string;seatY:number};
export type ReferenceBand=ReferenceHead&{
  reflowShank?:BufferGeometry;paveRows:()=>ReturnType<typeof prepareReferencePave>;disposePave:()=>void;
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

export function combineReferenceRings(head:ReferenceHead,band:ReferenceBand,adapter?:Part):RingAssembly{
  const same=head.id===band.id;
  if(head===band&&head.id!=='ring-starlight'&&'frames' in head)return head as ReferenceRing;
  // The older halo uses a different neck. Offsets were checked against the actual seat and stone meshes.
  const haloAsHead:Record<string,number>={'ring-floral':.072,'ring-rosette':.056,'ring-petal':.066,'ring-crown':.054,'ring-starlight':.15,'ring-solstice':.01};
  const haloAsBand:Record<string,number>={'ring-floral':-.092,'ring-rosette':-.043,'ring-petal':-.072,'ring-crown':-.17};
  const adjustment=head.id==='ring-02'?(haloAsHead[band.id!]??0):band.id==='ring-02'?(haloAsBand[head.id!]??0):0;
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
  const offsetY=band.seatY-head.seatY+adjustment+(seatCorrection[head.id+':'+band.id]??0);
  const legacyCollars=head.id==='ring-02'?LEGACY_HALO_COLLARS[band.id!]:undefined;
  // Starlight brings its own collar. Keep the target band's structural shoulders.
  const starlightCollars=head.id==='ring-starlight'?({
    'ring-floral':['metal_683'],'ring-rosette':['metal_40'],'ring-petal':['metal_14314'],
    'ring-crown':['metal_23','metal_26'],'ring-solstice':['metal_25'],
  } as Record<string,string[]>)[band.id!]:undefined;
  const removedCollars=legacyCollars??starlightCollars;
  const bandMetal=band.metal.filter(part=>isBandMetal(band.id!,part.name)&&!removedCollars?.includes(part.name));
  const headMetal=head.metal.filter(part=>!isBandMetal(head.id!,part.name));
  if(legacyCollars){
    const shell=adapter??head.metal.find(part=>part.name==='reference_crown_shank_shell');
    if(shell)headMetal.push(shell);
  }
  if(same&&head.id!=='ring-starlight'){
    const order=(a:Part,b:Part)=>(a.sourceOrder??0)-(b.sourceOrder??0);
    const metal=[...headMetal,...bandMetal].sort(order);
    const stones=[...head.stones.filter(stone=>stone.zone!=='shoulder'),...band.stones.filter(stone=>stone.zone==='shoulder')].sort(order);
    return {metal,stones,frames:ringFrames(metal,stones)};
  }
  const metal=[
    ...bandMetal,
    ...headMetal.map(part=>({...part,name:same?part.name:'head:'+part.name,offsetY})),
  ];
  const stones=[
    ...head.stones.filter(stone=>stone.zone!=='shoulder').map(stone=>({...stone,matrix:new Matrix4().makeTranslation(0,offsetY,0).multiply(stone.matrix)})),
    ...band.stones.filter(stone=>stone.zone==='shoulder'),
  ];
  return {metal,stones,frames:ringFrames(metal,stones)};
}
