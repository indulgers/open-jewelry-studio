import {describe,expect,it} from 'vitest';
import {buildFusedMetal} from './solidBoolean';
import {recipeDesign} from './recipe';

describe('WASM manifold final assembly',()=>{
 it('builds a physically closed and cut gold shank for floral solitaire',async()=>{
  const result=await buildFusedMetal(recipeDesign('floral-solitaire'));
  try{
    expect(result.report.engine).toBe('manifold-wasm');
    expect(result.report.closed).toBe(true);
    expect(result.report.finalVolume).toBeGreaterThan(0);
    expect(result.report.carvedVolume).toBeLessThan(result.report.originalVolume);
    expect(result.report.connectedShells).toBe(1);
    expect(result.report.socketCollisionVolume).toBeLessThan(1e-6);
    expect(result.report.manufacturingVerified).toBe(false);
    expect(result.geometry.index?.count).toBeGreaterThan(150);
  }finally{result.geometry.dispose();}
 },120000);
});
