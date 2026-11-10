import {
 BufferGeometry, Float32BufferAttribute, Vector3, Shape, Path, ExtrudeGeometry,
 TorusGeometry, SphereGeometry, CylinderGeometry, CatmullRomCurve3, TubeGeometry
} from 'three';
import {bandRadius,buildStoneLayout,constrainDesign,petalSample,type Design,type Site} from './recipe';

export type GeometryPart={name:string;geometry:BufferGeometry;kind:'metal'|'seat'};
export type Assembly={parts:GeometryPart[];dispose:()=>void};

function meshFromFaces(vertices:number[],indices:number[]):BufferGeometry{
 const g=new BufferGeometry();
 g.setAttribute('position',new Float32BufferAttribute(vertices,3));
 g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();
 return g;
}
export function ringDimensions(input:Design,theta:number){
 const d=constrainDesign(input);
 const top=Math.max(0,Math.sin(theta));
 const shoulder=Math.pow(top,4.5),taper=d.parameters.taper;
 const baseWidth=d.structure==='slim'?.20:d.structure==='wide'?.38:d.structure==='signet'?.37:d.structure==='open'?.23:.28;
 const width=(baseWidth+(d.structure==='signet'?.18:d.structure==='wide'?.07:0)*shoulder)*taper;
 const thick=(d.structure==='signet'?.175:.135)+(d.structure==='wide'?.035:0)+d.parameters.blend*.025*shoulder;
 return {width,thick};
}
/** Outer ring radial surface at a stone centre, not a fixed height for all rows. */
export function ringOuterY(d:Design,x:number,z:number){
 const r=bandRadius(d),angle=Math.acos(Math.max(-1,Math.min(1,x/r)));
 const {width,thick}=ringDimensions(d,angle);
 const transverse=Math.min(.999,Math.abs(z)/(width/2));
 return Math.sqrt(Math.max(0,r*r-x*x))+thick*Math.sqrt(1-transverse*transverse);
}
/** Explicit rendering apertures are cut from the OUTER shoulder surface.
 * Ring's inner face remains intact. This is a visual socket opening, not a
 * certified Boolean subtraction or manufacturing wall-thickness calculation.
 */
export function bandGeometry(input:Design,sites:Site[]=[]):BufferGeometry{
 const d=constrainDesign(input),r=bandRadius(d),verts:number[]=[],indices:number[]=[];
 const segments=384,profile=72,holes=sites.filter(s=>s.zone==='shoulder'&&s.kind==='accent');
 function at(theta:number,a:number){
   const {width,thick}=ringDimensions(d,theta);
   const radial=r+thick*Math.cos(a),z=(width/2)*Math.sin(a);
   return [Math.cos(theta)*radial,Math.sin(theta)*radial,z] as const;
 }
 for(let i=0;i<=segments;i++){
   const theta=i/segments*2*Math.PI;
   for(let j=0;j<profile;j++)verts.push(...at(theta,j/profile*2*Math.PI));
 }
 function underAperture(theta:number,a:number){
   if(Math.sin(theta)<.1||Math.cos(a)<.13)return false;
   const [x,y,z]=at(theta,a);
   return holes.some(s=>{
     const rOpen=s.diameter*.43;
     return Math.hypot(x-s.x,z-s.z)<rOpen&&Math.abs(y-s.y)<s.diameter*.55;
   });
 }
 for(let i=0;i<segments;i++)for(let j=0;j<profile;j++){
   const a=i*profile+j,b=i*profile+(j+1)%profile,c=b+profile,f=a+profile;
   const theta=(i+.5)/segments*Math.PI*2,ang=(j+.5)/profile*Math.PI*2;
   if(underAperture(theta,ang))continue;
   indices.push(a,f,b,b,f,c);
 }
 return meshFromFaces(verts,indices);
}
/** Sculptural petal with true THREE.js Shape.holes around every permitted
 * pavé site. The cutout is swept onto the actual curved flower surface,
 * so the pavilion no longer disappears behind a continuous metal sheet.
 */
