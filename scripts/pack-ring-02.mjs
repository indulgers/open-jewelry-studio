import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Document,NodeIO,VertexLayout} from '@gltf-transform/core';
import {Box3} from 'three';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshoptEncoder} from 'meshoptimizer';

export async function packRing(source,destination,cleanSource){
  await MeshoptEncoder.ready;
  const loader=new OBJLoader();
  const ring=loader.parse(readFileSync(source,'utf8'));
  if(cleanSource){
    // Embed the matching plain shank for models whose original pavé beads are fused into the shank.
    const plain=loader.parse(readFileSync(cleanSource,'utf8'));
    const shank=plain.getObjectByName('metal_1');
    if(!shank?.isMesh)throw new Error('Plain source is missing metal_1');
    const original=new Box3().setFromObject(ring),clean=new Box3().setFromObject(plain);
    const scale=(original.max.x-original.min.x)/(clean.max.x-clean.min.x);
    shank.geometry.scale(scale,scale,scale).translate(0,original.min.y-clean.min.y*scale,0);
    shank.name='metal_reflow_shank';
    ring.add(shank);
  }
  const document=new Document();
  const buffer=document.createBuffer();
  const scene=document.createScene();
  for(const part of ring.children){
    if(!part.isMesh||part.name.startsWith('unresolved_'))continue;
    const metal=part.name.startsWith('metal_');
    if(metal)part.geometry.deleteAttribute('normal');
    part.geometry.deleteAttribute('uv');
    const geometry=metal?mergeVertices(part.geometry,1e-6):part.geometry;
    if(!geometry.index)geometry.setIndex(Array.from({length:geometry.getAttribute('position').count},(_,index)=>index));
    if(metal){
      // Reorder the same triangles and vertices to improve index locality for transport.
      const indices=Uint32Array.from(geometry.index.array);
      const [remap]=MeshoptEncoder.reorderMesh(indices,true,true);
      const position=geometry.getAttribute('position').array;
      const ordered=new Float32Array(position.length);
      for(let vertex=0;vertex<remap.length;vertex++){
        ordered.set(position.subarray(vertex*3,vertex*3+3),remap[vertex]*3);
      }
      position.set(ordered);
      geometry.index.array.set(indices);
    }
    const primitive=document.createPrimitive();
    for(const [attr,semantic] of [['position','POSITION'],['normal','NORMAL']]){
      if(!geometry.hasAttribute(attr))continue;
      const accessor=document.createAccessor().setType('VEC3').setArray(geometry.getAttribute(attr).array).setBuffer(buffer);
      primitive.setAttribute(semantic,accessor);
    }
    primitive.setIndices(document.createAccessor().setType('SCALAR').setArray(geometry.index.array).setBuffer(buffer));
    const mesh=document.createMesh(part.name).addPrimitive(primitive);
    scene.addChild(document.createNode(part.name).setMesh(mesh));
  }
  const glb=Buffer.from(await new NodeIO().setVertexLayout(VertexLayout.SEPARATE).writeBinary(document));
  const jsonSize=glb.readUInt32LE(12);
  const manifest=JSON.parse(glb.toString('utf8',20,20+jsonSize));
  const bin=glb.subarray(jsonSize+28);
  const codec='EXT_meshopt_compression';
  const gemViews=new Set(manifest.meshes.filter(mesh=>mesh.name.startsWith('gem_'))
    .flatMap(({primitives:[primitive]})=>Object.values(primitive.attributes))
    .map(index=>manifest.accessors[index].bufferView));

  const chunks=[];
  let byteOffset=0;
  for(const [id,view] of manifest.bufferViews.entries()){
    const index=view.target===34963;
    const accessor=manifest.accessors.find(accessor=>accessor.bufferView===id);
    const mode=index?'INDICES':'ATTRIBUTES';
    const stride=index?(accessor.componentType===5125?4:2):(view.byteStride??12);
    const offset=view.byteOffset??0;
    const source=bin.subarray(offset,offset+view.byteLength);
    const count=source.length/stride;
    // The template's position and normal accessors are Float32. Preserve index order.
    const quantize=!index&&!gemViews.has(id);
    const values=quantize?MeshoptEncoder.encodeFilterExp(new Float32Array(source.buffer,source.byteOffset,source.length/4),count,stride,18,'SharedComponent'):source;
    const encoded=MeshoptEncoder.encodeGltfBuffer(values,count,stride,mode);
    view.extensions={[codec]:{buffer:0,byteOffset,byteLength:encoded.length,byteStride:stride,count,mode,...(quantize?{filter:'EXPONENTIAL'}:{})}};
    view.buffer=1;
    chunks.push(encoded);
    byteOffset+=encoded.length;
  }
  manifest.extensionsUsed=[codec];
  manifest.extensionsRequired=[codec];
  const uncompressedLength=manifest.buffers[0].byteLength;
  manifest.buffers=[{byteLength:byteOffset},{byteLength:uncompressedLength,extensions:{[codec]:{fallback:true}}}];

  const json=Buffer.from(JSON.stringify(manifest));
  const pad=bytes=>(4-bytes.length%4)%4;
  const jsonChunk=Buffer.concat([json,Buffer.alloc(pad(json),0x20)]);
  const compressed=Buffer.concat(chunks);
  const binChunk=Buffer.concat([compressed,Buffer.alloc(pad(compressed))]);
  const header=Buffer.alloc(20);
  header.write('glTF');
  header.writeUInt32LE(2,4);
  header.writeUInt32LE(header.length+jsonChunk.length+8+binChunk.length,8);
  header.writeUInt32LE(jsonChunk.length,12);
  header.write('JSON',16);
  const binHeader=Buffer.alloc(8);
  binHeader.writeUInt32LE(binChunk.length,0);
  binHeader.write('BIN',4);
  writeFileSync(destination,Buffer.concat([header,jsonChunk,binHeader,binChunk]));
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const source=process.argv[2]?resolve(process.argv[2]):new URL('../assets/source/ring-02/source.obj',import.meta.url);
  const destination=process.argv[3]?resolve(process.argv[3]):new URL('../public/models/atelier/ring-02/ring-v2.glb',import.meta.url);
  await packRing(source,destination,process.argv[4]);
}
