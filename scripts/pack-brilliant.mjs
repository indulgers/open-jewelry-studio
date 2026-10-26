import fs from 'node:fs';
import crypto from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
const sourcePath='assets/source/gem/math-diamond.gltf';
const io=new NodeIO(),doc=await io.read(sourcePath),root=doc.getRoot();
for(const node of root.listNodes())node.setName('Gemstone');
for(const mesh of root.listMeshes())mesh.setName('Gemstone');
const primitive=root.listMeshes()[0].listPrimitives()[0];
const positions=primitive.getAttribute('POSITION');
const triangles=primitive.getIndices().getCount()/3;
if(triangles<150)throw new Error('Expected multi-tier brilliant cut');
const bytes=await io.writeBinary(doc);
fs.writeFileSync('public/models/gem.glb',bytes);
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.writeFileSync('assets/provenance.json',JSON.stringify({
  sourceTitle:'Math Diamond — Diamond Shader Lab',author:'Ehsan Moradi',
  sourceUrl:'https://github.com/ehsanwwe/diamond-shader-lab',
  downloadUrl:'https://raw.githubusercontent.com/ehsanwwe/diamond-shader-lab/main/public/models/math-diamond.gltf',
  licenseName:'MIT',licenseUrl:'https://github.com/ehsanwwe/diamond-shader-lab/blob/main/LICENSE',
  acquiredAt:'2026-10-18',sourceSha256:digest(fs.readFileSync(sourcePath)),
  sourceBufferSha256:digest(fs.readFileSync('assets/source/gem/math-diamond.bin')),
  outputSha256:digest(bytes),triangles,
  modifications:'Packed original glTF and binary into self-contained GLB; renamed mesh/node; preserved cut and flat normals; runtime material replaced.',
  bounds:{min:positions.getMin([]),max:positions.getMax([])},
},null,2)+'\n');
console.log({triangles,bytes:bytes.length});