export function petalGeometry(d:Design,leaf:number,sites:Site[]=[]):BufferGeometry{
 const start=.035,end=.965,N=48;
 const shape=new Shape();
 const bound=(t:number)=>petalSample(d,leaf,t,0).width;
 shape.moveTo(start,-bound(start));
 for(let i=1;i<=N;i++){const t=start+(end-start)*i/N;shape.lineTo(t,-bound(t));}
 for(let i=N;i>=0;i--){const t=start+(end-start)*i/N;shape.lineTo(t,bound(t));}
 shape.closePath();
 const slope=.56*d.parameters.emphasis*d.parameters.bend;
 for(const site of sites){
   if(site.zone!=='petal'||site.leaf!==leaf||site.t===undefined||site.u===undefined)continue;
   const t=site.t;
   const lateral=site.u*bound(t),r=site.diameter*.42;
   const rx=r/slope,ry=r;
   if(t-rx<start+.01||t+rx>end-.01||Math.abs(lateral)+ry>=bound(t)*.97)continue;
   const cut=new Path();
   cut.absellipse(t,lateral,rx,ry,0,Math.PI*2,true);
   shape.holes.push(cut);
 }
 const g=new ExtrudeGeometry(shape,{depth:.080*d.parameters.taper,bevelEnabled:false,curveSegments:16,steps:1});
 const p=g.getAttribute('position');
 for(let i=0;i<p.count;i++){
   const t=Math.min(.997,Math.max(.003,p.getX(i))),transverse=p.getY(i),depth=p.getZ(i);
   const width=Math.max(.002,bound(t));
   const u=Math.max(-1.15,Math.min(1.15,transverse/width));
   const sample=petalSample(d,leaf,t,u);
   p.setXYZ(i,sample.x,sample.y-depth,sample.z);
 }
 p.needsUpdate=true;
 g.computeVertexNormals();g.computeBoundingSphere();
 return g;
}
export function petalOutline(d:Design,leaf:number):Vector3[]{
 const points:Vector3[]=[];
 for(let i=0;i<=32;i++){const p=petalSample(d,leaf,.035+.93*i/32,-.94);points.push(new Vector3(p.x,p.y,p.z));}
 for(let i=32;i>=0;i--){const p=petalSample(d,leaf,.035+.93*i/32,.94);points.push(new Vector3(p.x,p.y,p.z));}
 return points;
}
export function tubeGeometry(points:Vector3[],radius:number):BufferGeometry{
 return new TubeGeometry(new CatmullRomCurve3(points),Math.max(18,points.length*9),radius,10,false);
}
export function createAssembly(input:Design):Assembly{
 const d=constrainDesign(input),sites=buildStoneLayout(d);
 const parts:GeometryPart[]=[{name:'continuous-shank',geometry:bandGeometry(d,sites),kind:'metal'}];
 const r=bandRadius(d);
 if(d.grammar==='floral'){
   for(let i=0;i<d.parameters.repeat;i++){
     parts.push({name:'perforated-petal-'+i,geometry:petalGeometry(d,i,sites),kind:'metal'});
     // A 3D petal is supported by a shaped shoulder-to-petal strut, not a
     // separate floating decal. Both endpoints overlap adjacent metal parts.
     const tip=petalSample(d,i,.64,0);
     const x=Math.max(-r*.68,Math.min(r*.68,tip.x));
     const z=Math.max(-.11,Math.min(.11,tip.z));
     const y=ringOuterY(d,x,z);
     parts.push({name:'petal-to-shank-'+i,geometry:tubeGeometry([
        new Vector3(x,y-.035,z),
        new Vector3((x+tip.x)/2,(y+tip.y)/2-.015,(z+tip.z)/2),
        new Vector3(tip.x,tip.y-.075,tip.z)
       ],.032*d.parameters.taper),kind:'metal'});
   }
 }else if(d.grammar==='architectural'){
   for(const side of [-1,1])for(let k=0;k<2;k++){
     const x=side*(.22+k*.13);
     parts.push({name:'architectural-bridge-'+side+'-'+k,geometry:tubeGeometry([
       new Vector3(x,ringOuterY(d,x,-.13)-.02,-.13),
       new Vector3(x*.98,ringOuterY(d,x,0)+.05,0),
       new Vector3(x,ringOuterY(d,x,.13)-.02,.13)
     ],.028*d.parameters.taper),kind:'metal'});
   }
 }else{
   const count=d.grammar==='rhythm'?Math.max(6,d.parameters.repeat*2):d.parameters.repeat;
   for(let i=0;i<count;i++){
     const theta=2*Math.PI*i/count;
     const rx=Math.cos(theta)*r,ry=Math.sin(theta)*r;
     parts.push({name:'module-'+i,geometry:tubeGeometry([
       new Vector3(rx*.92,ry*.92,-.14*d.parameters.emphasis),
       new Vector3(rx*1.07,ry*1.07,0),
       new Vector3(rx*.92,ry*.92,.14*d.parameters.emphasis)
     ],.020*d.parameters.taper),kind:'metal'});
   }
 }
 // Continuous channel rails along each edge; each stone is seated between
 // the two rails. A row of isolated bezel rings is NOT channel setting.
 if(d.setting==='line'){
   const halfTrack=d.accentDiameter*.05+.008;
   for(const side of [-1,1])for(const edge of [-1,1]){
     const path:Vector3[]=[];
     const start=d.mainDiameter*.05+d.accentDiameter*.05+d.gapMm*.1+.035;
     for(let i=0;i<=28;i++){
       const x=side*(start+(r*.77-start)*i/28),z=edge*halfTrack;
       path.push(new Vector3(x,ringOuterY(d,x,z)+.012,z));
     }
     parts.push({name:'continuous-channel-rail-'+side+'-'+edge,geometry:tubeGeometry(path,.017),kind:'metal'});
   }
 }
 // Four low sweeping gallery supports connect the centre setting to the
 // band. Their upper ends enter the lower basket; never end in empty space.
 const main=sites.find(s=>s.kind==='main');
 if(main){
   const rad=main.diameter/2;
   for(const side of [-1,1])for(const depth of [-1,1]){
     const x=side*.17,z=depth*.075,outer=ringOuterY(d,x,z);
     parts.push({name:'integrated-gallery-shoulder-'+side+'-'+depth,geometry:tubeGeometry([
       new Vector3(x,outer-.04,z),
       new Vector3(x*.85,outer+.07,z*.70),
       new Vector3(side*rad*.52,main.y-rad*.30,depth*rad*.48)
     ],.024*d.parameters.taper),kind:'metal'});
   }
 }
 return {parts,dispose:()=>parts.forEach(p=>p.geometry.dispose())};
}
/** Each mounting local origin is the GEM GIRDLE. Stone geometry is aligned to
 * that plane. Under-gallery metal lies below, tip/lip above the girdle.
 */
