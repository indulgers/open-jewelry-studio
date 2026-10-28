import {Box3,Mesh,Vector3,type BufferGeometry,type Object3D} from 'three';
import {GROUND_Y} from '../viewer/contactShadowResources';

function bounds(geometry:BufferGeometry){
  geometry.computeBoundingBox();const box=geometry.boundingBox!;
  if(box.isEmpty()||![...box.min.toArray(),...box.max.toArray()].every(Number.isFinite))throw new Error('Invalid gemstone dimensions');
  return box;
}
function planWidth(box:Box3){const size=box.getSize(new Vector3()),width=Math.max(size.x,size.z);if(width<=1e-8)throw new Error('Empty gemstone width');return width;}
function girdle(geometry:BufferGeometry,box:Box3){
  const center=box.getCenter(new Vector3()),p=geometry.getAttribute('position');let radius=0;
  for(let i=0;i<p.count;i++)radius=Math.max(radius,Math.hypot(p.getX(i)-center.x,p.getZ(i)-center.z));
  let total=0,count=0;
  for(let i=0;i<p.count;i++)if(Math.hypot(p.getX(i)-center.x,p.getZ(i)-center.z)>=radius*0.999){total+=p.getY(i);count++;}
  return count?total/count:center.y;
}
export function normalizeLooseGem(source:BufferGeometry){
  const box=bounds(source),center=box.getCenter(new Vector3()),scale=2/planWidth(box);
  const result=source.clone();result.translate(-center.x,-center.y,-center.z);result.scale(scale,scale,scale);result.computeBoundingBox();return result;
}
export function fitRoundGem(source:BufferGeometry,target:BufferGeometry){
  const sourceBox=bounds(source),targetBox=bounds(target),scale=planWidth(targetBox)/planWidth(sourceBox);
  const a=sourceBox.getCenter(new Vector3()),b=targetBox.getCenter(new Vector3());
  const sourceY=girdle(source,sourceBox),targetY=girdle(target,targetBox);
  const result=source.clone();result.translate(-a.x,-sourceY,-a.z);result.scale(scale,scale,scale);
  result.translate(b.x,targetY,b.z);result.computeBoundingBox();return result;
}
export function firstMeshGeometry(scene:Object3D){
  scene.updateWorldMatrix(true,true);let source:Mesh|undefined;
  scene.traverse(object=>{if(!source&&object instanceof Mesh)source=object;});
  if(!source)throw new Error('Missing gemstone mesh');
  return source.geometry.clone().applyMatrix4(source.matrixWorld);
}
export type ProductPart={name:string;geometry:BufferGeometry};
export function prepareProductRing(scene:Object3D,replacement:Object3D){
  scene.updateWorldMatrix(true,true);const metals:ProductPart[]=[],gems:ProductPart[]=[],box=new Box3();
  const replacementGeometry=firstMeshGeometry(replacement);
  let foundCenter=false;
  try{
    scene.traverse(object=>{
      if(!(object instanceof Mesh))return;
      let geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);
      if(object.name==='CenterDiamond'){
        const fitted=fitRoundGem(replacementGeometry,geometry);geometry.dispose();geometry=fitted;foundCenter=true;
      }
      box.union(bounds(geometry));
      (object.name.includes('Diamond')?gems:metals).push({name:object.name,geometry});
    });
    if(!foundCenter||!metals.length)throw new Error('Incomplete sample ring');
    const center=box.getCenter(new Vector3()),offset=new Vector3(-center.x,GROUND_Y+0.008-box.min.y,-center.z);
    for(const part of [...metals,...gems]){part.geometry.translate(offset.x,offset.y,offset.z);part.geometry.computeBoundingBox();}
    box.translate(offset);
  }catch(error){[...metals,...gems].forEach(p=>p.geometry.dispose());throw error;}
  finally{replacementGeometry.dispose();}
  let disposed=false;return {metals,gems,bounds:box,dispose(){if(disposed)return;disposed=true;[...metals,...gems].forEach(p=>p.geometry.dispose());}};
}
