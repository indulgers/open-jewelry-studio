// Visual editing envelope for the supplied four-petal module, not a manufacturing certificate.
export const limits={bloom:[-10,10,1],twist:[-4,4,.5],depth:[90,120,5],curve:[5,25,1],
  band:[5,7,.1],boreDiameter:[16,23,.1],necklaceLength:[38,48,1]};
export function countRange(s){
  // Arc length of the same parabolic necklace path used by createMotifs.
  const a=(49+(s.necklaceLength-42)*.82)/2,b=54;
  const length=s.product==='ring'?Math.PI*(s.boreDiameter+.5):Math.hypot(a,b)+a*a/b*Math.asinh(b/a);
  const coverage=s.product==='ring'?1.02:1;
  return [Math.max(8,Math.ceil(length*coverage/(s.band*1.15))),Math.min(18,Math.floor(length*coverage/(s.band*.78)))];
}
const finite=(v,d)=>typeof v==='number'&&Number.isFinite(v)?v:d;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function constrain(input,defaults,custom=false){
  const s={...defaults};
  for(const [key,values] of Object.entries({product:['ring','necklace'],arrange:['even','alternating'],material:['silver','gold','rose','graphite'],finish:['polished','satin']}))
    s[key]=values.includes(input[key])?input[key]:(defaults[key]||values[0]);
  s.name=typeof input.name==='string'?input.name.trim().slice(0,80)||defaults.name:defaults.name;
  s.mirror=input.mirror===true;
  for(const [key,[lo,hi,step]] of Object.entries(limits)){
    const fallback=key==='boreDiameter'?finite(input.diameter,defaults.diameter)+1.5:defaults[key];
    s[key]=Number((Math.round(clamp(finite(input[key],fallback),lo,hi)/step)*step).toFixed(3));
  }
  // Linked stock keeps the 0.25 mm stock allowance to the cylindrical bore.
  s.diameter=Number((s.boreDiameter-1.2).toFixed(3));
  s.coverage=s.product==='ring'?102:100;
  const [lo,hi]=countRange(s);s.count=clamp(Math.round(finite(input.count,defaults.count)),lo,hi);
  // Alternate modules must meet an identical neighbour at the closing seam.
  if((s.mirror||s.arrange==='alternating')&&s.count%2)s.count=s.count+1<=hi?s.count+1:s.count-1;
  // Arbitrary STL shapes have no measured deformation envelope.
  if(custom){s.bloom=0;s.twist=0;s.curve=0;s.depth=100;s.mirror=false;s.arrange='even';}
  return s;
}
export function validateSource(mesh){
  const p=mesh.positions,t=mesh.indices;
  if(!p?.length||p.length%3||!t?.length||t.length%3||t.length>150000||p.length>450000)throw Error('模组须包含完整三角面，且不超过 5 万面');
  for(const v of p)if(!Number.isFinite(v)||Math.abs(v)>1)throw Error('模组坐标无效，请重新导出 STL');
  for(const i of t)if(!Number.isInteger(i)||i<0||i>=p.length/3)throw Error('模组面索引无效');
  return mesh;
}
