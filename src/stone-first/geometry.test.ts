import {describe,expect,it} from 'vitest';
import {createAssembly,petalGeometry,metalSetting,bandGeometry,ringOuterY} from './geometry';
import {Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {recipeDesign,buildStoneLayout} from './recipe';
describe('parametric jewelry geometry',()=>{
 it('makes a distinct connected shank + petal mesh set with finite coordinates',()=>{
  const d=recipeDesign('floral-pave');
  const assembly=createAssembly(d);
  try{
   const petals=assembly.parts.filter(p=>p.name.startsWith('perforated-petal-'));
   expect(petals).toHaveLength(4);
   expect(assembly.parts.some(p=>p.name==='continuous-shank')).toBe(true);
   expect(assembly.parts.some(p=>p.name.startsWith('integrated-gallery-shoulder'))).toBe(true);
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
   expect(range).toBeGreaterThan(.05);
  }finally{g.dispose();}
 });
 it('makes continuous parallel rails for a channel arrangement instead of disconnected bezel rings',()=>{
  const d=recipeDesign('architectural-halo'),assembly=createAssembly(d);
  try{expect(assembly.parts.filter(p=>p.name.startsWith('continuous-channel-rail-'))).toHaveLength(4);
   const site=buildStoneLayout(d).find(s=>s.mount==='channel');
   expect(site).toBeDefined();
   const parts=metalSetting(d,site!);
   expect(parts.some(p=>p.name==='bezel-lip')).toBe(false);
   expect(parts.some(p=>p.name==='under-gallery')).toBe(false);
   parts.forEach(p=>p.geometry.dispose());
  }finally{assembly.dispose();}
 });
 it('cuts an actual opening beneath a pavé stone rather than painting it on a solid petal',()=>{
  const d=recipeDesign('floral-pave'),sites=buildStoneLayout(d);
  const stone=sites.find(s=>s.zone==='petal'&&s.leaf===0);
  expect(stone).toBeDefined();
  const surface=petalGeometry(d,0,sites);
  const ray=new Raycaster(new Vector3(stone!.x,stone!.y+2,stone!.z),new Vector3(0,-1,0));
  const mesh=new Mesh(surface,new MeshBasicMaterial({side:2}));
  try{
    mesh.updateMatrixWorld();
    const hits=ray.intersectObject(mesh);
    // No upper metal cap can remain inside the pavilion opening.
    expect(hits.filter(hit=>hit.point.y>stone!.y-.065)).toHaveLength(0);
    expect(surface.getAttribute('position').count).toBeGreaterThan(100);
  }finally{surface.dispose();mesh.material.dispose();}
 });
 it('leaves a shallow pocket on the shoulder instead of an intact metal lid',()=>{
  const d=recipeDesign('architectural-halo'),site=buildStoneLayout(d).find(s=>s.zone==='shoulder');
  expect(site).toBeDefined();
  const g=bandGeometry(d,buildStoneLayout(d)),ray=new Raycaster(new Vector3(site!.x,site!.y+2,site!.z),new Vector3(0,-1,0));
  const mesh=new Mesh(g,new MeshBasicMaterial({side:2}));
  try{
   mesh.updateMatrixWorld();
   const hits=ray.intersectObject(mesh);
   expect(hits.filter(hit=>hit.point.y>site!.y-.055)).toHaveLength(0);
   expect(ringOuterY(d,site!.x,site!.z)-site!.y).toBeGreaterThan(0);
  }finally{g.dispose();mesh.material.dispose();}
 });
 it('rebuilds the whole crown with four or six actual formed prongs',()=>{
  const d=recipeDesign('floral-solitaire'),site=buildStoneLayout(d)[0];
  const four=metalSetting(d,site),six=metalSetting({...d,prongCount:6},site);
  try{
   expect(four.filter(p=>p.name.startsWith('formed-prong-'))).toHaveLength(4);
   expect(six.filter(p=>p.name.startsWith('formed-prong-'))).toHaveLength(6);
   expect(six.filter(p=>p.name.startsWith('burnished-prong-tip-'))).toHaveLength(6);
   expect(six.some(p=>p.name==='under-gallery')).toBe(true);
  }finally{[...four,...six].forEach(p=>p.geometry.dispose());}
 });
 it('moves a stone into the socket when the designer changes the embed depth',()=>{
  const d=recipeDesign('floral-pave');
  const a=buildStoneLayout(d).find(p=>p.zone==='petal');
  const b=buildStoneLayout({...d,seatDepthMm:.24}).find(p=>p.zone==='petal');
  expect(a).toBeDefined();expect(b).toBeDefined();
  expect(a!.x).toBeCloseTo(b!.x);expect(a!.z).toBeCloseTo(b!.z);
  expect(a!.y-b!.y).toBeCloseTo((.24-d.seatDepthMm)*.1);
 });
 it('rebuilds different mounts for prong and bezel without losing the gallery',()=>{
  const d=recipeDesign('floral-solitaire'),site=buildStoneLayout(d)[0];
  const prong=metalSetting(d,site),bezel=metalSetting(d,{...site,mount:'bezel'});
  try{
   expect(prong.some(p=>p.name.startsWith('formed-prong'))).toBe(true);
   expect(bezel.some(p=>p.name==='bezel-lip')).toBe(true);
   expect(bezel.some(p=>p.name.startsWith('formed-prong'))).toBe(false);
   expect(prong.some(p=>p.name==='under-gallery')).toBe(true);
   expect(bezel.some(p=>p.name==='under-gallery')).toBe(true);
  }finally{[...prong,...bezel].forEach(p=>p.geometry.dispose());}
 });
});
