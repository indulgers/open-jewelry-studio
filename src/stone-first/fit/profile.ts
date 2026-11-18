import {isRingSize} from './sizing';

export type FitProfile={heightCm?:number;weightKg?:number;ringSizeUS?:number};
const key='xiangyan:local-fit-profile:v1';
const validMeasurement=(value:unknown):value is number=>
  typeof value==='number'&&Number.isFinite(value)&&value>0;

export function readFitProfile():FitProfile{
  try{
    const value=JSON.parse(localStorage.getItem(key)??'null');
    if(!value||typeof value!=='object')return {};
    return {
      ...(validMeasurement(value.heightCm)?{heightCm:value.heightCm}:{}),
      ...(validMeasurement(value.weightKg)?{weightKg:value.weightKg}:{}),
      ...(isRingSize(value.ringSizeUS)?{ringSizeUS:value.ringSizeUS}:{}),
    };
  }catch{return {};}
}
export function saveFitProfile(profile:FitProfile){
  if(Object.values(profile).every(value=>value===undefined))localStorage.removeItem(key);
  else localStorage.setItem(key,JSON.stringify(profile));
}
export function newDesignFit(){
  const {ringSizeUS}=readFitProfile();
  return ringSizeUS===undefined?{}:{ringSizeUS};
}
