import {isRingSize} from './sizing';

export type FitProfile={heightCm?:number;weightKg?:number;ringSizeUS?:number};
export type FitScope='guest'|`member:${string}`|null;
const profileKey='xiangyan:local-fit-profile:v1';
export function fitStorageKey(base:string,scope:FitScope){
  if(scope===null)return null;
  return scope==='guest'?base:base+':'+scope;
}
const validMeasurement=(value:unknown):value is number=>
  typeof value==='number'&&Number.isFinite(value)&&value>0;

export function readFitProfile(scope:FitScope):FitProfile{
  const key=fitStorageKey(profileKey,scope);
  if(!key)return {};
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
export function saveFitProfile(profile:FitProfile,scope:FitScope){
  const key=fitStorageKey(profileKey,scope);
  if(!key)throw new Error('未确认佩戴资料所属账号');
  if(Object.values(profile).every(value=>value===undefined))localStorage.removeItem(key);
  else localStorage.setItem(key,JSON.stringify(profile));
}
export function newDesignFit(scope:FitScope){
  const {ringSizeUS}=readFitProfile(scope);
  return ringSizeUS===undefined?{}:{ringSizeUS};
}
