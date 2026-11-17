import {describe,expect,it} from 'vitest';
import {createSmallBrilliantGeometry,triangleEdgeCounts} from './brilliantGeometry';
import {createComfortFitShank,comfortFitDiagnostics,SHANK_PARAMETERS} from './comfortFitGeometry';
import {nacreSample,valueNoise} from './nacreMaterials';
import {Mesh,MeshBasicMaterial,Raycaster,Vector3,DoubleSide} from 'three';

describe('quality-upgrade PBR procedural sources',()=>{
  it('produces repeatable natural nacre with limited contrast and measurable grain',()=>{
    const samples=Array.from({length:36},(_,i)=>nacreSample((i%6+.43)/6,(Math.floor(i/6)+.36)/6));
    for(const s of samples){
      for(const c of ['r','g','b'] as const)expect(s[c]).toBeGreaterThanOrEqual(0);
      for(const c of ['r','g','b'] as const)expect(s[c]).toBeLessThanOrEqual(255);
      expect(s.height).toBeGreaterThanOrEqual(0);expect(s.roughness).toBeLessThan(1);
      expect(s.r).toBeGreaterThan(175);expect(s.g).toBeGreaterThan(175);
    }
    expect(new Set(samples.map(s=>s.r)).size).toBeGreaterThan(8);
    expect(nacreSample(.13,.37)).toEqual(nacreSample(.13,.37));
    expect(valueNoise(.3,.4)).toBe(valueNoise(.3,.4));
  });
  it('gives small faceted gem a truly closed surface, not only a top-facing decal',()=>{
    const geometry=createSmallBrilliantGeometry();
    const report=triangleEdgeCounts(geometry);
    expect(report.boundaryEdges).toBe(0);
    expect(report.nonManifoldEdges).toBe(0);
    expect(geometry.getAttribute('normal').count).toBeGreaterThan(100);
    geometry.dispose();
  });
});
describe('comfort-fit band geometry',()=>{
  it.each([16,18,21])('has a closed radial wall and an empty %s mm bore',innerDiameter=>{
    const geometry=createComfortFitShank(innerDiameter);
    const surface=triangleEdgeCounts(geometry);
    expect(surface.boundaryEdges).toBe(0);
    expect(surface.nonManifoldEdges).toBe(0);
    const mesh=new Mesh(geometry,new MeshBasicMaterial({side:DoubleSide}));
    mesh.updateMatrixWorld(true);
    const bore=new Raycaster(new Vector3(-4,0,0),new Vector3(1,0,0),0,8);
    expect(bore.intersectObject(mesh)).toHaveLength(0);
    const radial=innerDiameter/2+1.2;
    const wall=new Raycaster(new Vector3(-4,radial,0),new Vector3(1,0,0),0,8);
    expect(wall.intersectObject(mesh).length).toBeGreaterThan(0);
    const d=comfortFitDiagnostics(innerDiameter);
    expect(d.preliminaryBorePass).toBe(true);
    expect(d.radialWallMinimumMm).toBeGreaterThanOrEqual(1.4);
    expect(d.manufacturingGrade).toBe(false);
    geometry.dispose();(mesh.material as MeshBasicMaterial).dispose();
  });
  it('keeps a modest rounded profile',()=>{
    expect(SHANK_PARAMETERS.minRoundRadiusMm).toBeGreaterThan(.08);
    expect(SHANK_PARAMETERS.nominalWidthMm).toBeGreaterThan(1.5);
  });
});
