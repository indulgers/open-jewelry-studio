import type {BufferGeometry} from 'three';
import {deinterleaveGeometry,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
export function prepareGemGeometry(source:BufferGeometry,orientation:[number,number,number]){
  const clone=source.clone();
  deinterleaveGeometry(clone);
  clone.rotateX(orientation[0]);clone.rotateY(orientation[1]);clone.rotateZ(orientation[2]);
  const prepared=clone.index?clone:mergeVertices(clone,1e-5);
  if(prepared!==clone)clone.dispose();
  prepared.computeBoundingBox();return prepared;
}
