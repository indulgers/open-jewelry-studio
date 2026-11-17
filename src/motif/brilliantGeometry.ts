import {BufferGeometry,Color,Float32BufferAttribute} from 'three';

type P=[number,number,number];
const circle=(n:number,r:number,z:number):P[]=>Array.from({length:n},(_,i)=>{
  const a=i*Math.PI*2/n;return [Math.cos(a)*r,Math.sin(a)*r,z];
});

/**
 * Closed 16-fold brilliant-inspired faceted mesh. The small stone is not an
 * optical or gemological specification; geometry is used for visual previews.
 */
export function createSmallBrilliantGeometry(segments=16){
  if(!Number.isInteger(segments)||segments<8||segments>64)throw new RangeError('8..64');
  const table=circle(segments,.54,1.34);
  const star=circle(segments,.76,1.105);
  const girdleTop=circle(segments,1,.79);
  const girdleBottom=circle(segments,1,.65);
  const pavilion=circle(segments,.58,.35);
  const culet:P=[0,0,.045];
  const cap:P=[0,0,1.34];
  const points:number[]=[],colors:number[]=[];
  const tones=['#f9feff','#7f9fb8','#d8eaf5','#ffffff','#a4c3db','#e8f5ff'];
  const palette=tones.map(t=>new Color(t));
  const tri=(a:P,b:P,c:P,tone:number)=>{
    points.push(...a,...b,...c);
    const col=palette[Math.abs(tone)%palette.length];
    for(let j=0;j<3;j++)colors.push(col.r,col.g,col.b);
  };
  for(let i=0;i<segments;i++){
    const j=(i+1)%segments;
    tri(cap,table[i],table[j],i+2);
    tri(table[i],star[i],star[j],i+1);
    tri(table[i],star[j],table[j],i+4);
    tri(star[i],girdleTop[i],girdleTop[j],i+2);
    tri(star[i],girdleTop[j],star[j],i);
    tri(girdleTop[i],girdleBottom[i],girdleBottom[j],i+3);
    tri(girdleTop[i],girdleBottom[j],girdleTop[j],i+3);
    tri(girdleBottom[i],pavilion[i],pavilion[j],i+1);
    tri(girdleBottom[i],pavilion[j],girdleBottom[j],i+2);
    tri(pavilion[i],culet,pavilion[j],i+4);
  }
  const geo=new BufferGeometry();
  geo.setAttribute('position',new Float32BufferAttribute(points,3));
  geo.setAttribute('color',new Float32BufferAttribute(colors,3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Surface-only manifold diagnostic: every quantized undirected edge should
 * be incident to exactly two triangles. This does NOT detect intersections
 * or substitute for watertight CAD/manufacturing validation.
 */
export function triangleEdgeCounts(geometry:BufferGeometry,tolerance=1e-5){
  const a=geometry.getAttribute('position');
  const indices=geometry.getIndex();
  const edgeCounts=new Map<string,number>();
  const key=(i:number)=>[a.getX(i),a.getY(i),a.getZ(i)]
    .map(v=>Math.round(v/tolerance)).join(',');
  const total=indices?indices.count:a.count;
  for(let i=0;i<total;i+=3){
    const vertices=[0,1,2].map(j=>key(indices?indices.getX(i+j):i+j));
    for(let e=0;e<3;e++){
      const u=vertices[e],v=vertices[(e+1)%3];
      const edge=u<v?u+'|'+v:v+'|'+u;
      edgeCounts.set(edge,(edgeCounts.get(edge)??0)+1);
    }
  }
  const counts=[...edgeCounts.values()];
  return {edges:counts.length,boundaryEdges:counts.filter(n=>n===1).length,
    nonManifoldEdges:counts.filter(n=>n!==2).length};
}
