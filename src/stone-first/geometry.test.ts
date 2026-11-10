import {describe,expect,it} from 'vitest';
import {createAssembly,petalGeometry,metalSetting} from './geometry';
import {recipeDesign,buildStoneLayout} from './recipe';
describe('parametric jewelry geometry',()=>{
 it('makes a distinct connected shank + petal mesh set with finite coordinates',()=>{
  const d=recipeDesign('floral-pave');
  const assembly=createAssembly(d);
  try{
   const petals=assembly.parts.filter(p=>p.name.startsWith('petal-'));
   expect(petals).toHaveLength(4);
   expect(assembly.parts.some(p=>p.name==='continuous-shank')).toBe(true);
   expect(assembly.parts.some(p=>p.name.startsWith('center-basket-bridge'))).toBe(true);
   for(const part of assembly.parts){
    const p=part.geometry.getAttribute('position');
    expect(p.count).toBeGreaterThan(40);
    expect([...p.array].every(Number.isFinite)).toBe(true);
   }
  }finally{assembly.dispose();}
 });
 it('generates an upward-facing petal surface and nonzero thickness',()=>{
  const d=recipeDesign('floral-pave'),g=petalGeometry(d,0);
  try{
   const normal=g.getAttribute('normal'),pos=g.getAttribute('position');
   const y=[...Array(normal.count)].map((_,i)=>normal.getY(i));
   expect(y.some(v=>v>.25)).toBe(true);
   expect(y.some(v=>v<-.25)).toBe(true);
   const range=Math.max(...[...pos.array].filter((_,i)=>i%3===1))-Math.min(...[...pos.array].filter((_,i)=>i%3===1));
   expect(range).toBeGreaterThan(.075);
  }finally{g.dispose();}
 });
 it('rebuilds different mounts for prong and bezel without losing the gallery',()=>{
  const d=recipeDesign('floral-solitaire'),site=buildStoneLayout(d)[0];
  const prong=metalSetting(d,site),bezel=metalSetting(d,{...site,mount:'bezel'});
  try{
   expect(prong.some(p=>p.name.startsWith('prong'))).toBe(true);
   expect(bezel.some(p=>p.name==='bezel-lip')).toBe(true);
   expect(bezel.some(p=>p.name.startsWith('prong'))).toBe(false);
   expect(prong.some(p=>p.name==='under-gallery')).toBe(true);
   expect(bezel.some(p=>p.name==='under-gallery')).toBe(true);
  }finally{[...prong,...bezel].forEach(p=>p.geometry.dispose());}
 });
});
