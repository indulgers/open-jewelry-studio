import {Box3, DoubleSide, Matrix4, Mesh, Quaternion, Ray, Vector3, MathUtils, type BufferGeometry, type Object3D} from 'three';
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {firstMeshGeometry} from '../../geometry/productGeometry';
import {STONE_APPEARANCES, type StoneAppearance} from '../../viewer/stoneAppearance';
import {prepareGirdleGem} from '../gemFit';
import stoneIndex from './stones.json';
import {buildSolitaireHead,HEADS,type Head} from './head';
import {ORIGINAL_STONE,RING02_TEMPLATE} from './assets';
import {buildPaveSeat,packPaveRow} from './pave';
export {paveSpacing} from './pave';

export const ZONES=['center','halo','shoulder'] as const;
export const SIZES=[0.94,1,1.06] as const;
export const REACHES=[0.97,1,1.05] as const;
export type Zone=typeof ZONES[number];
export type StoneSpec={cut:'round'|'oval';size:typeof SIZES[number];appearance:StoneAppearance};
export type RingDesign=Record<Zone,StoneSpec>&{head:Head;reach:typeof REACHES[number];metal:'white';engraving:string};
export const TEMPLATE_REVISION=RING02_TEMPLATE.revision;
export const BASE_DESIGN=RING02_TEMPLATE.defaultDesign;

export {ENGRAVING_LIMIT,engravingProblem} from './engraving';
import {engravingProblem} from './engraving';

function record(value:unknown):value is Record<string,unknown>{
  return typeof value==='object'&&value!==null;
}
export function parseDesign(value:unknown):RingDesign|null{
  if(!record(value))return null;
  const {head='halo',center,halo,shoulder,reach,metal,engraving=''}=value;
  const spec=(v:unknown):v is StoneSpec=>record(v)&&(v.cut==='round'||v.cut==='oval')
    &&SIZES.some(size=>size===v.size)&&typeof v.appearance==='string'&&Object.hasOwn(STONE_APPEARANCES,v.appearance);
  if(!HEADS.some(([id])=>id===head)||!spec(center)||!spec(halo)||!spec(shoulder)||!REACHES.some(length=>length===reach)
    ||(metal!=='white'&&metal!=='yellow'&&metal!=='rose')||typeof engraving!=='string'
    ||engraving!==engraving.trim()||engravingProblem(engraving))return null;
  return {head:head as Head,center,halo,shoulder,reach:reach as RingDesign['reach'],metal:'white',engraving};
}

type Part={name:string;geometry:BufferGeometry};
type StoneSource=Part&{zone:Zone;divider:boolean;center:Vector3;rotation:Quaternion;width:number};
export type FittedStone=Part&{zone:Zone;appearance:StoneAppearance;matrix:Matrix4;source:StoneSource;paveDistance?:number};
type Template={metal:Part[];stones:StoneSource[];oval:BufferGeometry;ovalAspect:number;originalIntersections:Set<string>};
const vertical=new Vector3(0,1,0),depth=new Vector3(0,0,1);

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

function finishMetalNormals(name:string,source:BufferGeometry){
  const geometry=toCreasedNormals(source,Math.PI/4);
  if(name!=='metal_lower_shank_shell'&&name!=='metal_shank_with_shoulders')return geometry;
  const positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');
  const radial=new Vector3(),normal=new Vector3();
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=Math.abs(positions.getZ(i));
    const radius=Math.hypot(x,y);
    if(radius>8.72||z>=.84)continue;
    radial.set(-x/radius,-y/radius,0);
    normal.fromBufferAttribute(normals,i);
    // The bore is round. Keep its reflection continuous across the triangulation,
    // blending back to the mesh normals around the rounded lips.
    const weight=MathUtils.smoothstep(normal.dot(radial),.92,.99)*(1-MathUtils.smoothstep(z,.55,.84));
    normal.lerp(radial,weight).normalize();
    normals.setXYZ(i,normal.x,normal.y,normal.z);
  }
  return geometry;
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
      const geometry=finishMetalNormals(object.name,object.geometry);
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
  template.originalIntersections=new Set(intersections(fitStones(template,BASE_DESIGN)).map(pair=>pair.name));
  return template;
}

