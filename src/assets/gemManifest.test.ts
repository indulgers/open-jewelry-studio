// @vitest-environment node
import fs from 'node:fs';
import crypto from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {GEM_ASSET} from './gemManifest';
describe('shipped external gemstone',()=>{
  it('has a real local GLB and auditable external provenance',()=>{
    const b=fs.readFileSync('public'+GEM_ASSET.url);
    expect(b.readUInt32LE(0)).toBe(0x46546c67);
    expect(b.readUInt32LE(8)).toBe(b.length);
    const json=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
    expect(json.meshes.some((m:{name:string})=>m.name===GEM_ASSET.meshName)).toBe(true);
    expect(json.buffers.every((b:{uri?:string})=>!b.uri)).toBe(true);
    const p=JSON.parse(fs.readFileSync('assets/provenance.json','utf8'));
    expect(crypto.createHash('sha256').update(b).digest('hex')).toBe(p.outputSha256);
    expect(GEM_ASSET.sourceUrl).toMatch(/^https:\/\//);
    expect(GEM_ASSET.author.length).toBeGreaterThan(2);
    expect(GEM_ASSET.licenseName).toBe('MIT');
    // A closed multi-tier brilliant-cut must replace the original 22-triangle toy mesh.
    const primitive=json.meshes[0].primitives[0];
    const triangleCount=json.accessors[primitive.indices ?? primitive.attributes.POSITION].count/3;
    expect(triangleCount).toBeGreaterThan(150);
  });
});
