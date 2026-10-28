import type {ModelMode} from '../assets/referenceManifest';
export type InspectionView='overall'|'front'|'stone'|'side';
export function cameraView(view:InspectionView,compact=false,modelMode:ModelMode='procedural'):{position:[number,number,number];target:[number,number,number]}{
  if(modelMode==='gem'){
    if(view==='front')return {position:[0,compact?8:6.6,0.001],target:[0,0,0]};
    if(view==='side')return {position:[0,0.45,compact?7:6],target:[0,0,0]};
    return {position:view==='stone'?(compact?[2,3.7,4.7]:[1.5,3.1,4]):[2.4,3.2,5.4],target:[0,0,0]};
  }
  if(modelMode==='reference'){
    if(view==='stone')return {position:compact?[1.3,2.85,2.6]:[1.15,2.32,2.09],target:[0,1.03,0]};
    if(view==='side')return {position:[0,1.16,compact?3.7:3.3],target:[0,0.95,0]};
  }
  if(view==='front')return {position:[0,2.15,7.3],target:[0,0.25,0]};
  if(view==='stone')return {position:compact?[1.4,3.28,2.4]:[1.05,2.8,1.7],target:[0,1.46,0]};
  if(view==='side')return {position:[0,1.36,2.4],target:[0,1.3,0]};
  if(modelMode==='reference')return {position:compact?[4.3,3.8,6.95]:[3.9,3.5,7.1],target:[0,0.22,0]};
  return {position:compact?[4.3,3.8,6.95]:[2.9,2.6,4.7],target:[0,0.22,0]};
}
