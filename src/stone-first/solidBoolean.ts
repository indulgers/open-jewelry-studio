import {BufferGeometry, Float32BufferAttribute} from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {createAssembly,metalSetting} from './geometry';
import {buildStoneLayout,constrainDesign,type Design,type Site} from './recipe';

/**
 * A real WASM Boolean stage. This is closed **mesh CSG**, not B-rep or a
 * factory certification. We deliberately fail closed on invalid input rather
 * than silently leaving four independent petals and protruding rods visible.
 */
type KernelMesh = {triVerts:Uint32Array;vertProperties:Float32Array;numProp:number;merge:()=>boolean};
type Solid = {
  delete:()=>void;status:()=>string;volume:()=>number;getMesh:(normalIdx?:number)=>KernelMesh;
  subtract:(other:Solid)=>Solid;intersect:(other:Solid)=>Solid;
  translate:(v:number[])=>Solid;rotate:(v:number[])=>Solid;
  calculateNormals:(normalIdx?:number,minSharpAngle?:number)=>Solid;
  decompose:()=>Solid[];
};
type Kernel = {
  setup:()=>void;
  Mesh:new (data:{numProp:number;triVerts:Uint32Array;vertProperties:Float32Array})=>KernelMesh;
  Manifold:{
    new(mesh:KernelMesh):Solid;
    union:(solids:Solid[])=>Solid;
    cylinder:(height:number,radiusLow:number,radiusHigh:number,segments:number,center:boolean)=>Solid;
  };
};
let cached:Promise<Kernel>|undefined;
export function loadSolidKernel():Promise<Kernel>{
  if(!cached){
    cached=(async()=>{
      const jsPath=typeof window==='undefined'
        ?new URL('../../public/forme/vendor/manifold/manifold.js',import.meta.url).href
        :`${import.meta.env.BASE_URL}forme/vendor/manifold/manifold.js`;
      const imported=await import(/* @vite-ignore */ jsPath) as {default:(opts?:object)=>Promise<Kernel>};
      const kernel=await imported.default();
      kernel.setup();
      return kernel;
    })().catch(error=>{cached=undefined;throw error;});
  }
  return cached;
}
function ensure(label:string,solid:Solid){
  const status=solid.status();
  if(status!=='NoError')throw new Error(`${label}: Manifold ${status}`);
  if(!Number.isFinite(solid.volume())||solid.volume()<=1e-8)throw new Error(`${label}: 零体积或负体积网格`);
}
function sourceMesh(kernel:Kernel,source:BufferGeometry):KernelMesh{
  const g=source.index?source.clone():mergeVertices(source,1e-5);
  if(!g.index){g.dispose();throw new Error('无法构造三角网格索引');}
  const position=g.getAttribute('position');
  const vertProperties=new Float32Array(position.count*3);
  for(let i=0;i<position.count;i++){
    vertProperties[i*3]=position.getX(i);
    vertProperties[i*3+1]=position.getY(i);
    vertProperties[i*3+2]=position.getZ(i);
  }
  const triVerts=Uint32Array.from(g.index.array as ArrayLike<number>);
  // Fix an inverted mesh at import time (without altering the source model).
  let signed=0;
  for(let i=0;i<triVerts.length;i+=3){
    const a=triVerts[i]*3,b=triVerts[i+1]*3,c=triVerts[i+2]*3;
    const ax=vertProperties[a],ay=vertProperties[a+1],az=vertProperties[a+2];
    const bx=vertProperties[b],by=vertProperties[b+1],bz=vertProperties[b+2];
    const cx=vertProperties[c],cy=vertProperties[c+1],cz=vertProperties[c+2];
    signed+=ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx);
  }
  if(signed<0){
    for(let i=0;i<triVerts.length;i+=3){
      const temp=triVerts[i+1];triVerts[i+1]=triVerts[i+2];triVerts[i+2]=temp;
    }
  }
  g.dispose();
  const mesh=new kernel.Mesh({numProp:3,triVerts,vertProperties});
  mesh.merge();
  return mesh;
}
function asSolid(kernel:Kernel,source:BufferGeometry,label:string):Solid{
  let solid:Solid;
  try{solid=new kernel.Manifold(sourceMesh(kernel,source));ensure(label,solid);}
  catch(error){throw new Error(`${label} 不是封闭可布尔的金属实体：${String(error)}`);}
  return solid;
}
function socketTool(kernel:Kernel,site:Site):Solid{
  const r=site.diameter*.5;
  const height=site.kind==='main'?Math.max(.27,site.diameter*1.3):Math.max(.115,site.diameter*1.35);
  // A tapered clearance pocket beneath the stone girdle. Its finite depth
  // preserves the ring's comfort-fit inner bore rather than drilling through it.
  const cylinder=kernel.Manifold.cylinder(height,r*.76,r*.90,32,true);
  const alongY=cylinder.rotate([90,0,0]);cylinder.delete();
  const alongNormal=alongY.rotate([0,0,-site.tilt*180/Math.PI]);alongY.delete();
  const center=site.kind==='main'?site.y-height*.24:site.y-height*.26;
  const placed=alongNormal.translate([site.x,center,site.z]);alongNormal.delete();
  return placed;
}
function fromMesh(mesh:KernelMesh):BufferGeometry{
  const count=mesh.vertProperties.length/mesh.numProp;
  const positions=new Float32Array(count*3);
  for(let i=0;i<count;i++){
    positions[i*3]=mesh.vertProperties[i*mesh.numProp];
    positions[i*3+1]=mesh.vertProperties[i*mesh.numProp+1];
    positions[i*3+2]=mesh.vertProperties[i*mesh.numProp+2];
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setIndex(mesh.triVerts.slice());
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}
export type MetalReport={
  engine:'manifold-wasm';closed:boolean;connectedShells:number;metalParts:number;
  socketCount:number;originalVolume:number;carvedVolume:number;finalVolume:number;
  socketCollisionVolume:number;passed:boolean;
  minWallMm:null;manufacturingVerified:false;warnings:string[];
};
export type MetalResult={geometry:BufferGeometry;report:MetalReport};
export async function buildFusedMetal(input:Design):Promise<MetalResult>{
  const d=constrainDesign(input),kernel=await loadSolidKernel();
  const assembly=createAssembly(d),sites=buildStoneLayout(d);
  const owned:Solid[]=[];
  const remember=(s:Solid)=>{owned.push(s);return s;};
  try{
    const source=assembly.parts.map(p=>remember(asSolid(kernel,p.geometry,p.name)));
    const united=remember(kernel.Manifold.union(source));
    ensure('金属并集',united);
    const originalVolume=united.volume();
    const tools=sites.map(site=>remember(socketTool(kernel,site)));
    const cutter=tools.length?remember(kernel.Manifold.union(tools)):null;
    let carved=united;
    if(cutter){
      ensure('镶口切削体',cutter);
      carved=remember(united.subtract(cutter));
      ensure('金属镶口差集',carved);
    }
    let residual=0;
    if(cutter){
      const clash=remember(carved.intersect(cutter));
      residual=Math.abs(clash.volume());
    }
    const seatSolids:Solid[]=[];
    let seats:ReturnType<typeof metalSetting>= [];
    try{
      for(const site of sites){
        const transformAngle=-site.tilt*180/Math.PI;
        seats=metalSetting(d,site);
        for(const seat of seats){
          const rotated=remember(asSolid(kernel,seat.geometry,seat.name)).rotate([0,0,transformAngle]);
          const moved=remember(rotated.translate([site.x,site.y,site.z]));
          seatSolids.push(moved);
        }
        seats.forEach(x=>x.geometry.dispose());seats=[];
      }
    }finally{seats.forEach(x=>x.geometry.dispose());}
    const combined=seatSolids.length?remember(kernel.Manifold.union([carved,...seatSolids])):carved;
    ensure('最终金属融合',combined);
    const connected=combined.decompose();
    const connectedShells=connected.length;
    for(const c of connected)c.delete();
    const smooth=remember(combined.calculateNormals(0,57));
    const geometry=fromMesh(smooth.getMesh(0));
    const warnings:string[]=[];
    if(connectedShells!==1)warnings.push(`融合后还存在 ${connectedShells} 个未连接金属组件；请调整结构或镶法。`);
    if(residual>1e-6)warnings.push(`镶口切削残余干涉体积 ${residual.toFixed(6)}，尚需重新求解。`);
    warnings.push('完成的是三角网格布尔，不是精确 CAD B-rep；尚无全局壁厚、压爪和铸造验证。');
    return {geometry,report:{
      engine:'manifold-wasm',closed:true,connectedShells,metalParts:assembly.parts.length,
      socketCount:sites.length,originalVolume,carvedVolume:carved.volume(),
      finalVolume:combined.volume(),socketCollisionVolume:residual,
      passed:connectedShells===1&&residual<=1e-6,
      minWallMm:null,manufacturingVerified:false,warnings
    }};
  }finally{
    for(let i=owned.length-1;i>=0;i--)owned[i].delete();
    assembly.dispose();
  }
}
