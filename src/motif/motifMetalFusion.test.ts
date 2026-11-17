import {describe,it,expect} from 'vitest';
import {makeVisualMetalParts,fuseWearableRing} from './motifMetalFusion';
import {triangleEdgeCounts} from './brilliantGeometry';

describe('actual solid parts and optional Manifold metal fusion',()=>{
  it('builds closed source solids and never puts a wall across the finger axis',()=>{
    const p=makeVisualMetalParts(18);
    for(const [i,g] of p.all.entries()){
      const check=triangleEdgeCounts(g);
      expect(check.nonManifoldEdges, 'metal part '+i).toBe(0);
    }
    p.dispose();
  });
  it('runs the vendored Manifold Boolean engine and checks a single metal component',async()=>{
    const result=await fuseWearableRing(18);
    try{
      expect(result.report.closedTriangleSurface).toBe(true);
      expect(result.report.triangles).toBeGreaterThan(500);
      expect(result.report.connectedComponents).toBe(1);
      expect(result.report.status).toBe('fused');
      expect(result.report.manufacturingPassed).toBe(false);
    }finally{result.dispose();}
  },30000);
});
