import {Box3, Matrix4, Mesh, Quaternion, Vector3, MathUtils, type BufferGeometry, type Object3D} from 'three';
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {firstMeshGeometry} from '../../geometry/productGeometry';
import {STONE_APPEARANCES, type StoneAppearance} from '../../viewer/stoneAppearance';
import {prepareGirdleGem} from '../gemFit';
import stoneIndex from './stones.json';
import {buildSolitaireHead,HEADS,type Head} from './head';

export const ZONES=['center','halo','shoulder'] as const;
export const SIZES=[0.94,1,1.06] as const;
export const REACHES=[0.97,1,1.05] as const;
export type Zone=typeof ZONES[number];
export type StoneSpec={cut:'round'|'oval';size:typeof SIZES[number];appearance:StoneAppearance};
export type RingDesign=Record<Zone,StoneSpec>&{head:Head;reach:typeof REACHES[number];metal:'white'|'yellow'|'rose'};
export const TEMPLATE_REVISION='ring-02-source-split-1';
const ORIGINAL_STONE:StoneSpec={cut:'round',size:1,appearance:'diamond'};
export const BASE_DESIGN:RingDesign={
  head:'halo',center:ORIGINAL_STONE,halo:ORIGINAL_STONE,shoulder:ORIGINAL_STONE,reach:1,metal:'white',
};

function record(value:unknown):value is Record<string,unknown>{
  return typeof value==='object'&&value!==null;
}
export function parseDesign(value:unknown):RingDesign|null{
  if(!record(value))return null;
  const {head='halo',center,halo,shoulder,reach,metal}=value;
  const spec=(v:unknown):v is StoneSpec=>record(v)&&(v.cut==='round'||v.cut==='oval')
    &&SIZES.some(size=>size===v.size)&&typeof v.appearance==='string'&&Object.hasOwn(STONE_APPEARANCES,v.appearance);
  if(!HEADS.some(([id])=>id===head)||!spec(center)||!spec(halo)||!spec(shoulder)||!REACHES.some(length=>length===reach)
    ||(metal!=='white'&&metal!=='yellow'&&metal!=='rose'))return null;
  return {head:head as Head,center,halo,shoulder,reach:reach as RingDesign['reach'],metal};
}

type Part={name:string;geometry:BufferGeometry};
type StoneSource=Part&{zone:Zone;divider:boolean;center:Vector3;rotation:Quaternion;width:number};
export type FittedStone=Part&{zone:Zone;appearance:StoneAppearance;matrix:Matrix4;seat:Matrix4;source:StoneSource};
type Template={metal:Part[];stones:StoneSource[];oval:BufferGeometry;ovalAspect:number;originalIntersections:Set<string>};
const vertical=new Vector3(0,1,0),depth=new Vector3(0,0,1),unit=new Vector3(1,1,1);

function stoneSource(geometry:BufferGeometry,data:typeof stoneIndex[number]):StoneSource{
  const y=new Vector3().fromArray(data.normal).normalize();
  const x=new Vector3().crossVectors(y,depth).normalize();
  const z=new Vector3().crossVectors(x,y);
  const frame=new Matrix4().makeBasis(x,y,z);
  const local=geometry.clone().applyMatrix4(frame.clone().invert());
  local.computeBoundingBox();
  const pivot=local.boundingBox!.getCenter(new Vector3());
  const p=local.getAttribute('position');
  let radius=0;
  for(let i=0;i<p.count;i++)radius=Math.max(radius,Math.hypot(p.getX(i)-pivot.x,p.getZ(i)-pivot.z));
  const rim=new Set<number>();
  for(let i=0;i<p.count;i++){
    if(Math.hypot(p.getX(i)-pivot.x,p.getZ(i)-pivot.z)>=radius*.99)rim.add(p.getY(i));
  }
  pivot.y=[...rim].reduce((sum,y)=>sum+y,0)/rim.size;
  local.translate(-pivot.x,-pivot.y,-pivot.z);
  local.computeBoundingBox();
  return {name:data.name,geometry:local,zone:data.zone as Zone,divider:data.name.includes('_divider_'),
    center:pivot.applyMatrix4(frame),rotation:new Quaternion().setFromRotationMatrix(frame),width:2*radius};
}

