import {BASE_DESIGN,TEMPLATE_REVISION,parseDesign,type RingDesign} from './model';

const SAVE_KEY='open-jewelry-studio:'+TEMPLATE_REVISION;
export type Draft={design:RingDesign;revision:string};
export function newDraft(design:RingDesign):Draft{
  const revision=Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
  return {design,revision};
}
export function readDraft():Draft{
  try{
    const data=JSON.parse(localStorage.getItem(SAVE_KEY)??'null');
    const design=parseDesign(data?.design??data);
    if(design){
      const revision=data?.revision;
      if(typeof revision==='string'&&/^[0-9a-f]{32}$/.test(revision))return {design,revision};
      return newDraft(design);
    }
  }catch{/* Editing remains available without browser storage. */}
  return newDraft(BASE_DESIGN);
}
export function writeDraft(draft:Draft){
  localStorage.setItem(SAVE_KEY,JSON.stringify(draft));
}
