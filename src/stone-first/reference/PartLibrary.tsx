import {useId,useLayoutEffect,useRef,useState,type RefObject} from 'react';
import {RING_CATALOG} from '../catalog';
import {BAND_STYLES,bandStyle,headName} from './parts';

type PartChoice={id:string;name:string;image:string;detail?:string};
export const sourceImage=(id:string)=>RING_CATALOG.find(ring=>ring.id===id)!.image;
const HEAD_STRUCTURES={
  'ring-02':['围镶'],
  'ring-floral':['围镶','花形'],
  'ring-rosette':['花形'],
  'ring-petal':['围镶','花形'],
  'ring-crown':['高托'],
  'ring-starlight':['围镶','高托'],
  'ring-solstice':['高托'],
} as const;
const headStructures=['围镶','花形','高托'];
export const headChoices=RING_CATALOG.map(ring=>({
  id:ring.id,name:headName(ring.name),image:ring.image,
  detail:ring.subtitle.split(' · ')[1],
  structures:HEAD_STRUCTURES[ring.id as keyof typeof HEAD_STRUCTURES]??[],
}));
const bandFinishes=BAND_STYLES.flatMap(style=>style.finishes.map(finish=>({
  id:finish.id,name:style.name,image:sourceImage(finish.id),detail:finish.name,
})));
const finishes=[...new Set(bandFinishes.map(item=>item.detail))];

export function PartCard({item,selected,pending,onSelect}:{item:PartChoice;selected:boolean;pending?:boolean;onSelect:(id:string)=>void}){
  return <button type="button" className="source-part-card" aria-pressed={selected} onClick={()=>onSelect(item.id)}>
    <span className="source-part-image"><img src={item.image} alt="" decoding="async" loading="lazy"/></span>
    <span className="source-part-name">{item.name}{pending&&selected&&<span className="ring02-spinner" aria-hidden="true"/>}</span>
    {item.detail&&<span className="source-part-detail">{item.detail}</span>}
  </button>;
}

export function PartLibrary({kind,selected,trigger,onClose,onSelect}:{
  kind:'head'|'band';selected:string;trigger:RefObject<HTMLButtonElement|null>;onClose:()=>void;onSelect:(id:string)=>void;
}){
  const titleId=useId();
  const dialog=useRef<HTMLDialogElement>(null);
  const results=useRef<HTMLDivElement>(null);
  const [query,setQuery]=useState('');
  const [structure,setStructure]=useState('');
  const [finish,setFinish]=useState('');
  const isHead=kind==='head';
  const selectedName=isHead?headChoices.find(item=>item.id===selected)!.name:
    bandStyle(selected).name+' · '+bandFinishes.find(item=>item.id===selected)!.detail;
  const text=query.trim();
  const matches=(item:PartChoice)=>(item.name+' '+(item.detail??'')).includes(text);
  const visible=isHead
    ?headChoices.filter(item=>(!structure||item.structures.some(value=>value===structure))&&matches(item))
    :bandFinishes.filter(item=>(!structure||item.name===structure)&&(!finish||item.detail===finish)&&matches(item));

  useLayoutEffect(()=>{
    const element=dialog.current!;
    element.showModal();
    return ()=>{
      element.close();
      trigger.current?.focus({preventScroll:true});
    };
  },[trigger]);

  function updateFilter(setValue:(value:string)=>void,value:string){
    setValue(value);
    if(results.current)results.current.scrollTop=0;
  }
  return <dialog className="source-library" ref={dialog} aria-labelledby={titleId}
    onCancel={event=>{event.preventDefault();onClose();}}
    onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div className="source-library-body">
      <header className="source-library-heading">
        <h2 id={titleId}>{isHead?'戒头款式库':'戒圈与铺钻库'}</h2>
        <button type="button" className="shop-text-link" autoFocus onClick={onClose}>返回选款</button>
      </header>
      <div className="source-library-filters">
        <label><span className="sr-only">搜索款式</span><input type="search" placeholder={isHead?'搜索款名或造型':'搜索戒圈或铺钻'}
          value={query} onChange={event=>updateFilter(setQuery,event.target.value)}/></label>
        {isHead?<div className="source-library-chips" role="group" aria-label="戒头结构">
          <button type="button" aria-pressed={!structure} onClick={()=>updateFilter(setStructure,'')}>全部</button>
          {headStructures.map(name=><button type="button" key={name} aria-pressed={structure===name}
            onClick={()=>updateFilter(setStructure,name)}>{name}</button>)}
        </div>:<div className="source-library-selects">
          <label>戒圈结构<select value={structure} onChange={event=>updateFilter(setStructure,event.target.value)}>
            <option value="">全部结构</option>{BAND_STYLES.map(item=><option key={item.name}>{item.name}</option>)}
          </select></label>
          <label>戒臂铺钻<select value={finish} onChange={event=>updateFilter(setFinish,event.target.value)}>
            <option value="">全部铺钻</option>{finishes.map(name=><option key={name}>{name}</option>)}
          </select></label>
        </div>}
        <div className="source-library-meta"><span role="status">{visible.length} 款</span><span>已选 {selectedName}</span></div>
      </div>
      <div ref={results} className="source-library-results">
        {visible.length?<div className={'source-part-grid source-'+kind+'-options'}>{visible.map(item=><PartCard
          key={item.id} item={item} selected={item.id===selected} onSelect={id=>{onClose();onSelect(id);}}/>)}</div>:
          <div className="source-library-empty"><p>没有符合条件的款式。</p>
            <button type="button" className="shop-text-link" onClick={()=>{setQuery('');setStructure('');setFinish('');}}>清除筛选</button>
          </div>}
      </div>
    </div>
  </dialog>;
}