export function prepareTemplate(ring:Object3D,ovalScene:Object3D):Template{
  const index=new Map(stoneIndex.map(data=>[data.name,data]));
  const metal:Part[]=[],stones:StoneSource[]=[];
  ring.traverse(object=>{
    if(!(object instanceof Mesh))return;
    const data=index.get(object.name);
    if(data){
      stones.push(stoneSource(object.geometry,data));
      object.geometry.dispose();
    }else if(!object.name.startsWith('unresolved_')){
      const geometry=toCreasedNormals(object.geometry,Math.PI/4);
      metal.push({name:object.name,geometry});
      if(geometry!==object.geometry)object.geometry.dispose();
    }else{
      object.geometry.dispose();
    }
    const materials=Array.isArray(object.material)?object.material:[object.material];
    materials.forEach(material=>material.dispose());
  });
  if(stones.length!==index.size||stones[0]?.zone!=='center'||!metal.length)throw new Error('戒指模板缺少镶位或金属部件');
  const sourceOval=firstMeshGeometry(ovalScene);
  const {geometry:oval}=prepareGirdleGem(sourceOval);
  sourceOval.dispose();
  const size=oval.boundingBox!.getSize(new Vector3());
  if(size.z>size.x)oval.rotateY(Math.PI/2);
  oval.computeBoundingBox();
  const template={metal,stones,oval,ovalAspect:Math.min(size.x,size.z)/Math.max(size.x,size.z),originalIntersections:new Set<string>()};
  template.originalIntersections=new Set(intersections(fitStones(template,BASE_DESIGN)));
  return template;
}

function crownScale(template:Template,design:RingDesign){
  const radius=template.stones[0].width/2;
  const ratio=design.center.cut==='oval'?template.ovalAspect:1;
  const mainX=design.center.size/Math.sqrt(ratio),mainZ=design.center.size*Math.sqrt(ratio);
  const haloMargin=Math.max(0,design.halo.size-1);
  return {
    mainX,mainZ,
    x:1+Math.max(0,radius*(mainX-1))/3.28+haloMargin,
    z:1+Math.max(0,radius*(mainZ-1))/3.28+haloMargin,
  };
}

function shoulderTurn(x:number,y:number,reach:number){
  const angle=Math.atan2(Math.abs(x),y);
  return -Math.sign(x)*(reach-1)*Math.max(0,angle-.29)*(1-MathUtils.smoothstep(angle,1.01,1.14));
}

export function fitStones(template:Template,design:RingDesign):FittedStone[]{
  const crown=crownScale(template,design);
  const active=design.head==='halo'?template.stones:template.stones.filter(stone=>stone.zone!=='halo');
  return active.map(source=>{
    const spec=source.divider?ORIGINAL_STONE:design[source.zone];
    const center=source.center.clone(),rotation=source.rotation.clone();
    const size=source.zone==='center'?crown.mainX:spec.size;
    const seatScale=new Vector3(size,size,size);
    if(source.zone==='halo'){
      center.x*=crown.x;
      center.z*=crown.z;
      if(spec.cut==='oval')rotation.premultiply(new Quaternion().setFromAxisAngle(vertical,-Math.atan2(center.z,center.x)));
    }
    if(source.zone==='shoulder'){
      const turn=shoulderTurn(center.x,center.y,design.reach);
      center.applyAxisAngle(depth,turn);
      rotation.premultiply(new Quaternion().setFromAxisAngle(depth,turn));
    }
    if(spec.cut==='oval')seatScale.z*=template.ovalAspect;

    const modelScale=spec.cut==='oval'?size*source.width/2:size;
    const matrix=new Matrix4().compose(center,rotation,new Vector3().setScalar(modelScale));
    const original=new Matrix4().compose(source.center,source.zone==='halo'?rotation:source.rotation,unit);
    const seat=new Matrix4().compose(center,rotation,seatScale).multiply(original.invert());
    return {source,name:source.name,zone:source.zone,geometry:spec.cut==='oval'?template.oval:source.geometry,
      appearance:spec.appearance,matrix,seat};
  });
}

const trees=new WeakMap<BufferGeometry,MeshBVH>();
function tree(geometry:BufferGeometry){
  let bvh=trees.get(geometry);
  if(!bvh){bvh=new MeshBVH(geometry);trees.set(geometry,bvh);}
  return bvh;
}
function intersections(stones:FittedStone[]){
  const bounds=stones.map(stone=>new Box3().copy(stone.geometry.boundingBox!).applyMatrix4(stone.matrix));
  const relative=new Matrix4(),pairs:string[]=[];
  stones.forEach((a,i)=>{
    for(let j=i+1;j<stones.length;j++){
      if(!bounds[i].intersectsBox(bounds[j]))continue;
      const b=stones[j];
      relative.copy(a.matrix).invert().multiply(b.matrix);
      tree(b.geometry);
      if(tree(a.geometry).intersectsGeometry(b.geometry,relative))pairs.push(a.name+' / '+b.name);
    }
  });
  return pairs;
}
export function findNewIntersection(template:Template,stones:FittedStone[]){
  return intersections(stones).find(pair=>!template.originalIntersections.has(pair));
}

