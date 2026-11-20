import {Box3,BufferGeometry,Float32BufferAttribute,DoubleSide,MathUtils,Matrix4,Ray,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import {fitGemToSeat,girdle} from '../../geometry/productGeometry';
import type {Part,RingAssembly,SourceGem} from './model';

const bvhOptions={indirect:true,setBoundingBox:false};
function surface(geometry:BufferGeometry){
  let tree=geometry.boundsTree;
  if(!tree){
    tree=new MeshBVH(geometry,bvhOptions);
    geometry.boundsTree=tree;
  }
  return tree;
}

// Query the actual horizontal facet section, including cuts with unequal or concave sides.
function stoneProfile(geometry:BufferGeometry){
  const box=geometry.boundingBox!,center=box.getCenter(new Vector3());
  const radius=Math.max(box.max.x-center.x,box.max.z-center.z);
  const waist=girdle(geometry,box),ray=new Ray(),tree=surface(geometry);
  return {center,radius,waist,box,
    edge(dx:number,dz:number,y:number){
      // At a flat table or at the culet a coplanar ray is ambiguous.
      const level=MathUtils.clamp(y,box.min.y+radius*.001,box.max.y-radius*.001);
      ray.origin.set(center.x+dx*radius*2,level,center.z+dz*radius*2);
      ray.direction.set(-dx,0,-dz);
      const hit=tree.raycastFirst(ray,DoubleSide,0,radius*2);
      return hit?radius*2-hit.distance:0;
    },
  };
}
type Profile=ReturnType<typeof stoneProfile>;

function holdsCenter(part:Part,source:Profile,offset:number){
  if(!part.headMetal)return false;
  const {waist,center,radius}=source,threshold=waist-radius*.06;
  if(part.geometry.boundingBox!.max.y+offset<threshold)return false;
  const p=part.geometry.getAttribute('position');
  for(let i=0;i<p.count;i++){
    if(p.getY(i)+offset<threshold)continue;
    const distance=Math.hypot(p.getX(i)-center.x,p.getZ(i)-center.z);
    if(distance<1e-8||distance>radius*1.22||p.getY(i)+offset>source.box.max.y+radius*.12)continue;
    const edge=source.edge((p.getX(i)-center.x)/distance,(p.getZ(i)-center.z)/distance,p.getY(i)+offset);
    if(Math.abs(distance-edge)<radius*.22)return true;
  }
  return false;
}

function seatLift(target:BufferGeometry,source:Profile,fixed:{geometry:BufferGeometry;matrix:Matrix4}[]){
  // Keep a deeper pavilion out of the stock gallery. If the wider cut reaches an accent
  // or fixed rail, raise the seat only as far as the actual triangle surfaces require.
  const box=target.boundingBox!,matrix=new Matrix4(),bounds=new Box3(),point=new Vector3();
  const insideRay=new Ray(point,new Vector3(.923,.257,.286).normalize());
  const candidates=fixed.map(part=>({...part,box:part.geometry.boundingBox!.clone().applyMatrix4(part.matrix)}))
    .filter(part=>part.box.max.x>=box.min.x&&part.box.min.x<=box.max.x&&part.box.max.z>=box.min.z&&part.box.min.z<=box.max.z);
  const hits=(lift:number)=>candidates.some(part=>{
    matrix.makeTranslation(0,-lift,0).multiply(part.matrix);
    bounds.copy(part.geometry.boundingBox!).applyMatrix4(matrix);
    if(!box.intersectsBox(bounds))return false;
    const tree=surface(target);
    surface(part.geometry);
    if(tree.intersectsGeometry(part.geometry,matrix))return true;
    // A small accent entirely enclosed by the center has no intersecting triangles.
    point.fromBufferAttribute(part.geometry.getAttribute('position'),0).applyMatrix4(matrix);
    return box.containsPoint(point)&&tree.raycast(insideRay,DoubleSide).length%2===1;
  });
  let low=Math.max(0,source.box.min.y-box.min.y);
  if(!hits(low))return low;
  let high=Math.max(...candidates.map(part=>part.box.max.y))-box.min.y+source.radius*.003;
  for(let i=0;i<12;i++){
    const mid=(low+high)/2;
    if(hits(mid))low=mid;else high=mid;
  }
  return high;
}

// Some scanned claws have a single triangle from foot to tip. Introduce an edge
// at the hardware that must stay fixed so bending the tip cannot cut through it.
function splitAtHeight(source:BufferGeometry,height:number){
  const positions=source.getAttribute('position'),index=source.index,vertices:number[]=[];
  const count=index?.count??positions.count;
  for(let i=0;i<count;i+=3){
    const triangle=[0,1,2].map(j=>new Vector3().fromBufferAttribute(positions,index?index.getX(i+j):i+j));
    const emit=(points:Vector3[])=>{
      for(let j=1;j+1<points.length;j++)for(const p of [points[0],points[j],points[j+1]])vertices.push(p.x,p.y,p.z);
    };
    if(triangle.every(p=>p.y<=height)||triangle.every(p=>p.y>=height)){emit(triangle);continue;}
    const upper:Vector3[]=[],lower:Vector3[]=[];
    for(let j=0;j<3;j++){
      const a=triangle[j],b=triangle[(j+1)%3];
      if(a.y>=height)upper.push(a);
      if(a.y<=height)lower.push(a);
      if((a.y-height)*(b.y-height)<0){
        const edge=a.clone().lerp(b,(height-a.y)/(b.y-a.y));
        upper.push(edge);lower.push(edge);
      }
    }
    emit(upper);emit(lower);
  }
  return new BufferGeometry().setAttribute('position',new Float32BufferAttribute(vertices,3));
}

// CAD facet meshes repeat shared positions. Reuse the exact displaced vertex
// across triangle seams, and raycast only once per distinct point when editing.
const vertexCopies=new WeakMap<BufferGeometry,Int32Array>();
function firstVertices(geometry:BufferGeometry){
  let copies=vertexCopies.get(geometry);
  if(copies)return copies;
  const p=geometry.getAttribute('position'),seen=new Map<string,number>();
  copies=new Int32Array(p.count);
  for(let i=0;i<p.count;i++){
    const key=p.getX(i)+','+p.getY(i)+','+p.getZ(i);
    const previous=seen.get(key);
    copies[i]=previous??i;
    if(previous===undefined)seen.set(key,i);
  }
  vertexCopies.set(geometry,copies);
  return copies;
}

function reshape(part:Part,offset:number,source:Profile,target:Profile,guard?:number){
  const geometry=guard===undefined?part.geometry.clone():splitAtHeight(part.geometry,guard-offset);
  const p=geometry.getAttribute('position'),copies=firstVertices(guard===undefined?part.geometry:geometry);
  const root=Math.max(part.geometry.boundingBox!.min.y+offset,source.box.min.y,source.waist-source.radius*.8,guard??-Infinity);
  const crownScale=(target.box.max.y-target.waist)/Math.max(1e-8,source.box.max.y-source.waist);
  const pavilionScale=(target.waist-target.box.min.y)/Math.max(1e-8,source.waist-source.box.min.y);
  for(let i=0;i<p.count;i++){
    const first=copies[i];
    if(first!==i){p.setXYZ(i,p.getX(first),p.getY(first),p.getZ(first));continue;}
    const y=p.getY(i)+offset;
    if(y<=root)continue;
    const x=p.getX(i)-source.center.x,z=p.getZ(i)-source.center.z,r=Math.hypot(x,z);
    if(r<1e-8||r>=source.radius*1.48)continue;
    const weight=MathUtils.smoothstep(y,root,source.waist-source.radius*.12)
      *(1-MathUtils.smoothstep(r/source.radius,1.18,1.48));
    const scale=y<source.waist?pavilionScale:crownScale;
    const level=Math.max(guard??-Infinity,target.waist+(y-source.waist)*scale);
    const dx=x/r,dz=z/r;
    const oldEdge=source.edge(dx,dz,y),newEdge=target.edge(dx,dz,level);
    // Keep the original seat bite relative to this facet. Metal outside the girdle
    // retains its thickness even when the new stone is substantially narrower.
    const gap=r-oldEdge;
    const adjusted=newEdge+gap*(gap<0&&oldEdge>0?Math.min(1,newEdge/oldEdge):1);
    const delta=(adjusted-r)*weight;
    p.setXYZ(i,p.getX(i)+dx*delta,p.getY(i)+(level-y)*weight,p.getZ(i)+dz*delta);
  }
  const smooth=toCreasedNormals(geometry,Math.PI/4);
  if(smooth!==geometry)geometry.dispose();
  smooth.computeBoundingBox();smooth.computeBoundingSphere();
  return {...part,geometry:smooth};
}

type Assembly=Pick<RingAssembly,'metal'|'stones'>;
export function fitCenterSetting(ring:Assembly,cut:BufferGeometry|undefined,scale:number){
  const owned:BufferGeometry[]=[];
  const stock={...ring,dispose:()=>owned.forEach(g=>g.dispose()),issue:''};
  if(!cut&&scale===1)return stock;
  const centers=ring.stones.filter(stone=>stone.zone==='center');
  if(centers.length!==1)return {...stock,issue:'这个戒头需要逐石校准爪位，请选择原款切形和大小，或更换戒头。'};
  const center=centers[0],source=stoneProfile(center.geometry);
  // Reference assemblies place head metal and stones using the same vertical seat offset.
  const headY=center.matrix.elements[13];
  const offset=(part:Part)=>(part.offsetY??0)-headY;
  const holders=new Set(ring.metal.filter(part=>holdsCenter(part,source,offset(part))));
  if(!holders.size)return {...stock,issue:'这个戒头缺少可识别的主石镶位，请选择原款切形和大小，或更换戒头。'};
  // The bearing directly below the girdle often belongs to a separate collar. Its
  // authored contact with the pavilion is part of the seat, not an obstacle to clear.
  for(const part of ring.metal){
    if(!part.headMetal||holders.has(part))continue;
    const matrix=new Matrix4().makeTranslation(0,offset(part),0);
    if(!source.box.intersectsBox(part.geometry.boundingBox!.clone().applyMatrix4(matrix)))continue;
    surface(part.geometry);
    if(surface(center.geometry).intersectsGeometry(part.geometry,matrix))holders.add(part);
  }
  const target=fitGemToSeat(cut??center.geometry,center.geometry,scale);
  owned.push(target);
  const inverse=center.matrix.clone().invert();
  const accents=ring.stones.filter(stone=>stone!==center).map(stone=>({geometry:stone.geometry,matrix:inverse.clone().multiply(stone.matrix)}));
  const fixed=[
    ...ring.metal.filter(part=>!holders.has(part)).map(part=>({geometry:part.geometry,matrix:new Matrix4().makeTranslation(0,offset(part),0)})),
    ...accents,
  ];
  const lift=seatLift(target,source,fixed);
  if(lift){target.translate(0,lift,0);target.boundsTree?.refit();}
  const profile=stoneProfile(target);
  const metal:Part[]=[];
  for(const part of ring.metal){
    if(!holders.has(part)){metal.push(part);continue;}
    const dy=offset(part);
    const nearby=accents.map(accent=>{
      const matrix=new Matrix4().makeTranslation(0,-dy,0).multiply(accent.matrix);
      return {geometry:accent.geometry,matrix,box:accent.geometry.boundingBox!.clone().applyMatrix4(matrix)};
    });
    const newIntersections=(geometry:BufferGeometry)=>nearby.filter(accent=>{
      if(!accent.box.intersectsBox(geometry.boundingBox!))return false;
      surface(accent.geometry);
      return surface(geometry).intersectsGeometry(accent.geometry,accent.matrix)
        &&!surface(part.geometry).intersectsGeometry(accent.geometry,accent.matrix);
    });
    let fitted=reshape(part,dy,source,profile);
    const clashes=newIntersections(fitted.geometry);
    if(clashes.length){
      const guard=Math.max(...clashes.map(accent=>accent.box.max.y))+dy+source.radius*.005;
      fitted.geometry.dispose();
      fitted=reshape(part,dy,source,profile,guard);
    }
    owned.push(fitted.geometry);
    const relative=new Matrix4().makeTranslation(0,dy,0);
    const tolerance=source.radius*.065;
    surface(fitted.geometry);
    if((clashes.length&&newIntersections(fitted.geometry).length)
      ||!surface(target).closestPointToGeometry(fitted.geometry,relative,undefined,undefined,tolerance,tolerance)){
      return {...stock,issue:'当前切形和大小无法同时贴合镶位并避开配钻，请调整主石或更换戒头。'};
    }
    metal.push(fitted);
  }
  const stones:SourceGem[]=ring.stones.map(stone=>stone===center?{...stone,geometry:target}:stone);
  return {...stock,metal,stones};
}
