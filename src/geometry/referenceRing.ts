import {Box3,Mesh,Vector3,type BufferGeometry,type Object3D} from 'three';
export type ReferencePart={name:string;kind:'metal'|'gem';geometry:BufferGeometry};
export function prepareReferenceRing(scene:Object3D,groundY:number){
  const parts:ReferencePart[]=[],bounds=new Box3();
  scene.updateWorldMatrix(true,true);
  try{
    scene.traverse(object=>{
      if(!(object instanceof Mesh))return;
      const isGem=object.name==='Brillant_1';
      const geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);
      parts.push({name:object.name,kind:isGem?'gem':'metal',geometry});
      const position=geometry.getAttribute('position');
      if(!position||!position.count)throw new Error('Empty reference geometry');
      for(let i=0;i<position.count;i++){
        if(![position.getX(i),position.getY(i),position.getZ(i)].every(Number.isFinite))
          throw new Error('Invalid reference positions');
      }
      geometry.computeBoundingBox();bounds.union(geometry.boundingBox!);
    });
    if(!parts.some(p=>p.kind==='gem'))throw new Error('Missing reference gemstone');
    if(!parts.some(p=>p.kind==='metal')||bounds.isEmpty())throw new Error('Missing reference metal');
    const centre=bounds.getCenter(new Vector3());
    const offset=new Vector3(-centre.x,groundY+0.008-bounds.min.y,-centre.z);
    for(const part of parts){part.geometry.translate(offset.x,offset.y,offset.z);part.geometry.computeBoundingBox();}
    bounds.translate(offset);
  }catch(error){parts.forEach(p=>p.geometry.dispose());throw error;}
  let disposed=false;
  return {parts,bounds,dispose(){if(disposed)return;disposed=true;parts.forEach(p=>p.geometry.dispose());}};
}
