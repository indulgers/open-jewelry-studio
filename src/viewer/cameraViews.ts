import type {ModelMode} from '../assets/referenceManifest';
export type InspectionView='overall'|'front'|'stone'|'side'|'pave';
export function cameraView(view:InspectionView,compact=false,modelMode:ModelMode='procedural'):{position:[number,number,number];target:[number,number,number]}{
  if(modelMode==='gem'){
    if(view==='front')return {position:[0,compact?8:6.6,0.001],target:[0,0,0]};
    if(view==='side')return {position:[0,0.45,compact?7:6],target:[0,0,0]};
    return {position:view==='stone'?(compact?[2,3.7,4.7]:[1.5,3.1,4]):[2.4,3.2,5.4],target:[0,0,0]};
  }
  if(modelMode==='reference'){
    if(view==='pave')return {position:compact?[1.65,2.65,2.35]:[1.35,2.45,2.05],target:[0.45,1.13,0]};
    if(view==='front')return {position:[0,compact?6.7:5.25,0.12],target:[0,0.72,0]};
    if(view==='stone')return {position:compact?[1.55,3.0,2.85]:[1.5,2.82,2.7],target:[0,1.18,0]};
    if(view==='side')return {position:[0,1.24,compact?3.6:3.15],target:[0,0.98,0]};
  }
  if(view==='front')return {position:[0,1.55,5.6],target:[0,0.05,0]};
  if(view==='stone')return {position:compact?[1.4,3.1,2.25]:[1.1,2.7,1.85],target:[0,1.4,0]};
  if(view==='side')return {position:[0,1.4,2.5],target:[0,1.3,0]};
  if(modelMode==='reference')return {position:compact?[4.4,3.6,7.2]:[3.6,2.95,5.85],target:[0,0.15,0]};
  return {position:compact?[4.3,3.8,6.95]:[2.9,2.6,4.7],target:[0,0.22,0]};
}
