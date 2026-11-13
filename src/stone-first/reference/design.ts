import {activePriceBook,componentTotal,sumMoney} from '../pricing';
import {STONE_APPEARANCES,type StoneAppearance} from '../../viewer/stoneAppearance';
import {engravingProblem} from '../ring02/engraving';
import {RING_CATALOG,type CatalogRing} from '../catalog';
import {bandName,headName} from './parts';
import {PAVE_DIAMETERS,PAVE_LENGTHS,describePaveGap,type PaveDiameter,type PaveLength,type PaveSummary} from './pave-options';

export type ReferenceDesign={kind:'reference';center:StoneAppearance;halo:StoneAppearance;shoulder:StoneAppearance;engraving:string;headId?:string;bandId?:string;paveDiameter?:PaveDiameter;paveLength?:PaveLength};
export const ORIGINAL_REFERENCE:ReferenceDesign={kind:'reference',center:'diamond',halo:'diamond',shoulder:'diamond',engraving:''};
export function parseReferenceDesign(value:unknown):ReferenceDesign|null{
  if(!value||typeof value!=='object')return null;
  const v=value as Record<string,unknown>;
  if(v.kind!=='reference'||typeof v.engraving!=='string'||v.engraving!==v.engraving.trim()||engravingProblem(v.engraving))return null;
  if(!['center','halo','shoulder'].every(zone=>typeof v[zone]==='string'&&Object.hasOwn(STONE_APPEARANCES,v[zone] as string)))return null;
  if([v.headId,v.bandId].some(id=>id!==undefined&&!RING_CATALOG.some(ring=>ring.id===id)))return null;
  const paveDiameter=PAVE_DIAMETERS.find(diameter=>diameter===v.paveDiameter);
  const paveLength=PAVE_LENGTHS.find(length=>length===v.paveLength);
  if((v.paveDiameter!==undefined&&paveDiameter===undefined)||(v.paveLength!==undefined&&paveLength===undefined))return null;
  return {kind:'reference',...(paveDiameter===undefined?{}:{paveDiameter}),...(paveLength===undefined?{}:{paveLength}),...(typeof v.headId==='string'?{headId:v.headId}:{}),
    ...(typeof v.bandId==='string'?{bandId:v.bandId}:{}),center:v.center as StoneAppearance,halo:v.halo as StoneAppearance,shoulder:v.shoulder as StoneAppearance,engraving:v.engraving};
}
export function referenceParts(template:CatalogRing,design:ReferenceDesign){
  const head=RING_CATALOG.find(ring=>ring.id===design.headId)??template;
  const band=RING_CATALOG.find(ring=>ring.id===design.bandId)??template;
  const zones=[...head.zones.filter(zone=>zone!=='shoulder'),...band.zones.filter(zone=>zone==='shoulder')];
  return {head,band,zones};
}

export function referenceQuote(template:CatalogRing,design:ReferenceDesign){
  const {head,band,zones}=referenceParts(template,design);
  return {amount:sumMoney([head.price.base,componentTotal(head.id,band.id,band.zones.includes('shoulder')),zones.filter(zone=>design[zone]!=='diamond').length*100]),
    currency:'CNY' as const,version:activePriceBook?.revision??head.price.version,leadTime:head.price.leadTime};
}
export const ZONE_NAMES={center:'主石',halo:'外围配钻',shoulder:'戒臂配钻'};
export function referenceDetails(template:CatalogRing,design:ReferenceDesign,pave?:PaveSummary|null){
  const {head,band,zones}=referenceParts(template,design);
  return [
    ...(head.id===template.id&&band.id===template.id
      ?[{label:'款式',value:template.name+' · 原款镶座'}]
      :[{label:'戒头',value:headName(head.name)},{label:'戒圈',value:bandName(band.id)}]),
    ...zones.map(zone=>({label:ZONE_NAMES[zone],value:STONE_APPEARANCES[design[zone]].name+(zone==='shoulder'&&pave
      ?' · '+pave.count+' 颗'
      :' · 原款切形与大小')})),
    ...(pave?[
      {label:'配钻石径 / 铺钻长度',value:(design.paveDiameter??100)+'% / '+(design.paveLength??100)+'%'},
      {label:'同列配钻间距',value:describePaveGap(pave)},
    ]:[]),
    {label:'金属外观',value:'银色'},
    {label:'内圈刻字',value:design.engraving||'未添加'},
    {label:'实物圈号',value:'待工艺确认'},
  ];
}
