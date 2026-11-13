import {RING_CATALOG} from './catalog';
export function RingStylePicker({id}:{id:string}){
  return <label className="source-style-picker">戒指款式<select value={id} onChange={event=>{
    const next=RING_CATALOG.find(template=>template.id===event.target.value);
    if(next)window.location.hash=next.editor;
  }}>{RING_CATALOG.filter(template=>template.listed||template.id===id).map(template=><option key={template.id} value={template.id}>{template.name}</option>)}</select></label>;
}
