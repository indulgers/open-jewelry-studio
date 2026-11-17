import {BufferGeometry,Float32BufferAttribute,DoubleSide,Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import type {Part} from '../reference/model';
// A visual ink/depth cue projected onto the real inner metal surface; no production mesh is modified.
export function engravingSurface(parts:Part[]){
  const material=new MeshBasicMaterial({side:DoubleSide});
  const meshes=parts.map(part=>{const mesh=new Mesh(part.geometry,material);mesh.position.y=part.offsetY??0;mesh.updateMatrixWorld();return mesh;});
  const ray=new Raycaster(),positions:number[]=[],uvs:number[]=[],indices:number[]=[];
  const columns=32,rows=8;
  for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++){
    const u=x/columns,v=y/rows,angle=(u-.5)*.9,z=(v-.5)*.065;
    const direction=new Vector3(Math.sin(angle),-Math.cos(angle),0);
    ray.set(new Vector3(0,0,z),direction);
    const hit=ray.intersectObjects(meshes,false)[0];
    if(!hit||hit.distance<.4||hit.distance>1.3){material.dispose();return null;}
    const point=hit.point.clone().addScaledVector(direction,-.001);
    positions.push(point.x,point.y,point.z);uvs.push(u,v);
    if(x<columns&&y<rows){const a=y*(columns+1)+x,b=a+1,c=a+columns+1,d=c+1;indices.push(a,b,c,b,d,c);}
  }
  material.dispose();
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
