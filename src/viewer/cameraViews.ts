export type InspectionView='overall'|'stone'|'side';
export function cameraView(view:InspectionView,compact=false,modelMode:'reference'|'procedural'='procedural'):{position:[number,number,number];target:[number,number,number]}{
  if(view==='stone')return {position:compact?[1.4,3.28,2.4]:[1.05,2.8,1.7],target:[0,1.46,0]};
  if(view==='side')return {position:[0,1.36,2.4],target:[0,1.3,0]};
  if(modelMode==='reference')return {position:compact?[4.3,3.8,6.95]:[3.9,3.5,7.1],target:[0,0.22,0]};
  return {position:compact?[4.3,3.8,6.95]:[2.9,2.6,4.7],target:[0,0.22,0]};
}
