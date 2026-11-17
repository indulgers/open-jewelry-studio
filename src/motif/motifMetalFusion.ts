import {
  BufferAttribute,BufferGeometry,CatmullRomCurve3,Float32BufferAttribute,
  TorusGeometry,TubeGeometry,Vector3,Raycaster,Mesh,MeshBasicMaterial,DoubleSide,
} from 'three';
import {createComfortFitShank,comfortFitDiagnostics} from './comfortFitGeometry';
import {ringShoulders,ringSizing} from './wearableGeometry';
import {triangleEdgeCounts} from './brilliantGeometry';

type NativeMesh={numProp:number;vertProperties:Float32Array;triVerts:Uint32Array;merge:()=>void};
type Solid={
  status:()=>string;volume:()=>number;isEmpty:()=>boolean;delete:()=>void;
  decompose:()=>Solid[];getMesh:()=>NativeMesh;numTri:()=>number;
};
type Kernel={
  setup:()=>void;
  Mesh:new(o:{numProp:number;vertProperties:Float32Array;triVerts:Uint32Array})=>NativeMesh;
  Manifold:{new(mesh:NativeMesh):Solid;union:(meshes:Solid[])=>Solid};
};
export type MetalFusionReport={
  status:'fused'|'fragmented'|'blocked';
  connectedComponents:number;triangles:number;volumeMm3:number;
  radialWallMinimumMm:number;clearDiameterMm:number;closedTriangleSurface:boolean;fingerAxisClear:boolean;
  manufacturingPassed:false;
  warnings:string[];
};
export type MetalFusionResult={geometry:BufferGeometry;report:MetalFusionReport;dispose:()=>void};

let kernelPromise:Promise<Kernel>|null=null;
async function loadKernel():Promise<Kernel>{
  if(kernelPromise)return kernelPromise;
  kernelPromise=(async()=>{
    const isNode=typeof process!=='undefined'&&Boolean(process.versions?.node);
    let runtime:Kernel;
    if(isNode){
      const [{pathToFileURL},{resolve}]=await Promise.all([import('node:url'),import('node:path')]);
      const base=pathToFileURL(resolve(process.cwd(),'public/forme/vendor/manifold')+'/').href;
      const module=await import(/* @vite-ignore */ (base+'manifold.js'));
      runtime=await module.default({locateFile:(name:string)=>base+name}) as Kernel;
    }else{
      const base=`${import.meta.env.BASE_URL}forme/vendor/manifold/`;
      const response=await fetch(base+'manifold.js');
      if(!response.ok)throw new Error('无法加载本地 Manifold 内核：'+response.status);
      const source=await response.text();
      const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
      try{
        const module=await import(/* @vite-ignore */ url);
        runtime=await module.default({locateFile:(name:string)=>base+name}) as Kernel;
      }finally{URL.revokeObjectURL(url);}
    }
    runtime.setup();return runtime;
  })();
  try{return await kernelPromise;}catch(err){kernelPromise=null;throw err;}
}
export function cappedSupport(points:Vector3[],radius:number):BufferGeometry{
  const curve=new CatmullRomCurve3(points,false,'centripetal');
  const segments=36,radial=16;
  const g=new TubeGeometry(curve,segments,radius,radial,false);
  const p=g.getAttribute('position'),vertices=Array.from(p.array),tri=Array.from(g.index!.array);
  const ring=(i:number)=>i*(radial+1);
  for(const [i,forward] of [[0,false],[segments,true]] as const){
    const centerPoint=curve.getPointAt(i/segments),tangent=curve.getTangentAt(i/segments);
    const center=vertices.length/3;vertices.push(centerPoint.x,centerPoint.y,centerPoint.z);
    for(let j=0;j<radial;j++){
      const a=ring(i)+j,b=a+1;
      const va=new Vector3().fromBufferAttribute(p,a).sub(centerPoint);
      const vb=new Vector3().fromBufferAttribute(p,b).sub(centerPoint);
      const sign=va.clone().cross(vb).dot(tangent);
      const required=forward?1:-1;
      if(sign*required>0)tri.push(center,a,b);else tri.push(center,b,a);
    }
  }
  g.setAttribute('position',new Float32BufferAttribute(vertices,3));
  g.setIndex(tri);g.computeVertexNormals();return g;
}

