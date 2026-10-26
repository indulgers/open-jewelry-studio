import fs from 'node:fs';
const b=fs.readFileSync('public/models/gem.glb');
if(b.length<20||b.readUInt32LE(0)!==0x46546c67||b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==b.length)
  throw new Error('Invalid binary glTF');
const size=b.readUInt32LE(12);
if(20+size>b.length||b.readUInt32LE(16)!==0x4e4f534a)throw new Error('Invalid GLB JSON chunk');
const data=JSON.parse(b.subarray(20,20+size).toString());
if(!data.meshes?.length||data.buffers.some(buffer=>buffer.uri))throw new Error('Expected self-contained gemstone mesh');
console.log(JSON.stringify({bytes:b.length,meshes:data.meshes.map(m=>m.name),accessors:data.accessors.length},null,2));
