import {BufferAttribute,BufferGeometry,Float32BufferAttribute,Vector3} from 'three';
import {createFusionInput,cappedCurve} from './fusionInput';
import {constrainDesign,type Design} from '../recipe';
import {metalSetting} from '../geometry';
type MeshInput={numProp:number;vertProperties:Float32Array;triVerts:Uint32Array;merge:()=>unknown};
type Solid={status:()=>string;volume:()=>number;isEmpty:()=>boolean;delete:()=>void;
  subtract:(b:Solid)=>Solid;add:(b:Solid)=>Solid;decompose:()=>Solid[];getMesh:(arg?:number)=>MeshInput;
  numTri:()=>number;boundingBox:()=>{min:number[];max:number[]};};
type Kernel={
 setup:()=>void;
 Mesh:new(o:{numProp:number;vertProperties:Float32Array;triVerts:Uint32Array})=>MeshInput;
 Manifold:{new(mesh:MeshInput):Solid;union:(items:Solid[])=>Solid;}
};
let shared:Promise<Kernel>|null=null;
async function loadKernel():Promise<Kernel>{
 if(shared)return shared;
 shared=(async()=>{
  // The repository already bundles Manifold 3.5.4 for the FORME editor.
  // Keep using that local Apache-2.0 engine instead of a remote SDK.
  const isTest=import.meta.env.MODE==='test';
  const url=isTest?'file://'+process.cwd()+'/public/forme/vendor/manifold/manifold.js'
      :'/forme/vendor/manifold/manifold.js';
  const module=await import(/* @vite-ignore */ url);
  const runtime=await module.default(isTest
     ?{locateFile:(name:string)=>process.cwd()+'/public/forme/vendor/manifold/'+name}
     :{locateFile:(name:string)=>'/forme/vendor/manifold/'+name}) as Kernel;
  runtime.setup();
  return runtime;
 })();
 try{return await shared;}catch(error){shared=null;throw error;}
}
export type BooleanReport={
  status:'fused'|'fragmented'|'error';inputCount:number;cutterCount:number;triangles:number;
  volumeSceneUnits3:number;connectedComponents:number;componentVolumes:number[];componentBounds:{min:number[];max:number[]}[];minSurfaceWallMm:null;
  clearanceValidated:false;manufacturingPassed:false;warnings:string[];
};
export type BooleanResult={geometry:BufferGeometry;report:BooleanReport;dispose:()=>void};
function inputMesh(g:BufferGeometry,kernel:Kernel){
 const p=g.getAttribute('position'),index=g.getIndex();
 if(!p||p.itemSize!==3)throw Error('Missing XYZ mesh attributes');
 const verts=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){verts[i*3]=p.getX(i);verts[i*3+1]=p.getY(i);verts[i*3+2]=p.getZ(i);}
 if(!verts.every(Number.isFinite))throw Error('Nonfinite metal vertices');
 const face=index?Uint32Array.from(index.array):Uint32Array.from({length:p.count},(_,i)=>i);
 if(face.length%3!==0)throw Error('Broken triangle indices');
 const mesh=new kernel.Mesh({numProp:3,vertProperties:verts,triVerts:face});
 mesh.merge();return mesh;
}
function toSolid(g:BufferGeometry,kernel:Kernel,label:string):Solid{
 const mesh=inputMesh(g,kernel);
 let solid:Solid;
 try{solid=new kernel.Manifold(mesh);}catch(error){throw Error(label+': '+String(error));}
 if(solid.status()!=='NoError'||solid.isEmpty()){
  const why=solid.status();solid.delete();
  throw Error(label+': non-manifold source ('+why+')');
 }
 return solid;
}
function metalGeometry(mesh:MeshInput){
 const p=mesh.vertProperties,i=mesh.triVerts;
 const out=new BufferGeometry();
 if(mesh.numProp===3)out.setAttribute('position',new Float32BufferAttribute(p.slice(),3));
 else{
  const buf=new Float32Array(p.length/mesh.numProp*3);
  for(let v=0;v<buf.length/3;v++)for(let j=0;j<3;j++)buf[v*3+j]=p[v*mesh.numProp+j];
  out.setAttribute('position',new Float32BufferAttribute(buf,3));
 }
 out.setIndex(new BufferAttribute(Uint32Array.from(i),1));out.computeVertexNormals();out.computeBoundingSphere();return out;
}
/** No graceful fallback to overlapping Meshes. If CSG fails we surface an
 * explicit error and keep the last valid closed solid until a new edit succeeds. */