export function metalSetting(_d:Design,site:Site):GeometryPart[]{
 const rad=site.diameter/2,parts:GeometryPart[]=[];
 const torus=(name:string,r:number,t:number,y:number)=>{
   const g=new TorusGeometry(r,t,10,40);g.rotateX(Math.PI/2);g.translate(0,y,0);
   parts.push({name,geometry:g,kind:'seat'});
 };
 // Seat is only visible at the girdle edge; it does NOT fill the pavilion.
 if(site.mount!=='channel')torus('girdle-seat',rad*.905,Math.max(.004,rad*.068),-rad*.11);
 torus('under-gallery',rad*.69,Math.max(.005,rad*.065),-rad*.30);
 if(site.mount==='bezel'){
   const wallHeight=rad*.23;
   const wall=new CylinderGeometry(rad*1.045,rad*1.03,wallHeight,48,1,true);
   wall.translate(0,-rad*.035,0);
   parts.push({name:'bezel-wall',geometry:wall,kind:'seat'});
   torus('bezel-lip',rad*1.006,Math.max(.006,rad*.07),rad*.12);
 }else if(site.mount==='prong'){
   for(let j=0;j<4;j++){
     const phi=j*Math.PI/2+Math.PI/4;
     const v=(r:number,y:number)=>new Vector3(Math.cos(phi)*r,y,Math.sin(phi)*r);
     parts.push({name:'formed-prong-'+j,
       geometry:tubeGeometry([v(rad*.77,-rad*.30),v(rad*1.03,-rad*.04),v(rad*1.008,rad*.070),v(rad*.94,rad*.155)],Math.max(.006,rad*.074)),kind:'seat'});
     const cap=v(rad*.94,rad*.155);
     const head=new SphereGeometry(Math.max(.006,rad*.076),10,8);head.translate(cap.x,cap.y,cap.z);
     parts.push({name:'burnished-prong-tip-'+j,geometry:head,kind:'seat'});
   }
 }else if(site.mount==='bead'){
   for(let j=0;j<4;j++){
     const phi=j*Math.PI/2+Math.PI/4;
     const radius=rad*.955;
     const bead=new SphereGeometry(Math.max(.004,rad*.07),9,7);
     bead.translate(Math.cos(phi)*radius,rad*.068,Math.sin(phi)*radius);
     parts.push({name:'micro-bead-'+j,geometry:bead,kind:'seat'});
   }
 }
 return parts;
}
export function siteRotation(site:Site){return new Vector3(0,0,-site.tilt);}
