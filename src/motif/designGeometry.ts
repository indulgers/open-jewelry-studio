import {BufferGeometry,Float32BufferAttribute,Vector3} from 'three';
import {distanceToOutline,inSilhouette,type MotifId} from './designGrammar';
import profiles from './profiles.json';

export type RayStroke={start:readonly [number,number,number];end:readonly [number,number,number];width:number};
/** Ray termination follows the uploaded silhouette; strokes never knowingly cross its edge. */
export function buildRadialEngraving(motif:MotifId,count=90):RayStroke[]{
  const poly=profiles[motif].outline;
  if(!Number.isInteger(count)||count<16||count>280)throw new RangeError('engraving count 16–280');
  const paths:RayStroke[]=[];
  for(let i=0;i<count;i++){
    const angle=2*Math.PI*(i+.5)/count,dx=Math.cos(angle),dy=Math.sin(angle);
    let low=.8,high=9;
    for(let n=0;n<20;n++){
      const test=(low+high)/2;
      if(inSilhouette(test*dx,test*dy,poly))low=test;else high=test;
    }
    // The outermost rays retract from the metal edge to preserve a clean border.
    const outer=Math.max(1.8,low-.68);
    if(outer<=1.6||distanceToOutline(outer*dx,outer*dy,poly)<.20)continue;
    const z=.76;
    paths.push({start:[dx*1.05,dy*1.05,z],end:[dx*outer,dy*outer,z],
      width:i%5===0?.043:.023});
  }
  return paths;
}

/** Closed sculpted petal mesh — 5 independent solids, not a flat decal. */
export function createPetalSolid(angle:number,length=6.4,width=2.4):BufferGeometry{
  const radial=22,lateral=10;
  const verts:number[]=[],tri:number[]=[];
  const sample=(t:number,u:number,back:boolean)=>{
    const envelope=.08+.92*Math.pow(Math.sin(Math.PI*t),.72);
    const x=u*width*envelope;
    const y=.4+t*length;
    const crown=.24+.58*Math.sin(Math.PI*t)*(1-u*u)+.11*Math.sin(Math.PI*t*2);
    const z=(back?-.16:crown)+.14;
    const c=Math.cos(angle),s=Math.sin(angle);
    return [x*c-y*s,x*s+y*c,z];
  };
  const stride=lateral+1;
  for(let layer=0;layer<2;layer++)for(let i=0;i<=radial;i++){
    const t=i/radial;
    for(let j=0;j<=lateral;j++)verts.push(...sample(t,2*j/lateral-1,layer===1));
  }
  const offset=(radial+1)*stride;
  for(let i=0;i<radial;i++)for(let j=0;j<lateral;j++){
    const a=i*stride+j,b=(i+1)*stride+j,c=(i+1)*stride+j+1,d=i*stride+j+1;
    tri.push(a,b,c,a,c,d);
    tri.push(offset+a,offset+c,offset+b,offset+a,offset+d,offset+c);
  }
  const edge=(front:number,back:number)=>{ /* four perimeter walls each share vertices */ };
  void edge;
  // Side walls along the two long rims.
  for(let i=0;i<radial;i++)for(const j of [0,lateral]){
    const a=i*stride+j,b=(i+1)*stride+j;
    const c=offset+b,d=offset+a;
    if(j===0)tri.push(a,c,b,a,d,c);else tri.push(a,b,c,a,c,d);
  }
  // End caps across the two short rims.
  for(let j=0;j<lateral;j++)for(const i of [0,radial]){
    const a=i*stride+j,b=i*stride+j+1,c=offset+b,d=offset+a;
    if(i===0)tri.push(a,b,c,a,c,d);else tri.push(a,c,b,a,d,c);
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(verts,3));
  geometry.setIndex(tri);
  geometry.computeVertexNormals();
  return geometry;
}

export function suggestSettingSize(motif:MotifId,style:'pave'|'cluster'){
  const poly=profiles[motif].outline;
  const bounds=poly.reduce((b,p)=>({
    minX:Math.min(b.minX,p[0]),maxX:Math.max(b.maxX,p[0]),
    minY:Math.min(b.minY,p[1]),maxY:Math.max(b.maxY,p[1]),
  }),{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity});
  const safeWidth=Math.min(bounds.maxX-bounds.minX,bounds.maxY-bounds.minY);
  return {proposal:'VISUAL_ONLY',minimumLocalWidth:safeWidth,style,
    maxSuggestedStoneDiameter:style==='cluster'?Math.min(2.2,safeWidth*.24):Math.min(.95,safeWidth*.1)};
}