export async function fuseDesign(input:Design):Promise<BooleanResult>{
 const d=constrainDesign(input),k=await loadKernel(),source=createFusionInput(d);
 const owned:Solid[]=[];
 const hold=(s:Solid)=>{owned.push(s);return s;};
 try{
  // Avoid drilling through the struts that need to support the crown.
  // Cavity subtraction is for the base ring and sculptural leaves only.
  const galleryBridges=source.parts.filter(p=>p.name.startsWith('crown-to-band-'));
  const solids=source.parts.filter(p=>!p.name.startsWith('crown-to-band-'))
    .map(p=>hold(toSolid(p.geometry,k,p.name)));
  const stock=hold(k.Manifold.union(solids));
  if(stock.isEmpty()||stock.status()!=='NoError')throw Error('Metal union failed '+stock.status());
  const cutters=source.cutters.map(p=>hold(toSolid(p.geometry,k,p.name)));
  let drilled=stock;
  if(cutters.length){
    const tool=hold(k.Manifold.union(cutters));
    drilled=hold(stock.subtract(tool));
    if(drilled.isEmpty()||drilled.status()!=='NoError')throw Error('Cavity subtraction failed: '+drilled.status());
  }
  // Mounts are added AFTER cavities so the cutter cannot erase contact prongs.
  const mounting:Solid[]=galleryBridges.map(p=>hold(toSolid(p.geometry,k,p.name)));
  for(const site of source.stones){
   const geometry=metalSetting(d,site);
   for(const part of geometry){
    try{
     let g=part.geometry;
     if(part.name.startsWith('formed-prong-')){
       // Three.js TubeGeometry has open ends. Replace it with a physically
       // capped curvilinear prong before Manifold; no silent invalid solid.
       const index=Number(part.name.slice('formed-prong-'.length));
       const n=site.kind==='main'?d.prongCount:4;
       const phi=index*Math.PI*2/n+Math.PI/n,rad=site.diameter/2;
       const v=(r:number,y:number)=>new Vector3(Math.cos(phi)*r,y,Math.sin(phi)*r);
       g=cappedCurve([v(rad*.77,-rad*.30),v(rad*1.03,-rad*.04),
           v(rad*1.008,rad*.070),v(rad*.94,rad*.155)],Math.max(.006,rad*.074));
     }
     g.rotateZ(-site.tilt);g.translate(site.x,site.y,site.z);
     try{
       const solid=hold(toSolid(g,k,'mount '+site.id+' '+part.name));
       mounting.push(solid);
     }finally{if(g!==part.geometry)g.dispose();}
     continue;
    }finally{part.geometry.dispose();}
   }
  }
  const completed=mounting.length?hold(k.Manifold.union([drilled,...mounting])):drilled;
  if(completed.isEmpty()||completed.status()!=='NoError')throw Error('Final metal fuse '+completed.status());
  const connected=completed.decompose();
  const count=connected.length,componentVolumes=connected.map(s=>s.volume()),componentBounds=connected.map(s=>s.boundingBox());
  connected.forEach(s=>s.delete());
  const geom=metalGeometry(completed.getMesh());
  const report:BooleanReport={status:count===1?'fused':'fragmented',inputCount:source.parts.length+mounting.length,
   cutterCount:cutters.length,triangles:completed.numTri(),volumeSceneUnits3:completed.volume(),connectedComponents:count,componentVolumes,componentBounds,
   minSurfaceWallMm:null,clearanceValidated:false,manufacturingPassed:false,
   warnings:[
    count===1?'金属网格已经完成布尔并集和镶口差集':'仍有 '+count+' 个不连通金属实体；不得生产导出',
    '局部最小壁厚、爪根安全、宝石与金属精确干涉尚未验证',
    '网格水密并不代表已通过铸造或镶石工艺验收'
   ]};
  return {geometry:geom,report,dispose:()=>geom.dispose()};
 }finally{source.dispose();for(const o of owned)o.delete();}
}
