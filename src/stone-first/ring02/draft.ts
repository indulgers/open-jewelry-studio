import {BASE_DESIGN,TEMPLATE_REVISION,parseDesign,usesAutomaticPave,type RingDesign} from './model';

const SAVE_KEY='open-jewelry-studio:'+TEMPLATE_REVISION;
const PLACEMENT_VERSION='auto-pave-1';
export type Draft={design:RingDesign;revision:string;placementVersion:typeof PLACEMENT_VERSION};
export function newDraft(design:RingDesign):Draft{
  const revision=Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
  return {design,revision,placementVersion:PLACEMENT_VERSION};
}
export function readDraft():Draft{
  try{
    const data=JSON.parse(localStorage.getItem(SAVE_KEY)??'null');
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
  return newDraft(BASE_DESIGN);
}
export function writeDraft(draft:Draft){
  localStorage.setItem(SAVE_KEY,JSON.stringify(draft));
}
