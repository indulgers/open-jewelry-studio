import {describe,expect,it,vi} from 'vitest';
import {DataUtils,HalfFloatType,LinearSRGBColorSpace} from 'three';
import {createStudioLighting} from './studioLighting';

describe('authored jewelry studio',()=>{
  it('provides independent neutral radiance fields with highlight and dark-facet information',()=>{
    const studio=createStudioLighting(128,64);
    expect(studio.metal).not.toBe(studio.gem);
    const fields:number[][]=[];
    for(const texture of [studio.metal,studio.gem]){
      expect(texture.type).toBe(HalfFloatType);
      expect(texture.colorSpace).toBe(LinearSRGBColorSpace);
      const data=texture.image.data as Uint16Array;
      const luminance:number[]=[];
      for(let i=0;i<data.length;i+=4){
        const r=DataUtils.fromHalfFloat(data[i]);
        expect(data[i+1]).toBe(data[i]);
        expect(data[i+2]).toBe(data[i]);
        expect(Number.isFinite(r)&&r>=0).toBe(true);
        luminance.push(r);
      }
      expect(Math.max(...luminance)).toBeGreaterThan(2);
      expect(Math.min(...luminance)).toBeLessThan(0.3);
      expect(luminance.filter(v=>v>1).length).toBeGreaterThan(100);
      fields.push(luminance);
    }
    expect(fields[0]).not.toEqual(fields[1]);
    studio.dispose();
  });
  it('releases both texture allocations exactly once and does not share them across viewers',()=>{
    const a=createStudioLighting(64,32),b=createStudioLighting(64,32);
    const metal=vi.fn(),gem=vi.fn();
    a.metal.addEventListener('dispose',metal);a.gem.addEventListener('dispose',gem);
    a.dispose();a.dispose();
    expect(metal).toHaveBeenCalledTimes(1);expect(gem).toHaveBeenCalledTimes(1);
    expect(b.metal).not.toBe(a.metal);expect(b.gem).not.toBe(a.gem);
    expect((b.gem.image.data as Uint16Array).length).toBe(64*32*4);
    b.dispose();
  });
  it('rejects invalid dimensions instead of allocating unbounded or empty textures',()=>{
    for(const [width,height] of [[0,32],[64,-1],[64.5,32],[4096,2048],[64,NaN]])
      expect(()=>createStudioLighting(width,height)).toThrow(RangeError);
  });
});
