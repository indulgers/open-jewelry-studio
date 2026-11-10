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
 const segments=384,profile=72;
 function at(theta:number,a:number){
   const {width,thick}=ringDimensions(d,theta);
   const radial=r+thick*Math.cos(a),z=(width/2)*Math.sin(a);
   return [Math.cos(theta)*radial,Math.sin(theta)*radial,z] as const;
 }
 for(let i=0;i<segments;i++){
   const theta=i/segments*2*Math.PI;
   for(let j=0;j<profile;j++)verts.push(...at(theta,j/profile*2*Math.PI));
 }
 for(let i=0;i<segments;i++)for(let j=0;j<profile;j++){
   const a=i*profile+j,b=i*profile+(j+1)%profile,c=((i+1)%segments)*profile+(j+1)%profile,f=((i+1)%segments)*profile+j;
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
 // A pierced, **closed** metal sheet. The sidewalls around each opening are
 // necessary for manifold Boolean operations; disconnected front/back faces
 // only create the appearance of a solid and hide interpenetrations.
 const depth=.060*d.parameters.taper;
 const g=new ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:18,steps:1});
 const positions=g.getAttribute('position');
 for(let i=0;i<positions.count;i++){
   const t=Math.min(.997,Math.max(.003,positions.getX(i)));
   const transverse=positions.getY(i),inside=positions.getZ(i);
   const width=Math.max(.002,bound(t));
   const u=Math.max(-1.15,Math.min(1.15,transverse/width));
   const sample=petalSample(d,leaf,t,u);
   positions.setXYZ(i,sample.x,sample.y-inside,sample.z);
 }
 positions.needsUpdate=true;
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
 const curve=new CatmullRomCurve3(points);
 const tubular=Math.max(18,points.length*9),radial=10;
 const g=new TubeGeometry(curve,tubular,radius,radial,false);
 const vertices=Array.from(g.getAttribute('position').array as ArrayLike<number>);
 const indices=Array.from(g.getIndex()!.array as ArrayLike<number>);
 const start=vertices.length/3,head=curve.getPoint(0),tail=curve.getPoint(1);
 vertices.push(head.x,head.y,head.z,tail.x,tail.y,tail.z);
 for(let j=0;j<radial;j++){
   // TubeGeometry uses radialSegments+1, with duplicated seam vertices.
   indices.push(start,j+1,j);
   const b=tubular*(radial+1);
   indices.push(start+1,b+j,b+j+1);
 }
 g.setAttribute('position',new Float32BufferAttribute(vertices,3));
 g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();
 return g;
}
export function createAssembly(input:Design):Assembly{
 const d=constrainDesign(input),sites=buildStoneLayout(d);
 const parts:GeometryPart[]=[{name:'continuous-shank',geometry:bandGeometry(d,sites),kind:'metal'}];
 const r=bandRadius(d);
 if(d.grammar==='floral'){
   for(let i=0;i<d.parameters.repeat;i++){
     parts.push({name:'perforated-petal-'+i,geometry:petalGeometry(d,i,sites),kind:'metal'});
     parts.push({name:'petal-edge-'+i,geometry:tubeGeometry(petalOutline(d,i),.009*d.parameters.taper),kind:'metal'});
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
export function metalSetting(d:Design,site:Site):GeometryPart[]{
 const rad=site.diameter/2,parts:GeometryPart[]=[];
 const torus=(name:string,r:number,t:number,y:number)=>{
   const g=new TorusGeometry(r,t,10,40);g.rotateX(Math.PI/2);g.translate(0,y,0);
   parts.push({name,geometry:g,kind:'seat'});
 };
 // Seat is only visible at the girdle edge; it does NOT fill the pavilion.
 // Tiny pavé stones share the perforated metal sheet, rather than carrying
 // dozens of overlapping independent basket rings. Channel stones share rails.
 const individualSeat=site.kind==='main'||site.mount==='bezel'||site.mount==='prong';
 if(individualSeat){
   torus('girdle-seat',rad*.905,Math.max(.004,rad*.068),-rad*.11);
   torus('under-gallery',rad*.69,Math.max(.005,rad*.065),-rad*.30);
 }
 if(site.mount==='bezel'){
   const wallHeight=rad*.23;
   const wall=new TorusGeometry(rad*1.035,Math.max(.006,rad*.085),10,48);
   wall.scale(1,1,wallHeight/(rad*.17));
   wall.rotateX(Math.PI/2);
   wall.translate(0,-rad*.035,0);
   parts.push({name:'bezel-wall',geometry:wall,kind:'seat'});
   torus('bezel-lip',rad*1.006,Math.max(.006,rad*.07),rad*.12);
 }else if(site.mount==='prong'){
   const prongs=site.kind==='main'?d.prongCount:4;
   for(let j=0;j<prongs;j++){
     const phi=j*Math.PI*2/prongs+Math.PI/prongs;
     const v=(r:number,y:number)=>new Vector3(Math.cos(phi)*r,y,Math.sin(phi)*r);
     parts.push({name:'formed-prong-'+j,
       geometry:tubeGeometry([v(rad*.77,-rad*.30),v(rad*1.03,-rad*.04),v(rad*1.008,rad*.070),v(rad*.94,rad*.155)],Math.max(.006,rad*.074)),kind:'seat'});
     const cap=v(rad*.94,rad*.155);
     const head=new SphereGeometry(Math.max(.006,rad*.076),10,8);head.translate(cap.x,cap.y,cap.z);
     parts.push({name:'burnished-prong-tip-'+j,geometry:head,kind:'seat'});
   }
 }else if(site.mount==='bead'){
   // Continuous, ultra-low-profile rim of the *same* gold sheet, not a
   // separate multi-level basket under each micro stone. This tiny annular
   // interface makes all bead tips part of a single connected metal solid,
   // including the bead nearest the petal edge.
   const lip=new TorusGeometry(rad*1.06,Math.max(.0035,rad*.08),8,32);
   lip.rotateX(Math.PI/2);
   lip.translate(0,d.seatDepthMm*.1,0);
   parts.push({name:'pave-shared-sheet-lip',geometry:lip,kind:'seat'});
   for(let j=0;j<4;j++){
     const phi=j*Math.PI/2+Math.PI/4;
     const radius=rad*.96;
     const beadRadius=Math.max(.007,rad*.20);
     const bead=new SphereGeometry(beadRadius,10,8);
     bead.translate(Math.cos(phi)*radius,d.seatDepthMm*.1+.001,Math.sin(phi)*radius);
     parts.push({name:'micro-bead-'+j,geometry:bead,kind:'seat'});
   }
 }
 return parts;
}
export function siteRotation(site:Site){return new Vector3(0,0,-site.tilt);}