function crownScale(template:Template,design:RingDesign){
  const radius=template.stones[0].width/2;
  const ratio=design.center.cut==='oval'?template.ovalAspect:1;
  const mainX=design.center.size/Math.sqrt(ratio),mainZ=design.center.size*Math.sqrt(ratio);
  return {
    mainX,mainZ,
    x:1+Math.max(0,radius*(mainX-1))/3.28,
    z:1+Math.max(0,radius*(mainZ-1))/3.28,
  };
}

const haloReflow=(design:RingDesign)=>design.head==='halo'&&(
  design.halo.size!==1||design.halo.cut!=='round'||design.center.size!==1||design.center.cut!=='round'
);
const shoulderReflow=(design:RingDesign)=>design.shoulder.size!==1||design.shoulder.cut!=='round'||design.reach!==1;

export function usesAutomaticPave(design:RingDesign){
  return haloReflow(design)||shoulderReflow(design);
}

// The original outer shoulder rail starts at .31 rad. Keep its end inboard of the collar.
const SHOULDER_START=.31, SHOULDER_END=1.055;
const shoulderExtension=(reach:RingDesign['reach'])=>(SHOULDER_END-SHOULDER_START)*(reach-1);

function fitStone(
  template:Template,source:StoneSource,spec:StoneSpec,center:Vector3,rotation:Quaternion,
  size:number,name=source.name,paveDistance?:number,
):FittedStone{
  const modelScale=spec.cut==='oval'?size*source.width/2:size;
  const matrix=new Matrix4().compose(center,rotation,new Vector3().setScalar(modelScale));
  return {source,name,zone:source.zone,geometry:spec.cut==='oval'?template.oval:source.geometry,
    appearance:spec.appearance,matrix,paveDistance};
}

function fitHaloRows(template:Template,design:RingDesign,crown:ReturnType<typeof crownScale>){
  const spec=design.halo;
  const source=template.stones.find(stone=>stone.name==='gem_halo_segment_1_2')!;
  const radius=Math.hypot(source.center.x,source.center.z);
  const width=source.width*spec.size*(spec.cut==='oval'?template.ovalAspect:1);
  return [1,2,3,4].flatMap(segment=>{
    // The raised divider transitions begin near ±.55 rad on each original arc.
    const path=Array.from({length:33},(_,index)=>{
      const angle=(segment-1)*Math.PI/2+MathUtils.lerp(-.53,.53,index/32);
      return new Vector3(radius*Math.cos(angle)*crown.x,source.center.y,radius*Math.sin(angle)*crown.z);
    });
    return packPaveRow(path,width,.06).map(({center,distance},index)=>{
      const rotation=spec.cut==='oval'
        ?new Quaternion().setFromAxisAngle(vertical,-Math.atan2(center.z,center.x))
        :new Quaternion();
      return fitStone(template,source,spec,center,rotation,spec.size,'gem_halo_segment_'+segment+'_'+(index+1),distance);
    });
  });
}

