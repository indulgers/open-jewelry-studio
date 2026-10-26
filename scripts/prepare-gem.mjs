import fs from 'node:fs';
import crypto from 'node:crypto';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {Vector3} from 'three';
import {Document,NodeIO} from '@gltf-transform/core';

const file='assets/source/gem/diamond-cc0.stl';
const source=fs.readFileSync(file);
const geometry=new STLLoader().parse(source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength));
geometry.rotateX(-Math.PI/2);geometry.center();
const positions=geometry.attributes.position;
const edges=new Map();let volume=0;
const key=v=>v.toArray().map(n=>Math.round(n*10000)).join(',');
for(let i=0;i<positions.count;i+=3){
  const a=new Vector3().fromBufferAttribute(positions,i);
  const b=new Vector3().fromBufferAttribute(positions,i+1);
  const c=new Vector3().fromBufferAttribute(positions,i+2);
  volume+=a.dot(b.clone().cross(c))/6;
  for(const [p,q] of [[a,b],[b,c],[c,a]]){
    const edge=[key(p),key(q)].sort().join('|');edges.set(edge,(edges.get(edge)||0)+1);
  }
}
if([...edges.values()].some(count=>count!==2)||Math.abs(volume)<1e-8)throw new Error('Gemstone is not a closed nonzero-volume mesh');
if(volume<0){for(let i=0;i<positions.count;i+=3){
  const b=new Vector3().fromBufferAttribute(positions,i+1),c=new Vector3().fromBufferAttribute(positions,i+2);
  positions.setXYZ(i+1,c.x,c.y,c.z);positions.setXYZ(i+2,b.x,b.y,b.z);
}}
geometry.computeVertexNormals();geometry.computeBoundingBox();
const doc=new Document(),buffer=doc.createBuffer();
const position=doc.createAccessor('POSITION').setType('VEC3').setArray(new Float32Array(positions.array)).setBuffer(buffer);
const normal=doc.createAccessor('NORMAL').setType('VEC3').setArray(new Float32Array(geometry.attributes.normal.array)).setBuffer(buffer);
const material=doc.createMaterial('Clear gemstone').setBaseColorFactor([1,1,1,1]).setMetallicFactor(0).setRoughnessFactor(0.1);
const mesh=doc.createMesh('Gemstone').addPrimitive(doc.createPrimitive().setAttribute('POSITION',position).setAttribute('NORMAL',normal).setMaterial(material));
doc.createScene('Gemstone asset').addChild(doc.createNode('Gemstone').setMesh(mesh));
const bytes=await new NodeIO().writeBinary(doc);
fs.writeFileSync('public/models/gem.glb',bytes);
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.writeFileSync('assets/provenance.json',JSON.stringify({
  sourceTitle:'Diamant 20220723.stl',author:'PantheraLeo1359531',
  sourceUrl:'https://commons.wikimedia.org/wiki/File:Diamant_20220723.stl',
  downloadUrl:'https://upload.wikimedia.org/wikipedia/commons/5/55/Diamant_20220723.stl',
  licenseName:'CC0 1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',
  acquiredAt:'2026-10-18',sourceSha256:digest(source),outputSha256:digest(bytes),
  modifications:'Converted original STL to GLB; rotated Z-up to Y-up; centered; kept original 22 triangles and regenerated flat normals; runtime material replaced.',
  triangles:positions.count/3,closedEdges:true,signedVolume:Math.abs(volume),bounds:geometry.boundingBox,
},null,2)+'\n');
console.log({sourceTriangles:positions.count/3,bytes:bytes.length,closedEdges:true,volume:Math.abs(volume)});
geometry.dispose();
