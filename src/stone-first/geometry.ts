import {BufferGeometry,Float32BufferAttribute,Vector3} from 'three';
import {bandRadius,constrainDesign,petalSample,type Design,type Site} from './recipe';
export type GeometryPart={name:string;geometry:BufferGeometry;kind:'metal'|'seat'};
export type Assembly={parts:GeometryPart[];dispose:()=>void};

function meshFromFaces(vertices:number[],indices:number[],smooth=true):BufferGeometry{
 const g=new BufferGeometry();
 g.setAttribute('position',new Float32BufferAttribute(vertices,3));
 g.setIndex(indices);g.computeVertexNormals();
 return g;
}
/** Parametric comfort band with continuously changing thickness and shank width. */
export function bandGeometry(input:Design):BufferGeometry{
 const d=constrainDesign(input),r=bandRadius(d),verts:number[]=[],indices:number[]=[];
 const segments=192,profile=24,baseWidth=d.structure==='slim'?.20:d.structure==='wide'?.38:d.structure==='signet'?.37:d.structure==='open'?.23:.28;
 for(let i=0;i<=segments;i++){
  const t=i/segments,theta=2*Math.PI*t,top=Math.max(0,Math.sin(theta));
  const shoulder=Math.pow(top,4.5), taper=d.parameters.taper;
  const width=(baseWidth+(d.structure==='signet'?.18:d.structure==='wide'?.07:0)*shoulder)*taper;
  const thick=(d.structure==='signet'?.175:.135)+(d.structure==='wide'?.035:0)+d.parameters.blend*.025*shoulder;
  for(let j=0;j<profile;j++){
   const a=j/profile*Math.PI*2; // oval bevelled inner and outer ring cross section
   const radial=(r+thick*Math.cos(a));
   const z=(width/2)*Math.sin(a);
   verts.push(Math.cos(theta)*radial,Math.sin(theta)*radial,z);
  }
 }
 for(let i=0;i<segments;i++)for(let j=0;j<profile;j++){
  const a=i*profile+j,b=i*profile+(j+1)%profile,c=b+profile,f=a+profile;
  indices.push(a,f,b,b,f,c);
 }
 const g=meshFromFaces(verts,indices);g.computeBoundingSphere();return g;
}
export function petalGeometry(d:Design,leaf:number):BufferGeometry{
 const tSegments=22,uSegments=10,vert:number[]=[],tri:number[]=[],grid=(t:number,u:number,dy:number)=>{
  const p=petalSample(d,leaf,t,u);
  return [p.x,p.y+dy,p.z] as const;
 };
 const n=(tSegments+1)*(uSegments+1);
 for(let layer=0;layer<2;layer++)for(let i=0;i<=tSegments;i++)for(let j=0;j<=uSegments;j++){
  const t=0.06+0.90*i/tSegments, u=-1+2*j/uSegments;
  vert.push(...grid(t,u,layer===0?0:-.075*d.parameters.taper));
 }
 for(let layer=0;layer<2;layer++)for(let i=0;i<tSegments;i++)for(let j=0;j<uSegments;j++){
  const a=layer*n+i*(uSegments+1)+j,b=a+1,c=a+(uSegments+1),e=c+1;
  if(layer===0)tri.push(a,b,c,b,e,c);else tri.push(a,c,b,b,c,e);
 }
 for(let i=0;i<tSegments;i++)for(const edge of [0,uSegments]){
  const a=i*(uSegments+1)+edge,b=(i+1)*(uSegments+1)+edge;
  if(edge===0)tri.push(a,b,a+n,b,b+n,a+n);
  else tri.push(a,a+n,b,b,a+n,b+n);
 }
 for(let j=0;j<uSegments;j++)for(const edge of [0,tSegments]){
  const a=edge*(uSegments+1)+j,b=a+1;
  if(edge===0)tri.push(a,a+n,b,b,a+n,b+n);
  else tri.push(a,b,a+n,b,b+n,a+n);
 }
 return meshFromFaces(vert,tri);
}
export function petalOutline(d:Design,leaf:number):Vector3[]{
 const points:Vector3[]=[];
 for(let i=0;i<=22;i++){const p=petalSample(d,leaf,.06+.90*i/22,-.92);points.push(new Vector3(p.x,p.y+.008,p.z));}
 for(let i=22;i>=0;i--){const p=petalSample(d,leaf,.06+.90*i/22,.92);points.push(new Vector3(p.x,p.y+.008,p.z));}
 return points;
}
/** A leaf or structural member is always anchored into the metal shank, not a free decal. */
export function createAssembly(input:Design):Assembly{
 const d=constrainDesign(input),parts:GeometryPart[]=[{name:'continuous-shank',geometry:bandGeometry(d),kind:'metal'}];
 if(d.grammar==='floral'){
  for(let i=0;i<d.parameters.repeat;i++)parts.push({name:'petal-'+i,geometry:petalGeometry(d,i),kind:'metal'});
 } else if(d.grammar==='architectural'){
  // Geometric shoulders are integrated bridge rails, with center allowed for a large setting.
  for(const side of [-1,1])for(let k=0;k<2;k++){
   const x=side*(.22+k*.13),r=bandRadius(d);
   const p=[new Vector3(x,r+.09,-.24),new Vector3(x*.98,r+.13,0),new Vector3(x,r+.09,.24)];
   parts.push({name:'architectural-bridge-'+side+'-'+k,geometry:tubeGeometry(p,.027*d.parameters.taper),kind:'metal'});
  }
 }else{
  const count=d.grammar==='rhythm'?Math.max(6,d.parameters.repeat*2):d.parameters.repeat;
  for(let i=0;i<count;i++){
   const theta=2*Math.PI*i/count;
   const r=bandRadius(d)+.15;
   const x=Math.sin(theta)*r,y=Math.cos(theta)*r;
   parts.push({name:'module-'+i,geometry:tubeGeometry([
    new Vector3(x*.92,y*.92,-.17*d.parameters.emphasis),new Vector3(x,y,.02),new Vector3(x*.92,y*.92,.17*d.parameters.emphasis)
   ],.019*d.parameters.taper),kind:'metal'});
  }
 }
 // Channel-set stones require continuous *pair* rails, not a row of separate circular bezels.
 if(d.setting==='line'){
   const radius=bandRadius(d),halfTrack=d.accentDiameter*.05+.018;
   for(const side of [-1,1])for(const edge of [-1,1]){
     const samples:Vector3[]=[];
     const start=d.mainDiameter*.05+d.accentDiameter*.05+d.gapMm*.1+.04;
     for(let i=0;i<=18;i++){
       const x=side*(start+(radius*.79-start)*i/18);
       const y=Math.sqrt(Math.max(.16,radius*radius-x*x))+.16;
       samples.push(new Vector3(x,y,edge*halfTrack));
     }
     parts.push({name:'continuous-channel-rail-'+side+'-'+edge,geometry:tubeGeometry(samples,.018),kind:'metal'});
   }
 }
 // Connect the raised center setting into the shank. A visible gallery is not a floating decal.
 if(d.setting!=='none'){
   const r=bandRadius(d);
   for(const side of [-1,1]){
     parts.push({name:'center-basket-bridge-'+side,
       geometry:tubeGeometry([
         new Vector3(side*.18,r+.10,0),new Vector3(side*.12,r+.17,0),new Vector3(side*.14,r+.255,0)
       ],.024*d.parameters.taper),kind:'metal'});
   }
 }
 return {parts,dispose:()=>parts.forEach(p=>p.geometry.dispose())};
}
export function tubeGeometry(points:Vector3[],radius:number):BufferGeometry{
 // Parallel transported simple tube; TubeGeometry is designed for longer curves and gives rounded ends.
 const {CatmullRomCurve3,TubeGeometry}=requireThree();
 return new TubeGeometry(new CatmullRomCurve3(points),Math.max(12,points.length*8),radius,8,false);
}
function requireThree(){return {CatmullRomCurve3:ThreeCatmullRomCurve3,TubeGeometry:ThreeTubeGeometry};}
import {CatmullRomCurve3 as ThreeCatmullRomCurve3,TubeGeometry as ThreeTubeGeometry} from 'three';
/** Seat, under-gallery and distinct metal prongs for an individual setting. */
export function metalSetting(d:Design,site:Site):GeometryPart[]{
 const diameter=site.diameter,rad=diameter/2;
 const {TorusGeometry,SphereGeometry,CylinderGeometry}=requireSetting();
 const result:GeometryPart[]=[];
 const torus=(name:string,r:number,t:number,y:number)=> {
  const g=new TorusGeometry(r,t,8,32);
  g.rotateX(Math.PI/2);g.translate(0,y,0);result.push({name,geometry:g,kind:'seat'});
 };
 // The seat stays below the girdle. Main stone uses 4/6 claws or a continuous bezel.
 const bezel=site.mount==='bezel';
 torus('seat-ring',rad*(bezel?1.06:.91),Math.max(.004,rad*.075),-rad*.13);
 torus('under-gallery',rad*.68,Math.max(.005,rad*.065),-rad*.29);
 if(bezel)torus('bezel-lip',rad*1.02,Math.max(.008,rad*.11),rad*.08);
 else if(site.mount==='bead'){
  // Compact bead tips around the girdle, not four large floating claw columns.
  for(let j=0;j<4;j++){
   const phi=j*Math.PI/2+Math.PI/4,px=Math.cos(phi)*rad*.95,pz=Math.sin(phi)*rad*.95;
   const bead=new SphereGeometry(Math.max(.005,rad*.065),8,6);
   bead.translate(px,rad*.08,pz);result.push({name:'pave-bead-'+j,geometry:bead,kind:'seat'});
  }
 }else if(site.mount==='prong'){
  for(let j=0;j<4;j++){
   const phi=2*Math.PI*j/4+Math.PI/4;
   const px=Math.cos(phi)*rad*.97,pz=Math.sin(phi)*rad*.97;
   const g=new CylinderGeometry(rad*.092,rad*.105,rad*.43,8);
   g.translate(px,rad*.02,pz);result.push({name:'prong-'+j,geometry:g,kind:'seat'});
   const cap=new SphereGeometry(rad*.10,8,6);cap.translate(px,rad*.24,pz);
   result.push({name:'prong-tip-'+j,geometry:cap,kind:'seat'});
  }
 }
 // Channel setting receives long side rails from createAssembly, not one bezel per stone.
 return result;
}
function requireSetting(){return {TorusGeometry:ThreeTorusGeometry,SphereGeometry:ThreeSphereGeometry,CylinderGeometry:ThreeCylinderGeometry};}
import {TorusGeometry as ThreeTorusGeometry,SphereGeometry as ThreeSphereGeometry,CylinderGeometry as ThreeCylinderGeometry} from 'three';
export function siteRotation(site:Site){return new Vector3(0,0,-site.tilt);}
