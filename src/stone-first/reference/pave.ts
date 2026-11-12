import {CapsuleGeometry,CatmullRomCurve3,DoubleSide,Matrix4,Ray,Vector3,type BufferGeometry} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {edgeExtent,packPaveRow} from '../ring02/pave';
import type {ReferenceRing,RingAssembly,SourceGem} from './model';
import {isShoulderBead} from './parts';
import type {PaveDiameter,PaveLength,PaveSummary} from './pave-options';

const across=new Vector3(0,0,1);
const bvhOptions={indirect:true,setBoundingBox:false};

function frame(normal:Vector3,center:Vector3){
  const tangent=normal.clone().cross(across).normalize();
  return new Matrix4().makeBasis(tangent,normal,tangent.clone().cross(normal)).setPosition(center);
}

function measure(stone:SourceGem){
  const {geometry}=stone;
  const center=geometry.boundingBox!.getCenter(new Vector3());
  const radial=new Vector3(center.x,center.y,0).normalize();
  const tree=new MeshBVH(geometry,bvhOptions);
  // Sample the table face along the ring radius to recover each original stone's tilt.
  const hit=tree.raycastFirst(new Ray(center.clone().add(radial),radial.clone().negate()),DoubleSide);
  const normal=hit?.face?.normal??radial;
  if(normal.dot(radial)<0)normal.negate();
  const basis=frame(normal,center);
  const inverse=basis.clone().invert(),vertices=geometry.getAttribute('position');
  const point=new Vector3();
  let radius=0,girdleY=0;
  for(let i=0;i<vertices.count;i++){
    point.fromBufferAttribute(vertices,i).applyMatrix4(inverse);
    const r=Math.hypot(point.x,point.z);
    if(r>radius){radius=r;girdleY=point.y;}
  }
  center.addScaledVector(normal,girdleY);
  return {stone,center,normal,diameter:radius*2};
}

function summarize(rows:{stone:SourceGem;center:Vector3}[][],diameter:number):PaveSummary{
  const gaps=rows.flatMap(row=>row.slice(1).map(({stone,center},i)=>{
    const previous=row[i];
    const direction=center.clone().sub(previous.center).normalize();
    const translation=new Vector3().setFromMatrixPosition(stone.matrix)
      .sub(new Vector3().setFromMatrixPosition(previous.stone.matrix));
    const advance=translation.dot(direction);
    return Math.max(0,advance-edgeExtent(previous.stone,direction)-edgeExtent(stone,direction.negate()));
  }));
  return {count:rows.reduce((total,row)=>total+row.length,0),minGap:gaps.length?Math.min(...gaps):null,maxGap:gaps.length?Math.max(...gaps):null,diameter};
}

type PaveSource=Pick<ReferenceRing,'id'|'metal'|'stones'>;

function prepareRows(band:PaveSource){
  const rows=new Map<string,ReturnType<typeof measure>[]>();
  for(const stone of band.stones){
    if(stone.zone!=='shoulder')continue;
    const measured=measure(stone);
    const {x,z}=measured.center;
    const key=Math.sign(x)+':'+(band.id==='ring-crown'?Math.sign(z):0);
    const row=rows.get(key)??[];
    row.push(measured);
    rows.set(key,row);
  }
  return [...rows.values()].map(row=>row.sort((a,b)=>Math.abs(a.center.x)-Math.abs(b.center.x)));
}

function preparePath(row:ReturnType<typeof measure>[],diameter:number){
  const centers=row.map(stone=>stone.center);
  const first=centers[0],last=centers[centers.length-1];
  const start=first.clone().addScaledVector(first.clone().sub(centers[1]).normalize(),.48*diameter);
  const end=last.clone().addScaledVector(last.clone().sub(centers[centers.length-2]).normalize(),.48*diameter);
  return new CatmullRomCurve3([start,...centers,end]);
}

function getSurface(tree:MeshBVH,at:Vector3,normal:Vector3){
  return tree.raycastFirst(new Ray(at.clone().addScaledVector(normal,.4),normal.clone().negate()),DoubleSide)?.point;
}

