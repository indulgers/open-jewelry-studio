import {it,expect} from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import {constrain,countRange,validateSource} from '../public/forme/design-policy.js';

const html=fs.readFileSync('public/forme/index.html','utf8');
const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const {defaults,projectData}=vm.runInNewContext(
  section('const SOURCE_POSITIONS_BASE64','function tubeFromPath')+
  section('function projectData','let restoreNote')+'({defaults,projectData})',
  {atob,constrain,validateSource});

it('constrains an old design without changing its saved settings',()=>{
  const saved={...defaults,bloom:85,twist:-90,depth:210,curve:100,coverage:125,count:40,diameter:18};
  const copy={...saved};
  const restored=projectData({type:'FORME_JEWELRY_DESIGN',schemaVersion:1,settings:saved});
  expect(restored.settings).toMatchObject({bloom:10,twist:-4,depth:120,curve:25,coverage:102,boreDiameter:19.5,diameter:18.3});
  expect(restored.adjusted).toBe(true);
  expect(saved).toEqual(copy);
  expect(constrain(restored.settings,defaults)).toEqual(restored.settings);
});

it('links ring size, pattern width and repeat count, including the mirrored seam',()=>{
  for(const product of ['ring','necklace'])for(const boreDiameter of [16,19.5,23])for(const band of [5,6,7])for(const count of [-50,11,50]){
    const s=constrain({...defaults,product,boreDiameter,band,count,mirror:true},defaults);
    const [lo,hi]=countRange(s);
    expect(s.count).toBeGreaterThanOrEqual(lo);
    expect(s.count).toBeLessThanOrEqual(hi);
    expect(s.count%2).toBe(0);
    expect(s.diameter/2+.85-s.boreDiameter/2).toBeCloseTo(.25);
    expect(s.coverage).toBe(product==='ring'?102:100);
  }
});

it('does not allow unknown STL shapes to opt into calibrated flower deformation',()=>{
  const s=constrain({...defaults,bloom:10,twist:4,curve:25,depth:120,mirror:true,arrange:'alternating'},defaults,true);
  expect(s).toMatchObject({bloom:0,twist:0,curve:0,depth:100,mirror:false,arrange:'even'});
});

it('rejects malformed project meshes and normalizes untrusted settings',()=>{
  expect(()=>projectData({type:'FORME_JEWELRY_DESIGN',schemaVersion:2,settings:{}})).toThrow();
  const s=constrain({...defaults,bloom:NaN,twist:Infinity,band:'8',material:'<script>',finish:'unknown',name:' '.repeat(100)},defaults);
  expect(s).toMatchObject({bloom:0,twist:0,band:6,material:'silver',finish:'polished',name:defaults.name});
  for(const mesh of [
    {positions:[0,0,0,1,0,0,0,1,0],indices:[0,1,3]},
    {positions:[0,0,0,1,0,0,0,1,0],indices:[0,1,1.5]},
    {positions:[NaN,0,0],indices:[0,0,0]},
    {positions:[2,0,0],indices:[0,0,0]},
    {positions:[0,0],indices:[0,0,0]},
    {positions:[0,0,0],indices:[]},
  ])expect(()=>validateSource(mesh)).toThrow();
  const bad=Buffer.from(new Float32Array([NaN,0,0]).buffer).toString('base64');
  const indices=Buffer.from(new Uint32Array([0,0,0]).buffer).toString('base64');
  expect(()=>projectData({type:'FORME_JEWELRY_DESIGN',schemaVersion:1,settings:{},model:{type:'custom',positions:bad,indices}})).toThrow(/坐标/);
});
