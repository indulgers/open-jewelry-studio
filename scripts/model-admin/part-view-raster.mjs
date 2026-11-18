import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {DoubleSide,LoadingManager,Ray,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';

const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
export async function renderPartPixels(files,kind,size){
  // Published parts are self-contained, geometry-only GLBs.
  const manager=new LoadingManager();
  manager.setURLModifier(()=>{throw new Error('部件图不读取外部资源');});
  const loader=new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
  const meshes=[];
  for(const bytes of files){
    const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    scene.updateMatrixWorld(true);
    scene.traverse(mesh=>{
      if(!mesh.isMesh||mesh.name==='metal_reflow_shank')return;
      const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      if(!geometry.attributes.normal)geometry.computeVertexNormals();
      meshes.push({geometry,gem:mesh.name.startsWith('gem_')});
    });
  }
  return render(meshes,kind,size);
}

// Sample a studio environment after light travels through the source diamond's own facets.
function diamondRadiance(tree,point,normal,kind){
  const toModel=([x,y,z])=>kind==='head'?new Vector3(x,z,-y):new Vector3(x,y,z);
  const ray=new Ray(toModel(point),toModel([0,0,-1]));
  const bend=(n,ratio)=>{
    const cosine=-ray.direction.dot(n);
    const discriminant=1-ratio*ratio*(1-cosine*cosine);
    if(discriminant<0)return false;
    ray.direction.multiplyScalar(ratio).addScaledVector(n,ratio*cosine-Math.sqrt(discriminant)).normalize();
    return true;
  };
  bend(toModel(normal),1/2.42);
  const epsilon=1e-4;
  for(let bounce=0;bounce<5;bounce++){
    ray.origin.addScaledVector(ray.direction,epsilon);
    const hit=tree.raycastFirst(ray,DoubleSide);
    if(!hit)break;
    ray.origin.copy(hit.point);
    const n=hit.face.normal;
    if(n.dot(ray.direction)>0)n.negate();
    if(bend(n,2.42))break;
    ray.direction.reflect(n).normalize();
  }
  const d=ray.direction;
  const horizontal=Math.atan2(d.x,d.z);
  const card=.5+.5*Math.tanh(7*Math.cos(3*horizontal+.38));
  const overhead=clamp((d.y+.22)*1.4,0,1);
  return 67+133*card+44*overhead;
}

function render(meshes,kind,size){
  const geometricBounds={left:Infinity,right:-Infinity,bottom:Infinity,top:-Infinity};
  const prepared=meshes.map(({geometry,gem})=>{
    const points=geometry.attributes.position, normals=geometry.attributes.normal;
    const verts=[],norms=[];
    const project=v=>kind==='head'?[v.x,-v.z,v.y]:[v.x,v.y,v.z];
    for(let i=0;i<points.count;i++){
      const p=project(new Vector3().fromBufferAttribute(points,i));
      const n=project(new Vector3().fromBufferAttribute(normals,i));
      verts.push(p);norms.push(n);
      geometricBounds.left=Math.min(p[0],geometricBounds.left);geometricBounds.right=Math.max(p[0],geometricBounds.right);
      geometricBounds.bottom=Math.min(p[1],geometricBounds.bottom);geometricBounds.top=Math.max(p[1],geometricBounds.top);
    }
    return {verts,norms,indices:geometry.index?.array,gem,tree:gem?new MeshBVH(geometry,{indirect:true}):null};
  });
  const {left,right,bottom,top}=geometricBounds;
  const extent=Math.max(right-left,top-bottom);
  if(!Number.isFinite(extent)||extent<=0)throw new Error('部件缺少有效几何');
  const scale=.89*size/extent;
  const depth=new Float32Array(size*size).fill(-Infinity);
  const rgb=Buffer.alloc(size*size*3,255);
  for(const {verts,norms,indices,gem,tree} of prepared){
    for(const p of verts){
      p[0]=size/2+(p[0]-(left+right)/2)*scale;
      p[1]=size/2-(p[1]-(top+bottom)/2)*scale;
    }
    const count=indices?.length??verts.length;
    for(let i=0;i<count;i+=3){
      const ia=indices?indices[i]:i,ib=indices?indices[i+1]:i+1,ic=indices?indices[i+2]:i+2;
      const a=verts[ia],b=verts[ib],c=verts[ic];
      const abx=b[0]-a[0],aby=b[1]-a[1],acx=c[0]-a[0],acy=c[1]-a[1];
      const area=abx*acy-aby*acx;
      if(Math.abs(area)<.00001)continue;
      const x0=clamp(Math.floor(Math.min(a[0],b[0],c[0])),0,size-1),x1=clamp(Math.ceil(Math.max(a[0],b[0],c[0])),0,size-1);
      const y0=clamp(Math.floor(Math.min(a[1],b[1],c[1])),0,size-1),y1=clamp(Math.ceil(Math.max(a[1],b[1],c[1])),0,size-1);
      const na=norms[ia],nb=norms[ib],nc=norms[ic];
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
        const dx=x+.5-a[0],dy=y+.5-a[1];
        const v=(dx*acy-dy*acx)/area,w=(abx*dy-aby*dx)/area,u=1-v-w;
        if(u<0||v<0||w<0)continue;
        const z=u*a[2]+v*b[2]+w*c[2],pixel=y*size+x;
        if(z<=depth[pixel])continue;
        depth[pixel]=z;
        let nx=u*na[0]+v*nb[0]+w*nc[0],ny=u*na[1]+v*nb[1]+w*nc[1],nz=u*na[2]+v*nb[2]+w*nc[2];
        const length=Math.hypot(nx,ny,nz)||1;
        nx/=length;ny/=length;nz/=length;
        if(nz<0){nx=-nx;ny=-ny;nz=-nz;}
        // Two broad studio light cards and one dark strip provide shape cues on polished silver.
        const rx=2*nx*nz,ry=2*ny*nz,rz=2*nz*nz-1;
        const key=Math.exp(-((rx+.52)**2/.19+(ry-.6)**2/.48));
        const edge=Math.exp(-((rx-.67)**2/.09+(ry+.24)**2/.72));
        const dark=Math.exp(-((rx+.1)**2/.042+(ry+.45)**2/.7));
        const pointX=(x+.5-size/2)/scale+(left+right)/2,pointY=(size/2-y-.5)/scale+(top+bottom)/2;
        const light=gem?clamp(20+.89*diamondRadiance(tree,[pointX,pointY,z],[nx,ny,nz],kind)+12*key,65,251)
          :clamp(152+36*nz+68*key+50*edge-87*dark+16*ry,53,248);
        const offset=pixel*3;
        rgb[offset]=clamp(light-3,0,255);
        rgb[offset+1]=clamp(light,0,255);
        rgb[offset+2]=clamp(light+(gem?8:4),0,255);
      }
    }
  }
  if(!depth.some(Number.isFinite))throw new Error('部件缺少可见表面');
  return rgb;
}