export function prepareReferencePave(band:PaveSource){
  const rows=prepareRows(band);
  if(!rows.length)return null;
  const source=rows.flat().reduce((a,b)=>a.diameter<b.diameter?a:b);
  const diameter=source.diameter;
  const stock=summarize(rows,diameter);
  let prepared:ReturnType<typeof prepareLayout>;
  function prepareLayout(){
    const paths=rows.map(row=>preparePath(row,diameter));
    const rail=band.metal.find(part=>part.name===(band.id==='ring-02'?'metal_shank_with_shoulders':'metal_1'))!;
    const tree=new MeshBVH(rail.geometry,bvhOptions);
    const gem=source.stone.geometry.clone().applyMatrix4(frame(source.normal,source.center).invert());
    gem.computeBoundingBox();
    return {paths,tree,gem};
  }
  const layouts=new Map<string,{stones:SourceGem[];geometry:BufferGeometry;pave:PaveSummary}>();
  return {
    stock,
    layout(diameterPercent:PaveDiameter,lengthPercent:PaveLength){
      const key=diameterPercent+':'+lengthPercent;
      const saved=layouts.get(key);
      if(saved)return saved;
      const {paths,tree,gem}=prepared??=prepareLayout();
      const size=diameter*diameterPercent/100,scale=size/diameter;
      const posts:CapsuleGeometry[]=[];
      const placed=paths.map((path,rowIndex)=>{
        const samples=Array.from({length:65},(_,i)=>path.getPointAt(i/64*lengthPercent/100));
        return packPaveRow(samples,size,size*.14).map(({center,tangent},index)=>{
          const nearest=rows[rowIndex].reduce((a,b)=>a.center.distanceToSquared(center)<b.center.distanceToSquared(center)?a:b);
          const normal=nearest.normal.clone().addScaledVector(tangent,-nearest.normal.dot(tangent)).normalize();
          const surface=getSurface(tree,center,normal);
          if(surface){
            // Keep the pavilion above the original shank surface at the stone center.
            const lift=surface.sub(center).dot(normal)-gem.boundingBox!.min.y*scale+size*.025;
            center.addScaledVector(normal,Math.max(0,lift));
          }
          const basis=frame(normal,center);
          const matrix=basis.clone().scale(new Vector3(scale,scale,scale));
          const name='gem_shoulder_pave_'+rowIndex+'_'+index;
          for(const x of [-1,1])for(const z of [-1,1]){
            const edge=new Vector3(x*.39*size,0,z*.39*size).applyMatrix4(basis);
            const support=getSurface(tree,edge,normal);
            if(!support)continue;
            // Sink each foot into the shank and stop the bead tip at the girdle.
            const foot=support.sub(edge).dot(normal)-size*.035;
            const tip=-size*.02;
            posts.push(new CapsuleGeometry(size*.06,Math.max(0,tip-foot),4,8)
              .translate(x*.39*size,(foot+tip)/2,z*.39*size).applyMatrix4(basis));
          }
          return {center,stone:{name,zone:'shoulder' as const,geometry:gem,matrix}};
        });
      });
      const geometry=mergeGeometries(posts);
      posts.forEach(post=>post.dispose());
      geometry.computeBoundingBox();
      const layout={stones:placed.flat().map(({stone})=>stone),geometry,pave:summarize(placed,size)};
      layouts.set(key,layout);
      return layout;
    },
    dispose(){prepared?.gem.dispose();layouts.forEach(({geometry})=>geometry.dispose());},
  };
}

export function applyReferencePave(ring:RingAssembly,band:ReferenceRing,diameter:PaveDiameter,length:PaveLength){
  const shoulders=band.paveRows();
  if(!shoulders)return {...ring,pave:null};
  if(diameter===100&&length===100)return {...ring,pave:shoulders.stock};
  const layout=shoulders.layout(diameter,length);
  return {...ring,
    metal:[...ring.metal.filter(part=>!isShoulderBead(band.id,part.name)),{name:'metal_pave_seats',geometry:layout.geometry}],
    stones:[...ring.stones.filter(stone=>stone.zone!=='shoulder'),...layout.stones],
    pave:layout.pave,
  };
}
