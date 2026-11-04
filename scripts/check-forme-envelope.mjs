// Exercise the shipped STL and deformation code, not a substitute test mesh.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import init from '../public/forme/vendor/manifold/manifold.js';
import {cutRing} from '../public/forme/ring-bore.js';
import {constrain,countRange} from '../public/forme/design-policy.js';
const html=fs.readFileSync(new URL('../public/forme/index.html',import.meta.url),'utf8');
const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const fixture=vm.runInNewContext(section('const SOURCE_POSITIONS_BASE64','function tubeFromPath')+
  'sourceMesh=loadEmbedded();({defaults,sourceMesh,make:s=>{state=s;return createMotifs()},smoothNormals})',{atob});
const kernel=await init();kernel.setup();
const area=p=>(p[1][0]-p[0][0])*(p[2][1]-p[0][1])-(p[1][1]-p[0][1])*(p[2][0]-p[0][0]);
let minRetained=1,maxParts=0,total=0;
for(const product of ['ring','necklace'])for(const mirror of [false,true])for(let bits=0;bits<64;bits++){
  let settings=constrain({...fixture.defaults,product,mirror,arrange:mirror?'alternating':'even',
    bloom:bits&1?10:-10,twist:bits&2?4:-4,depth:bits&4?120:90,curve:bits&8?25:5,
    band:bits&16?7:5,boreDiameter:bits&32?23:16,necklaceLength:bits&32?48:38},fixture.defaults);
  const counts=countRange(settings);
  settings=constrain({...settings,count:bits%2?counts[0]:counts[1]},fixture.defaults);
  const stock=fixture.make(settings),src=fixture.sourceMesh,vcount=src.positions.length/3;
  let flips=0;
  for(const k of [0,1,Math.floor(settings.count/2),settings.count-1])for(let j=0;j<src.indices.length;j+=3){
    const vs=Array.from(src.indices.slice(j,j+3));
    const a=vs.map(i=>[src.positions[i*3],src.positions[i*3+1]]);
    const b=vs.map(i=>{
      const at=(k*vcount+i)*3,x=stock.positions[at],y=stock.positions[at+1],z=stock.positions[at+2];
      const angle=Math.atan2(x,z)-2*Math.PI*k/settings.count;
      return [product==='ring'?Math.atan2(Math.sin(angle),Math.cos(angle))*stock.R:x,y];
    });
    const orientation=mirror&&k%2?-1:1;
    if(Math.abs(area(a))>1e-7&&area(a)*area(b)*orientation<-1e-10)flips++;
  }
  assert.equal(flips,0,JSON.stringify(settings));
  const mesh=product==='ring'?cutRing(kernel,stock,src,settings,fixture.smoothNormals):stock;
  assert(mesh.indices.length>0);
  for(const v of mesh.positions)assert(Number.isFinite(v));
  for(let i=0;i<mesh.normals.length;i+=3){
    const length=Math.hypot(mesh.normals[i],mesh.normals[i+1],mesh.normals[i+2]);
    assert(Number.isFinite(length)&&length>.99&&length<1.01,'invalid surface normal');
  }
  if(product==='ring'){
    assert(!mesh.fragmented,JSON.stringify(settings));
    assert(mesh.retained>=.55,JSON.stringify(settings));
    minRetained=Math.min(minRetained,mesh.retained);
    const input=new kernel.Mesh({numProp:3,vertProperties:mesh.positions,triVerts:mesh.indices});input.merge();
    const solid=new kernel.Manifold(input);
    assert.equal(solid.status(),'NoError');
    const parts=solid.decompose();maxParts=Math.max(maxParts,parts.length/settings.count);
    for(const p of parts)p.delete();
    assert(solid.volume()>0);solid.delete();
  }
  total++;
}
console.log(`${total} boundary combinations: no projected face inversions; valid normals; ring cuts retain at least ${(minRetained*100).toFixed(1)}% volume; at most ${maxParts} original shells per motif`);
