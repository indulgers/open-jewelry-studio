import {describe,expect,it} from 'vitest';
import {RECIPES,PARAMS,STRUCTURES,GRAMMARS,SETTINGS,MOUNTS,buildStoneLayout,checkDesign,constrainDesign,measureGaps,recipeDesign,summary} from './recipe';
describe('stone-first assembly grammar',()=>{
 it('preserves all demanded five-step options, six deformations and six gem patterns',()=>{
  expect(STRUCTURES).toHaveLength(5);expect(GRAMMARS).toHaveLength(4);
  expect(PARAMS).toHaveLength(6);expect(SETTINGS).toHaveLength(6);expect(MOUNTS).toHaveLength(4);
  expect(RECIPES.length).toBeGreaterThanOrEqual(3);
 });
 it.each(RECIPES)('generates valid stone positions for $name',r=>{
  const d=recipeDesign(r.id),sites=buildStoneLayout(d);
  expect(sites.length).toBeGreaterThan(0);
  expect(sites.every(s=>[s.x,s.y,s.z,s.diameter,s.angle,s.tilt].every(Number.isFinite))).toBe(true);
  expect(sites.every(s=>s.diameter>0)).toBe(true);
  expect(new Set(sites.map(s=>s.id)).size).toBe(sites.length);
  expect(measureGaps(sites)===null||measureGaps(sites)!>=d.gapMm-0.002).toBe(true);
  expect(checkDesign(d,sites).some(c=>c.severity==='unverified')).toBe(true);
  expect(summary(d,sites).total).toBe(sites.length);
 });
 it('reflows pavé based on the gemstone diameter and gap instead of a fixed stone count',()=>{
  const a=recipeDesign('floral-pave');
  const dense=buildStoneLayout({...a,accentDiameter:.60,gapMm:.1});
  const sparse=buildStoneLayout({...a,accentDiameter:1.2,gapMm:.3});
  expect(dense.length).toBeGreaterThan(sparse.length);
 });
 it('keeps the focus large and removes accent gems in solitaire mode',()=>{
  const d={...recipeDesign('floral-solitaire'),setting:'solitaire' as const};
  const sites=buildStoneLayout(d);
  expect(sites).toHaveLength(1);expect(sites[0].kind).toBe('main');
  expect(buildStoneLayout({...d,setting:'none'})).toHaveLength(0);
 });
 it('rebuilds flowers when the repeat, rotation or emphasis changes',()=>{
  const a=recipeDesign('floral-pave');
  const original=buildStoneLayout(a),modified=buildStoneLayout({...a,parameters:{...a.parameters,repeat:6,rotation:25,emphasis:1.2}});
  expect(original.map(s=>[s.x,s.z])).not.toEqual(modified.map(s=>[s.x,s.z]));
 });
 it('clamps imported ranges to the bounds of available design grammar',()=>{
  const a=recipeDesign('floral-pave');
  const invalid={...a,gapMm:-1,mainDiameter:120,ringDiameter:1,parameters:{...a.parameters,repeat:99,rotation:300}};
  const result=constrainDesign(invalid);
  expect(result.gapMm).toBe(.1);expect(result.ringDiameter).toBe(15);
  expect(result.mainDiameter).toBe(6);expect(result.parameters.repeat).toBe(8);expect(result.parameters.rotation).toBe(30);
  expect(result.prongCount).toBe(4);
 });
});
