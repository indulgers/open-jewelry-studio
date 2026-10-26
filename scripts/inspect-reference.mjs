// Local diagnostic only: decode a supplied GLB without uploading or changing it.
import fs from 'node:fs';
import crypto from 'node:crypto';
import draco3d from 'draco3d';
import {Box3,Matrix4,Quaternion,Vector3} from 'three';

const filename=process.argv[2];
if(!filename)throw new Error('Usage: node scripts/inspect-reference.mjs <model.glb> [report.json]');
const bytes=fs.readFileSync(filename);
if(bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)
  throw new Error('Not a valid binary glTF 2 container');
let json,binary;
for(let offset=12;offset<bytes.length;){
  const size=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4);
  if(offset+8+size>bytes.length)throw new Error('Invalid GLB chunk bounds');
  const data=bytes.subarray(offset+8,offset+8+size);
  if(type===0x4e4f534a)json=JSON.parse(data.toString());
  if(type===0x004e4942)binary=data;
  offset+=8+size;
}
if(!json||!binary)throw new Error('Expected JSON and binary chunks');
const draco=await draco3d.createDecoderModule({});
const parents=new Map();
json.nodes.forEach((node,index)=>node.children?.forEach(child=>parents.set(child,index)));
function world(index){
  const node=json.nodes[index];
  const matrix=node.matrix?new Matrix4().fromArray(node.matrix):new Matrix4().compose(
    new Vector3().fromArray(node.translation??[0,0,0]),new Quaternion().fromArray(node.rotation??[0,0,0,1]),
    new Vector3().fromArray(node.scale??[1,1,1]),
  );
  return parents.has(index)?world(parents.get(index)).multiply(matrix):matrix;
}
const meshes=[];
for(let meshIndex=0;meshIndex<json.meshes.length;meshIndex++){
  const nodeIndex=json.nodes.findIndex(node=>node.mesh===meshIndex),matrix=world(nodeIndex);
  for(const primitive of json.meshes[meshIndex].primitives){
    const compressed=primitive.extensions?.KHR_draco_mesh_compression;
    if(!compressed)throw new Error('This diagnostic currently expects Draco mesh primitives');
    const view=json.bufferViews[compressed.bufferView];
    const input=binary.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);
    const buffer=new draco.DecoderBuffer(),decoder=new draco.Decoder(),mesh=new draco.Mesh();
    buffer.Init(new Int8Array(input),input.length);
    try{
      const status=decoder.DecodeBufferToMesh(buffer,mesh);
      if(!status.ok())throw new Error(status.error_msg());
      const attribute=decoder.GetAttributeByUniqueId(mesh,compressed.attributes.POSITION);
      const data=new draco.DracoFloat32Array();decoder.GetAttributeFloatForAllPoints(mesh,attribute,data);
      const positions=new Float32Array(data.size());
      for(let i=0;i<positions.length;i++)positions[i]=data.GetValue(i);
      draco.destroy(data);
      const bounds=new Box3(),keys=[];
      for(let i=0;i<mesh.num_points();i++){
        const point=new Vector3().fromArray(positions,i*3);
        keys.push([point.x,point.y,point.z].map(v=>Math.round(v*100000)).join(','));
        bounds.expandByPoint(point.applyMatrix4(matrix));
      }
      const edges=new Map(),face=new draco.DracoInt32Array();
      let volume=0,degenerate=0;
      for(let i=0;i<mesh.num_faces();i++){
        decoder.GetFaceFromMesh(mesh,i,face);
        const indices=[face.GetValue(0),face.GetValue(1),face.GetValue(2)];
        const points=indices.map(index=>new Vector3().fromArray(positions,index*3));
        if(new Vector3().subVectors(points[1],points[0]).cross(new Vector3().subVectors(points[2],points[0])).lengthSq()<1e-16){degenerate++;continue;}
        volume+=points[0].dot(new Vector3().crossVectors(points[1],points[2]))/6;
        for(let e=0;e<3;e++){
          const key=[keys[indices[e]],keys[indices[(e+1)%3]]].sort().join('|');
          edges.set(key,(edges.get(key)??0)+1);
        }
      }
      draco.destroy(face);
      meshes.push({meshIndex,node:json.nodes[nodeIndex].name,material:primitive.material,
        vertices:mesh.num_points(),triangles:mesh.num_faces(),degenerateTriangles:degenerate,
        boundaryEdges:[...edges.values()].filter(n=>n===1).length,
        nonManifoldEdges:[...edges.values()].filter(n=>n>2).length,
        signedLocalVolume:volume,finitePositions:[...positions].every(Number.isFinite),
        worldBounds:{min:bounds.min.toArray(),max:bounds.max.toArray(),size:bounds.getSize(new Vector3()).toArray()}});
    }finally{draco.destroy(mesh);draco.destroy(decoder);draco.destroy(buffer);}
  }
}
const viewer=json.scenes[json.scene??0]?.extensions?.WEBGI_viewer;
const plugin=name=>viewer?.plugins.find(item=>item.type===name);
const report={filename,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
  generator:json.asset,extensions:json.extensionsUsed,meshes,totalTriangles:meshes.reduce((n,m)=>n+m.triangles,0),
  savedSettings:{camera:viewer?.scene?.defaultCamera,ground:plugin('Ground'),ssr:plugin('SSReflection'),
    ao:plugin('SSAO'),bloom:plugin('Bloom'),tonemap:plugin('Tonemap'),progressive:plugin('Progressive'),
    taa:plugin('TAA'),diamondPlugin:plugin('Diamond'),
    diamondMaterials:json.materials.map((m,i)=>({index:i,settings:m.extensions?.WEBGI_materials_diamond})).filter(m=>m.settings),
    environments:Object.values(viewer?.resources?.textures??{}).map(t=>({name:t.name,rootPath:t.userData?.rootPath})),
    embeddedImages:json.images?.length??0,resourceImages:Object.keys(viewer?.resources?.images??{}).length??0}};
const output=JSON.stringify(report,null,2);
if(process.argv[3])fs.writeFileSync(process.argv[3],output+'\n');
console.log(output);