function fitShoulderRows(template:Template,design:RingDesign){
  const source=template.stones.find(stone=>stone.name==='gem_shoulder_positive_x_03')!;
  const rail=template.metal.find(part=>part.name==='metal_shank_with_shoulders')!;
  const surface=railSurface(rail.geometry);
  const spec=design.shoulder;
  const end=SHOULDER_END+shoulderExtension(design.reach);
  const path=Array.from({length:33},(_,index)=>{
    const angle=MathUtils.lerp(SHOULDER_START,end,index/32);
    const normal=new Vector3(Math.sin(angle),Math.cos(angle),0);
    const ray=new Ray(normal.clone().multiplyScalar(14),normal.clone().negate());
    const hit=surface.raycastFirst(ray,DoubleSide);
    if(!hit)throw new Error('戒臂配钻路径缺少金属承载面。');
    return hit.point.addScaledVector(normal,.055);
  });
  const row=packPaveRow(path,source.width*spec.size,.08);
  return [1,-1].flatMap(sign=>row.map(({center,tangent,distance},index)=>{
    const outward=new Vector3(-tangent.y*sign,tangent.x,0).normalize();
    const along=new Vector3().crossVectors(outward,depth).normalize();
    const rotation=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(along,outward,depth));
    const position=new Vector3(center.x*sign,center.y,center.z);
    const name='gem_shoulder_'+(sign>0?'positive':'negative')+'_x_'+String(index+1).padStart(2,'0');
    return fitStone(template,source,spec,position,rotation,spec.size,name,distance);
  }));
}

export function fitStones(template:Template,design:RingDesign):FittedStone[]{
  const crown=crownScale(template,design);
  const halo=haloReflow(design),shoulder=shoulderReflow(design);
  const active=template.stones.filter(stone=>{
    if(stone.zone==='halo')return design.head==='halo'&&(!halo||stone.divider);
    return stone.zone!=='shoulder'||!shoulder;
  });
  const fitted=active.map(source=>{
    const spec=source.divider?ORIGINAL_STONE:design[source.zone];
    const center=source.center.clone(),rotation=source.rotation.clone();
    const size=source.zone==='center'?crown.mainX:spec.size;
    return fitStone(template,source,spec,center,rotation,size);
  });
  if(halo)fitted.push(...fitHaloRows(template,design,crown));
  if(shoulder)fitted.push(...fitShoulderRows(template,design));
  return fitted;
}

const railTrees=new WeakMap<BufferGeometry,MeshBVH>();
function railSurface(geometry:BufferGeometry){
  let surface=railTrees.get(geometry);
  if(!surface){
    // The BVH indexes and reorders triangles. Keep the source support untouched.
    surface=new MeshBVH(geometry.clone());
    railTrees.set(geometry,surface);
  }
  return surface;
}

const trees=new WeakMap<BufferGeometry,MeshBVH>();
function tree(geometry:BufferGeometry){
  let bvh=trees.get(geometry);
  if(!bvh){bvh=new MeshBVH(geometry);trees.set(geometry,bvh);}
  return bvh;
}
function intersections(stones:FittedStone[]){
  const bounds=stones.map(stone=>new Box3().copy(stone.geometry.boundingBox!).applyMatrix4(stone.matrix));
  const relative=new Matrix4(),pairs:{name:string;reflow:boolean}[]=[];
  stones.forEach((a,i)=>{
    for(let j=i+1;j<stones.length;j++){
      if(!bounds[i].intersectsBox(bounds[j]))continue;
      const b=stones[j];
      relative.copy(a.matrix).invert().multiply(b.matrix);
      tree(b.geometry);
      if(tree(a.geometry).intersectsGeometry(b.geometry,relative)){
        pairs.push({name:a.name+' / '+b.name,reflow:a.paveDistance!==undefined||b.paveDistance!==undefined});
      }
    }
  });
  return pairs;
}
export function findNewIntersection(template:Template,stones:FittedStone[]){
  return intersections(stones).find(pair=>pair.reflow||!template.originalIntersections.has(pair.name))?.name;
}

