import {describe,expect,it} from 'vitest';
import {BufferGeometry,InterleavedBuffer,InterleavedBufferAttribute} from 'three';
import {prepareGemGeometry} from './gemPreparation';
describe('glTF boundary normalization',()=>{
  it('unpacks interleaved attributes for refraction without mutating the cached source',()=>{
    const source=new BufferGeometry();
    const data=new InterleavedBuffer(new Float32Array([0,0,0,0,0,1,1,0,0,0,0,1,0,1,0,0,0,1]),6);
    source.setAttribute('position',new InterleavedBufferAttribute(data,3,0));
    source.setAttribute('normal',new InterleavedBufferAttribute(data,3,3));
    const prepared=prepareGemGeometry(source,[0,0,0]);
    expect((prepared.attributes.position as InterleavedBufferAttribute).isInterleavedBufferAttribute).not.toBe(true);
    expect(prepared.attributes.position.getX(1)).toBe(1);
    expect(prepared.index).not.toBeNull();
    expect((source.attributes.position as InterleavedBufferAttribute).isInterleavedBufferAttribute).toBe(true);
    prepared.dispose();source.dispose();
  });
});
