// Run with node scripts/check-forme-bore.mjs. Exercise the actual embedded STL
// and its export path; sampling the tool alone would miss mirrored or repeated parts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import init from '../public/forme/vendor/manifold/manifold.js';
import {cutRing} from '../public/forme/ring-bore.js';
const html=fs.readFileSync(new URL('../public/forme/index.html',import.meta.url),'utf8');
const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const fixture=vm.runInNewContext(section('const SOURCE_POSITIONS_BASE64','function tubeFromPath')+
  section('function serializeSTL','function exportSTL')+
  'sourceMesh=loadEmbedded();({sourceMesh,state,createMotifs,smoothNormals,serializeSTL})',{atob,TextEncoder});
const kernel=await init();kernel.setup();
for(const [diameter,mirror,count] of [[19.5,false,12],[19.8,true,7],[15,false,12],[26,false,12]]){
  const {state,sourceMesh,createMotifs,smoothNormals,serializeSTL}=fixture;
  Object.assign(state,{boreDiameter:diameter,mirror,count,arrange:mirror?'alternating':'even'});
  const stock=createMotifs(),mesh=cutRing(kernel,stock,sourceMesh,state,smoothNormals);
  if(diameter===26){assert.equal(mesh.indices.length,0);continue;}
  if(diameter===15)assert.match(mesh.boreStatus,/未接触/);
  else assert.match(mesh.boreStatus,/已切削/);
  const stl=new DataView(serializeSTL([mesh]));
  let closest=Infinity;
  for(let off=84;off<stl.byteLength;off+=50){
    let cx=0,cz=0;
    for(let j=0;j<3;j++){
      const x=stl.getFloat32(off+12+j*12,true),z=stl.getFloat32(off+20+j*12,true);
      closest=Math.min(closest,Math.hypot(x,z));cx+=x/3;cz+=z/3;
    }
    closest=Math.min(closest,Math.hypot(cx,cz));
  }
  assert(closest>=diameter/2-.00002,`material intrudes: ${closest} vs Ø${diameter}`);
  if(diameter>15)assert(closest<diameter/2+.001);
}
console.log('FORME bore: exported clearances, mirrored motifs, no-contact and empty cuts passed');