export function buildMetal(template:Template,design:RingDesign,stones:FittedStone[]){
  const crown=crownScale(template,design);
  const originalHead=design.head==='halo';
  const crownChanged=originalHead&&(design.center.cut!=='round'||design.center.size!==1||design.halo.cut!=='round'||design.halo.size!==1);
  const shoulderChanged=design.reach!==1||design.shoulder.size!==1||design.shoulder.cut!=='round';
  const shoulderSeats=stones.filter(s=>s.zone==='shoulder');
  const haloSeats=stones.filter(s=>s.zone==='halo');
  const original=new Vector3(),target=new Vector3(),offset=new Vector3(),near=new Vector3();
  const isShoulder=(part:Part)=>part.name==='metal_shank_with_shoulders'||part.name.startsWith('metal_shoulder_');
  const source=originalHead?template.metal:template.metal.filter(part=>isShoulder(part)||part.name==='metal_lower_shank_shell');
  const parts=source.map(part=>{
    const shank=part.name==='metal_shank_with_shoulders';
    const shoulder=isShoulder(part);
    if(part.name==='metal_lower_shank_shell'||!(crownChanged||(shoulder&&shoulderChanged))){
      return {...part,owned:false};
    }
    const geometry=part.geometry.clone(),p=geometry.getAttribute('position');
    for(let i=0;i<p.count;i++){
      original.fromBufferAttribute(p,i);
      const {x,y,z}=original;
      target.copy(original);
      let seats=haloSeats,outerWeight=1;
      if(shoulder){
        seats=shoulderSeats;
        // Lock the bore. Spread the changes through the outside of the shoulder.
        outerWeight=MathUtils.smoothstep(Math.hypot(x,y),8.72,9.45);
        const join=(originalHead?outerWeight:0)*MathUtils.smoothstep(y,8.65,10.65)*(1-MathUtils.smoothstep(Math.abs(x),3.2,5.3));
        target.x*=MathUtils.lerp(1,crown.x,join);
        target.z*=MathUtils.lerp(1,crown.z,join);
        const turn=shoulderTurn(x,y,design.reach);
        const angle=Math.atan2(Math.abs(x),y);
        const coverage=MathUtils.smoothstep(angle,.29,.42)*(1-MathUtils.smoothstep(angle,.98,1.14));
        const widthChange=design.shoulder.size-1-(design.shoulder.cut==='oval'?.035:0);
        target.z*=1+widthChange*coverage*outerWeight;
        target.applyAxisAngle(depth,turn*outerWeight);
        // Individual seats can narrow. The long edge rails follow only the smooth width profile.
        if(shank)outerWeight*=1-MathUtils.smoothstep(Math.abs(z),.44,.68);
      }else{
        const join=MathUtils.smoothstep(y,8.5,11.1);
        const prong=MathUtils.smoothstep(y,12.35,13.05)*(1-MathUtils.smoothstep(Math.hypot(x,z),3.1,3.8));
        target.x*=MathUtils.lerp(1,MathUtils.lerp(crown.x,crown.mainX,prong),join);
        target.z*=MathUtils.lerp(1,MathUtils.lerp(crown.z,crown.mainZ,prong),join);
      }
      if((shoulder?shoulderChanged:crownChanged)&&outerWeight>0){
        offset.set(0,0,0);
        let sum=0;
        for(const stone of seats){
          const distance=original.distanceToSquared(stone.source.center);
          const weight=1-MathUtils.smoothstep(distance,.32,1.02);
          if(!weight)continue;
          near.copy(original).applyMatrix4(stone.seat).sub(target);
          offset.addScaledVector(near,weight);
          sum+=weight;
        }
        target.addScaledVector(offset,outerWeight/Math.max(1,sum));
      }
      p.setXYZ(i,target.x,target.y,target.z);
    }
    toCreasedNormals(geometry,Math.PI/4);
    geometry.computeBoundingSphere();
    return {...part,geometry,owned:true};
  });
  return design.head==='halo'?parts:[...parts,...buildSolitaireHead(design.head,stones[0])];
}
