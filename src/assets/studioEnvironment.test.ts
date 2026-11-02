import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {FloatType} from 'three';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {describe,expect,it} from 'vitest';
import {STUDIO_ENVIRONMENT} from '../viewer/studioEnvironment';

describe('local reflection environment',()=>{
  it('ships a decodable HDR with real highlight range, not a preview image',()=>{
    const file=readFileSync(resolve('public',STUDIO_ENVIRONMENT.url.slice(1)));
    const buffer=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength) as ArrayBuffer;
    const hdr=new HDRLoader().setDataType(FloatType).parse(buffer);
    if(!hdr.data||!hdr.width||!hdr.height)throw new Error('Missing studio pixels');
    expect(hdr.width).toBe(512);
    expect(hdr.height).toBe(hdr.width/2);
    expect(hdr.data.length).toBe(hdr.width*hdr.height*4);
    let peak=0,finite=true;
    for(let i=0;i<hdr.data.length;i++){
      finite=finite&&Number.isFinite(hdr.data[i]);
      if(i%4!==3)peak=Math.max(peak,hdr.data[i]);
    }
    expect(finite).toBe(true);
    expect(peak).toBeGreaterThan(1);
  });
});
