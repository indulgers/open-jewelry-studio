import {describe,expect,it} from 'vitest';
import {fuseDesign} from './manifoldFusion';
import {recipeDesign} from '../recipe';

describe('Manifold-3D gold assembly',()=>{
 it('unions a ring, four petals and its main prong gallery into one closed metal mesh',async()=>{
  const result=await fuseDesign(recipeDesign('floral-solitaire'));
  try{
    expect(result.report.triangles).toBeGreaterThan(100);
    expect(result.report.volumeSceneUnits3).toBeGreaterThan(0);
    expect(result.report.cutterCount).toBe(1);
    expect(result.report.socketResidualVolume).toBeLessThan(1e-7);
    expect(result.report.connectedComponents).toBe(1);
    expect(result.report.status).toBe('fused');
    expect(result.report.manufacturingPassed).toBe(false);
    expect(result.report.minSurfaceWallMm).toBeNull();
    expect(result.geometry.getIndex()!.count).toBeGreaterThan(300);
  }finally{result.dispose();}
 },120000);
 it('does not silently fake an industrial pass for floral micro-pave',async()=>{
  const result=await fuseDesign(recipeDesign('floral-pave'));
  try{
    expect(result.report.cutterCount).toBeGreaterThan(3);
    expect(result.report.manufacturingPassed).toBe(false);
    expect(result.report.clearanceValidated).toBe(false);
    expect(result.report.triangles).toBeGreaterThan(100);
    expect(result.report.connectedComponents).toBe(1); // no isolated pavé beads
    expect(result.report.status).toBe('fused');
  }finally{result.dispose();}
 },120000);
 it('keeps architectural channel shoulders integrated and pockets subtracted',async()=>{
  const result=await fuseDesign(recipeDesign('architectural-halo'));
  try{
    expect(result.report.cutterCount).toBeGreaterThan(1);
    expect(result.report.connectedComponents).toBe(1);
    expect(result.report.status).toBe('fused');
    expect(result.report.socketResidualVolume).toBeLessThan(1e-7);
    expect(result.report.manufacturingPassed).toBe(false);
  }finally{result.dispose();}
 },120000);
 it('does not reject nine-stone graduated design for zero-volume numerical shells',async()=>{
  const d={...recipeDesign('floral-pave'),setting:'graduated' as const};
  const result=await fuseDesign(d);
  try{expect(result.report.connectedComponents).toBe(1);expect(result.report.status).toBe('fused');}
  finally{result.dispose();}
 },120000);
 it('connects multi-row shoulder microbeads to the actual curved shank',async()=>{
  const result=await fuseDesign(recipeDesign('geometry-eternity'));
  try{expect(result.report.connectedComponents).toBe(1);expect(result.report.status).toBe('fused');}
  finally{result.dispose();}
 },120000);
});
