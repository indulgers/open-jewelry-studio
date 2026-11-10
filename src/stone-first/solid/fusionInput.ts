import {
 BufferGeometry,Float32BufferAttribute,Shape,ExtrudeGeometry,Vector3,
 CatmullRomCurve3,TubeGeometry,CylinderGeometry,Matrix4,Quaternion,Euler
} from 'three';
import {bandRadius,buildStoneLayout,constrainDesign,petalSample,type Design,type Site} from './recipe';
import {bandGeometry,ringOuterY,metalSetting} from './geometry';

export type FusionPart={name:string;geometry:BufferGeometry};
export type FusionGeometry={parts:FusionPart[];cutters:FusionPart[];stones:Site[];dispose:()=>void};
function polygon(input:Design,leaf:number){
 const shape=new Shape(),start=.035,end=.965,N=48;
 const bound=(t:number)=>petalSample(input,leaf,t,0).width;
 shape.moveTo(start,-bound(start));
 for(let i=1;i<=N;i++){const t=start+(end-start)*i/N;shape.lineTo(t,-bound(t));}
 for(let i=N;i>=0;i--){const t=start+(end-start)*i/N;shape.lineTo(t,bound(t));}
 shape.closePath();
 return shape;
}
/** Real, capped flower solid. The tip/base is recessed into the gold shank;
 * Booleans later remove the internal seams instead of showing support rods. */
export function solidPetalGeometry(d:Design,leaf:number){
 const depth=.065*d.parameters.taper;
 const g=new ExtrudeGeometry(polygon(d,leaf),{depth,steps:1,bevelEnabled:false,curveSegments:12});
 const p=g.getAttribute('position');
 for(let i=0;i<p.count;i++){
  const t=Math.min(.997,Math.max(.003,p.getX(i)));
  const transverse=p.getY(i),z=p.getZ(i);
  const width=Math.max(.002,petalSample(d,leaf,t,0).width);
  const u=Math.min(1.10,Math.max(-1.10,transverse/width));
  const point=petalSample(d,leaf,t,u);
  // Lower root into ring stock to create real overlap without any loose brace.
  const overlap=.105*Math.pow(1-t,2);
  p.setXYZ(i,point.x,point.y-overlap-z,point.z);
 }
 p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
 return g;
}
/** TubeGeometry is normally OPEN at both ends; cap it before Manifold union. */
export function cappedCurve(points:Vector3[],radius:number){
 const curve=new CatmullRomCurve3(points),segments=20,radial=12;
 const g=new TubeGeometry(curve,segments,radius,radial,false);
 const pos=g.getAttribute('position'),vertices=Array.from(pos.array),tri=Array.from(g.index!.array);
 const ring=(i:number)=>i*(radial+1);
 for(const [i,forward] of [[0,false],[segments,true]] as const){
  const p=curve.getPointAt(i/segments),tangent=curve.getTangentAt(i/segments);
  const center=vertices.length/3;vertices.push(p.x,p.y,p.z);
  for(let j=0;j<radial;j++){
   const a=ring(i)+j,b=a+1;
   const va=new Vector3().fromBufferAttribute(pos,a).sub(p);
   const vb=new Vector3().fromBufferAttribute(pos,b).sub(p);
   const sign=va.clone().cross(vb).dot(tangent);
   const required=forward?1:-1;
   if(sign*required>0)tri.push(center,a,b);else tri.push(center,b,a);
  }
 }
 g.setAttribute('position',new Float32BufferAttribute(vertices,3));
 g.setIndex(tri);g.computeVertexNormals();return g;
}
function cutterForSite(site:Site,main:boolean):BufferGeometry{
 const radius=site.diameter*(main?.43:.435),height=main?.32:site.zone==='petal'?.15:.12;
 const tool=new CylinderGeometry(radius,radius,height,28,1,false);
 const centerY=site.y-(main?.125:.025);
 const t=new Matrix4().makeTranslation(site.x,centerY,site.z);
 const rotation=new Matrix4().makeRotationZ(-site.tilt);
 tool.applyMatrix4(t.multiply(rotation));
 return tool;
}
export function createFusionInput(unbounded:Design):FusionGeometry{
 const d=constrainDesign(unbounded),sites=buildStoneLayout(d),parts:FusionPart[]=[],cutters:FusionPart[]=[];
 // NO triangle deletion or open 2-sided flower sheets in the fusion input.
 parts.push({name:'continuous-band',geometry:bandGeometry(d,[])});
 const main=sites.find(s=>s.kind==='main');
 if(d.grammar==='floral'){
  for(let leaf=0;leaf<d.parameters.repeat;leaf++){
   parts.push({name:'solid-petal-'+leaf,geometry:solidPetalGeometry(d,leaf)});
  }
 }else if(d.grammar==='architectural'){
  for(const sign of [-1,1])for(let k=0;k<2;k++){
   const x=sign*(.22+k*.13),y=ringOuterY(d,x,0);
   parts.push({name:'integrated-architectural-'+sign+'-'+k,
    geometry:cappedCurve([new Vector3(x,y-.10,-.13),new Vector3(x,y+.025,0),
       new Vector3(x,y-.10,.13)],.028*d.parameters.taper)});
  }
 }else{
  // Modules sink into the structural band rather than crossing it.
  const count=d.grammar==='rhythm'?Math.max(6,d.parameters.repeat*2):d.parameters.repeat;
  for(let i=0;i<count;i++){
   const theta=i*Math.PI*2/count,r=bandRadius(d),
    a=new Vector3(Math.cos(theta)*r,Math.sin(theta)*r,0);
   parts.push({name:'swept-module-'+i,geometry:cappedCurve([
     new Vector3(a.x*.91,a.y*.91,-.09),new Vector3(a.x*1.08,a.y*1.08,0),
     new Vector3(a.x*.91,a.y*.91,.09)],.019*d.parameters.taper)});
  }
 }
 if(d.setting==='line'){
  for(const sign of [-1,1])for(const edge of [-1,1]){
   const start=d.mainDiameter*.05+d.accentDiameter*.05+d.gapMm*.1+.035;
   const path:Vector3[]=[];const halfTrack=d.accentDiameter*.05+.008,r=bandRadius(d);
   for(let i=0;i<=28;i++){
    const x=sign*(start+(r*.77-start)*i/28),z=edge*halfTrack;
    path.push(new Vector3(x,ringOuterY(d,x,z)+.009,z));
   }
   parts.push({name:'channel-'+sign+'-'+edge,geometry:cappedCurve(path,.018)});
  }
 }
 for(const site of sites)cutters.push({name:'socket-'+site.id,geometry:cutterForSite(site,site.kind==='main')});
 if(main){
  const rad=main.diameter/2;
  // Only support members tied to the basket are allowed. Hidden portions
  // disappear after union; exposed rods ending above the petal are eliminated.
  for(const sign of [-1,1])for(const depth of [-1,1]){
   const x=sign*.17,z=depth*.065,y=ringOuterY(d,x,z);
   const endpoint=new Vector3(sign*rad*.49,main.y-rad*.30,depth*rad*.48);
   parts.push({name:'crown-to-band-'+sign+'-'+depth,
      geometry:cappedCurve([new Vector3(x,y-.045,z),
       new Vector3(sign*.16,y+.035,depth*.065),endpoint],.026*d.parameters.taper)});
  }
 }
 return {parts,cutters,stones:sites,dispose(){
  for(const o of [...parts,...cutters])o.geometry.dispose();
 }};
}
