import {ORIGINAL_REFERENCE,parseReferenceDesign,type ReferenceDesign} from './design';
import {RING_CATALOG,type CatalogRing} from '../catalog';

export type EditorHistory={id:string;design:ReferenceDesign;revision:string;past:ReferenceDesign[];future:ReferenceDesign[]};
export type EditorAction={type:'change';design:ReferenceDesign}|{type:'undo'|'redo'|'fork'};
export function initialHistory(design=ORIGINAL_REFERENCE,revision:string=crypto.randomUUID(),id:string=crypto.randomUUID()):EditorHistory{
  return {id,design,revision,past:[],future:[]};
}
export function editorHistory(state:EditorHistory,action:EditorAction):EditorHistory{
  if(action.type==='fork')return {...state,id:crypto.randomUUID(),revision:crypto.randomUUID()};
  if(action.type==='change'){
    if(JSON.stringify(action.design)===JSON.stringify(state.design))return state;
    return {id:state.id,design:action.design,revision:crypto.randomUUID(),past:[...state.past,state.design].slice(-10),future:[]};
  }
  if(action.type==='undo'){
    const design=state.past.at(-1);
    return design?{id:state.id,design,revision:crypto.randomUUID(),past:state.past.slice(0,-1),future:[state.design,...state.future].slice(0,10)}:state;
  }
  const [design,...future]=state.future;
  return design?{id:state.id,design,revision:crypto.randomUUID(),past:[...state.past,state.design].slice(-10),future}:state;
}

export const draftKey=(id:string)=>'open-jewelry-studio:combination:'+id;
export function readEditorDraft(template:CatalogRing,storage:Pick<Storage,'getItem'>){
  let raw:string|null=null;
  try{
    raw=storage.getItem(draftKey(template.id))??storage.getItem('open-jewelry-studio:'+(template.legacyRevision??template.revision)+(template.kind==='parametric'?':combination':''));
    if(raw===null){
      raw=storage.getItem('open-jewelry-studio:'+template.revision);
      // The precision editor owns this legacy key too. Leave its non-reference draft intact.
      if(template.kind==='parametric'&&raw&&JSON.parse(raw)?.design?.kind!=='reference')return {history:initialHistory()};
    }
    if(!raw)return {history:initialHistory()};
    const saved=JSON.parse(raw),design=parseReferenceDesign(saved?.design);
    if(!design||typeof saved.revision!=='string'||!saved.revision||saved.revision.length>128){
      const missing=['headId','bandId'].filter(field=>typeof saved?.design?.[field]==='string'&&!RING_CATALOG.some(ring=>ring.id===saved.design[field]));
      return {history:initialHistory(),raw,issue:missing.length?'草稿中的'+missing.map(field=>field==='headId'?'戒头':'戒圈').join('、')+'已不在当前部件库，请保留原记录并重新选款。':'草稿内容或版本格式无法识别，原记录已保留。'};
    }
    return {history:initialHistory(design,/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(saved.revision)?saved.revision:undefined,typeof saved.id==='string'&&/^[a-f0-9-]{36}$/.test(saved.id)?saved.id:undefined),raw,server:typeof saved.server?.revision==='string'&&typeof saved.server?.savedAt==='string'?saved.server as {revision:string;savedAt:string}:undefined};
  }catch{
    return {history:initialHistory(),raw,issue:'暂时无法读取本机草稿，请重试或下载原记录后再开始。'};
  }
}

// Keep the previous draft before replacing it. A failed backup must leave the active draft untouched.
export function startNewDraft(template:CatalogRing,storage:Pick<Storage,'getItem'|'setItem'>){
  const previous=readEditorDraft(template,storage);
  const raw=storage.getItem(draftKey(template.id))??previous.raw;
  if(raw!=null)storage.setItem(draftKey(template.id)+':previous',raw);
  storage.setItem(draftKey(template.id),JSON.stringify({id:crypto.randomUUID(),design:ORIGINAL_REFERENCE,revision:crypto.randomUUID(),savedAt:new Date().toISOString()}));
}
