import {describe,it,expect} from 'vitest';
import profiles from './profiles.json';
import {
  PRESETS,allowedTechniques,compatibleTechnique,settingPlan,
  inSilhouette,distanceToOutline,validatePreset,minimumMotifSize,normalizeMotifSize,
} from './designGrammar';
import {buildRadialEngraving,createPetalSolid} from './designGeometry';
import {triangleEdgeCounts} from './brilliantGeometry';
import {mineralPixel} from './mineralInlays';

describe('Xiayngyan artisan design grammar',()=>{
  it('keeps the six screenshot-derived recipes structurally valid',()=>{
    expect(PRESETS).toHaveLength(6);
    expect(new Set(PRESETS.map(p=>p.id)).size).toBe(6);
    for(const preset of PRESETS)expect(validatePreset(preset).permitted,preset.id).toBe(true);
  });
  it('keeps scaled pavé metal edge allowance from silently shrinking below reference layout',()=>{
    expect(minimumMotifSize('pave')).toBe(15);
    expect(minimumMotifSize('cluster')).toBe(15);
    expect(normalizeMotifSize('pave',11)).toBe(15);
    expect(normalizeMotifSize('inlay',11)).toBe(11);
    expect(normalizeMotifSize('pave',18)).toBe(18);
  });
  it('does not allow sculpted five-petals on butterfly or feather meshes',()=>{
    expect(allowedTechniques('flower')).toContain('sculpted');
    expect(allowedTechniques('blossom')).toContain('sculpted');
    for(const k of ['butterfly','feather','clover'] as const)
      expect(compatibleTechnique(k,'sculpted')).toBe('inlay');
  });
  it.each(['clover','flower','blossom','butterfly','heart','shell','feather'] as const)(
    '%s pavé uses real silhouette allowance and separate finite gem sites',motif=>{
    const plan=settingPlan(motif,'pave'),poly=profiles[motif].outline;
    expect(plan.sites.length).toBeGreaterThan(15);
    expect(plan.sites.length).toBeLessThan(140);
    expect(plan.constructionReady).toBe(false);
    for(const site of plan.sites){
      expect(inSilhouette(site.x,site.y,poly)).toBe(true);
      expect(distanceToOutline(site.x,site.y,poly)+1e-4).toBeGreaterThanOrEqual(site.radius+plan.proposedMinEdgeMm);
    }
    for(let i=0;i<plan.sites.length;i++)for(let j=i+1;j<plan.sites.length;j++){
      const a=plan.sites[i],b=plan.sites[j];
      expect(Math.hypot(a.x-b.x,a.y-b.y)+1e-4).toBeGreaterThanOrEqual(
        a.radius+b.radius+plan.proposedMinGapMm
      );
    }
  });
  it('restricts engraved rays inside the real silhouette',()=>{
    for(const motif of ['clover','shell','heart'] as const){
      const rays=buildRadialEngraving(motif,90);
      expect(rays.length).toBeGreaterThan(50);
      for(const ray of rays){
        expect(inSilhouette(ray.end[0],ray.end[1],profiles[motif].outline)).toBe(true);
        expect(ray.start.every(Number.isFinite)).toBe(true);
      }
    }
  });
  it('sculpted petals are watertight 3D metals, not a white overlay',()=>{
    for(let i=0;i<5;i++){
      const petal=createPetalSolid(i*Math.PI*2/5);
      const mesh=triangleEdgeCounts(petal);
      expect(mesh.boundaryEdges).toBe(0);
      expect(mesh.nonManifoldEdges).toBe(0);
      petal.dispose();
    }
  });
  it('red and green mineral textures differ by material and position',()=>{
    const greenA=mineralPixel('malachite',.17,.23),greenB=mineralPixel('malachite',.87,.23);
    const carnelian=mineralPixel('carnelian',.17,.23);
    expect(greenA).not.toEqual(greenB);
    expect(greenA).not.toEqual(carnelian);
    expect(greenA[1]).toBeGreaterThan(greenA[0]);
    expect(carnelian[0]).toBeGreaterThan(carnelian[1]);
  });
});