export function buildMetal(template:Template,design:RingDesign,stones:FittedStone[]){
  const crown=crownScale(template,design);
  const originalHead=design.head==='halo';
  const crownChanged=originalHead&&(design.center.cut!=='round'||design.center.size!==1);
  const haloChanged=haloReflow(design),shoulderChanged=shoulderReflow(design);
  const fixedDividers=template.stones.filter(stone=>stone.divider);
  const original=new Vector3(),target=new Vector3();
  const isShoulder=(part:Part)=>part.name==='metal_shank_with_shoulders'||part.name.startsWith('metal_shoulder_');
  const dividerBead=(part:Part)=>{
    if(!part.name.startsWith('metal_halo_bead_'))return false;
    if(!part.geometry.boundingBox)part.geometry.computeBoundingBox();
    return part.geometry.boundingBox!.min.y>12;
  };
  const source=template.metal.filter(part=>{
    if(!originalHead&&!isShoulder(part)&&part.name!=='metal_lower_shank_shell')return false;
    if(shoulderChanged&&part.name.startsWith('metal_shoulder_bead_'))return false;
    if(haloChanged&&part.name.startsWith('metal_halo_bead_'))return dividerBead(part);
    return true;
  });
  const parts=source.map(part=>{
    const shoulder=isShoulder(part);
    if(part.name==='metal_lower_shank_shell'||dividerBead(part)||!(crownChanged||(shoulder&&shoulderChanged))){
      return {...part,owned:false};
    }
    const geometry=part.geometry.clone(),p=geometry.getAttribute('position');
    const collar=part.name.startsWith('metal_shoulder_collar_');
    if(collar&&shoulderChanged){
      const sign=part.name.includes('positive')?1:-1;
      geometry.rotateZ(-sign*shoulderExtension(design.reach));
      return {...part,geometry,owned:true};
    }
    for(let i=0;i<p.count;i++){
      original.fromBufferAttribute(p,i);
      const {x,y,z}=original;
      target.copy(original);
      let outerWeight=1;
      if(shoulder){
        // Lock the bore. Spread the changes through the outside of the shoulder.
        outerWeight=MathUtils.smoothstep(Math.hypot(x,y),8.72,9.45);
        const angle=Math.atan2(Math.abs(x),y);
        // Resize the connection to the head above the rail. Moving the rail itself
        // pushes its inner end through the first shoulder stone.
        const join=(originalHead?outerWeight:0)*MathUtils.smoothstep(y,8.65,10.65)
          *(1-MathUtils.smoothstep(angle,.18,SHOULDER_START-.02));
        target.x*=MathUtils.lerp(1,crown.x,join);
        target.z*=MathUtils.lerp(1,crown.z,join);
        const coverage=MathUtils.smoothstep(angle,.29,.42)*(1-MathUtils.smoothstep(angle,.98,1.14));
        const widthChange=design.shoulder.size-1-(design.shoulder.cut==='oval'?.035:0);
        target.z*=1+widthChange*coverage*outerWeight;
      }else{
        const join=MathUtils.smoothstep(y,8.5,11.1);
        const radius=Math.hypot(x,z);
        const fromArcCenter=Math.atan2(Math.min(Math.abs(x),Math.abs(z)),Math.max(Math.abs(x),Math.abs(z)));
        const arc=1-MathUtils.smoothstep(fromArcCenter,.53,.66);
        const prong=MathUtils.smoothstep(y,12.35,13.05)*(1-MathUtils.smoothstep(radius,3.1,3.44));
        target.x*=MathUtils.lerp(1,MathUtils.lerp(MathUtils.lerp(1,crown.x,arc),crown.mainX,prong),join);
        target.z*=MathUtils.lerp(1,MathUtils.lerp(MathUtils.lerp(1,crown.z,arc),crown.mainZ,prong),join);
      }
      if(!shoulder&&crownChanged){
        let fixedWeight=0;
        for(const divider of fixedDividers){
          fixedWeight+=1-MathUtils.smoothstep(original.distanceToSquared(divider.center),.32,1.02);
        }
        target.lerp(original,Math.min(1,fixedWeight));
      }
      p.setXYZ(i,target.x,target.y,target.z);
    }
    const finished=finishMetalNormals(part.name,geometry);
    if(finished!==geometry)geometry.dispose();
    finished.computeBoundingSphere();
    return {...part,geometry:finished,owned:true};
  });
  for(const stone of stones)if(stone.paveDistance!==undefined)parts.push(buildPaveSeat(stone));
  if(design.head!=='halo')parts.push(...buildSolitaireHead(design.head,stones[0]));
  return parts;
}