export function makeVisualMetalParts(innerDiameter:number){
  const sizes=ringSizing(innerDiameter);
  const shank=createComfortFitShank(innerDiameter);
  const shoulders=ringShoulders(innerDiameter).map(arm=>cappedSupport(arm.map(p=>new Vector3(...p)),.44));
  const gallery=new TorusGeometry(2.45,.34,18,72);
  gallery.rotateX(Math.PI/2);gallery.scale(1.5,1.05,1);
  gallery.translate(0,sizes.motifSeatY-.70,0);
  return {shank,shoulders,gallery,all:[shank,...shoulders,gallery],
    dispose(){for(const g of [shank,...shoulders,gallery])g.dispose();}};
}

function toSolid(geometry:BufferGeometry,kernel:Kernel,name:string):Solid{
  const p=geometry.getAttribute('position'),indices=geometry.getIndex();
  if(!p||p.itemSize!==3)throw Error(name+': malformed vertices');
  const positions=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){
    positions[3*i]=p.getX(i);positions[3*i+1]=p.getY(i);positions[3*i+2]=p.getZ(i);
  }
  const tris=indices?Uint32Array.from(indices.array):Uint32Array.from({length:p.count},(_,i)=>i);
  if(!positions.every(Number.isFinite)||tris.length%3)throw Error(name+': malformed triangles');
  const native=new kernel.Mesh({numProp:3,vertProperties:positions,triVerts:tris});
  native.merge();
  const solid=new kernel.Manifold(native);
  if(solid.status()!=='NoError'||solid.isEmpty()){
    const status=solid.status();solid.delete();throw Error(name+': '+status);
  }
  return solid;
}
function fromNative(mesh:NativeMesh){
  const geometry=new BufferGeometry();
  const vertex=new Float32Array(mesh.vertProperties.length/mesh.numProp*3);
  for(let i=0;i<vertex.length/3;i++)for(let j=0;j<3;j++)vertex[i*3+j]=mesh.vertProperties[i*mesh.numProp+j];
  geometry.setAttribute('position',new Float32BufferAttribute(vertex,3));
  geometry.setIndex(new BufferAttribute(mesh.triVerts.slice(),1));
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}

/** Explicit user-triggered Boolean screening; no unvalidated STL export. */
export async function fuseWearableRing(innerDiameter:number):Promise<MetalFusionResult>{
  const kernel=await loadKernel();
  const source=makeVisualMetalParts(innerDiameter),owned:Solid[]=[];
  const hold=(s:Solid)=>{owned.push(s);return s;};
  try{
    const solids=source.all.map((g,i)=>hold(toSolid(g,kernel,['band','shoulder-left','shoulder-right','gallery'][i])));
    const united=hold(kernel.Manifold.union(solids));
    if(united.status()!=='NoError'||united.isEmpty())throw new Error('金属布尔并集失败: '+united.status());
    const components=united.decompose().map(hold);
    const result=fromNative(united.getMesh());
    const topology=triangleEdgeCounts(result);
    const fit=comfortFitDiagnostics(innerDiameter);
    const probe=new Mesh(result,new MeshBasicMaterial({side:DoubleSide}));
    probe.updateMatrixWorld(true);
    const fingerAxisClear=new Raycaster(new Vector3(-15,0,0),new Vector3(1,0,0),0,30).intersectObject(probe).length===0;
    (probe.material as MeshBasicMaterial).dispose();
    const status=!fingerAxisClear?'blocked':components.length===1?'fused':'fragmented';
    const report:MetalFusionReport={
      status,connectedComponents:components.length,triangles:united.numTri(),
      volumeMm3:united.volume(),radialWallMinimumMm:fit.radialWallMinimumMm,
      clearDiameterMm:fit.conservativeClearDiameterMm,
      closedTriangleSurface:topology.nonManifoldEdges===0,fingerAxisClear,manufacturingPassed:false,
      warnings:[
        ...(components.length!==1?['仍有 '+components.length+' 个互不连通的金属实体，不可生成制造文件']:[]),
        ...(topology.nonManifoldEdges?['布尔结果存在非双流形边，应重试或重新建模']:[]),
        ...(!fingerAxisClear?['融合后金属阻挡了手指轴线，禁止接受本次结果']:[]),
        '解析壁厚仅针对规则戒臂，不代表肩部、接头与爪镶局部最薄处',
        '尚未通过最小连接截面、铸造缩水、公差、拉力和工厂工艺验证',
      ],
    };
    return {geometry:result,report,dispose(){result.dispose();}};
  }finally{
    source.dispose();for(const s of owned)s.delete();
  }
}
