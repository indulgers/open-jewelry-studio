import {fitStorageKey,newDesignFit,type FitScope} from '../fit/profile';
import {BASE_DESIGN,TEMPLATE_REVISION,parseDesign,usesAutomaticPave,type RingDesign} from './model';

const SAVE_KEY='open-jewelry-studio:'+TEMPLATE_REVISION;
const PLACEMENT_VERSION='auto-pave-1';
export type Draft={design:RingDesign;revision:string;placementVersion:typeof PLACEMENT_VERSION};
export function newDraft(design:RingDesign):Draft{
  const revision=Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
  return {design,revision,placementVersion:PLACEMENT_VERSION};
}
export function readDraft(scope:FitScope='guest'):Draft{
  const key=fitStorageKey(SAVE_KEY,scope);
  try{
    const data=JSON.parse((key?localStorage.getItem(key):null)??'null');
    const stored=data?.design??data;
    const design=parseDesign(stored);
    if(design){
      const revision=data?.revision;
      const samePlacement=data?.placementVersion===PLACEMENT_VERSION||!usesAutomaticPave(design);
      if(samePlacement&&stored.metal===design.metal&&typeof revision==='string'&&/^[0-9a-f]{32}$/.test(revision)){
        return {design,revision,placementVersion:PLACEMENT_VERSION};
      }
      return newDraft(design);
    }
  }catch{/* Editing remains available without browser storage. */}
  return newDraft({...BASE_DESIGN,...newDesignFit(scope)});
}
export function writeDraft(draft:Draft,scope:FitScope='guest'){
  const key=fitStorageKey(SAVE_KEY,scope);
  if(!key)throw new Error('暂时无法确认草稿所属账号');
  localStorage.setItem(key,JSON.stringify(draft));
}
