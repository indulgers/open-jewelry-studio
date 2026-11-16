import {parsePersonalImage,imagePosition,type PersonalImage} from './personalization';
import {combinationQuote} from '../pricing';
import {STONE_APPEARANCES,type StoneAppearance} from '../../viewer/stoneAppearance';
import {engravingProblem} from '../ring02/engraving';
import {RING_CATALOG,type CatalogRing} from '../catalog';
import {bandName,headName} from './parts';
import {PAVE_DIAMETERS,PAVE_LENGTHS,describePaveGap,type PaveDiameter,type PaveLength,type PaveSummary} from './pave-options';

export type ReferenceDesign={kind:'reference';center:StoneAppearance;halo:StoneAppearance;shoulder:StoneAppearance;engraving:string;requestNote?:string;image?:PersonalImage;headId?:string;bandId?:string;paveDiameter?:PaveDiameter;paveLength?:PaveLength};
export const ORIGINAL_REFERENCE:ReferenceDesign={kind:'reference',center:'diamond',halo:'diamond',shoulder:'diamond',engraving:''};
export function parseReferenceDesign(value:unknown):ReferenceDesign|null{
  if(!value||typeof value!=='object')return null;
  const v=value as Record<string,unknown>;
  if(v.kind!=='reference'||typeof v.engraving!=='string'||v.engraving!==v.engraving.trim()||engravingProblem(v.engraving))return null;
  if(!['center','halo','shoulder'].every(zone=>typeof v[zone]==='string'&&Object.hasOwn(STONE_APPEARANCES,v[zone] as string)))return null;
  if([v.headId,v.bandId].some(id=>id!==undefined&&!RING_CATALOG.some(ring=>ring.id===id)))return null;
  if(v.requestNote!==undefined&&(typeof v.requestNote!=='string'||v.requestNote.length>1000))return null;
  const image=v.image===undefined?undefined:parsePersonalImage(v.image);
  if(image===null)return null;
  const paveDiameter=PAVE_DIAMETERS.find(diameter=>diameter===v.paveDiameter);
  const paveLength=PAVE_LENGTHS.find(length=>length===v.paveLength);
  if((v.paveDiameter!==undefined&&paveDiameter===undefined)||(v.paveLength!==undefined&&paveLength===undefined))return null;
  return {kind:'reference',...(typeof v.requestNote==='string'?{requestNote:v.requestNote}:{}),...(image?{image}:{}),...(paveDiameter===undefined?{}:{paveDiameter}),...(paveLength===undefined?{}:{paveLength}),...(typeof v.headId==='string'?{headId:v.headId}:{}),
    ...(typeof v.bandId==='string'?{bandId:v.bandId}:{}),center:v.center as StoneAppearance,halo:v.halo as StoneAppearance,shoulder:v.shoulder as StoneAppearance,engraving:v.engraving};
}
export function referenceParts(template:CatalogRing,design:ReferenceDesign){
  const head=RING_CATALOG.find(ring=>ring.id===design.headId)??template;
  const band=RING_CATALOG.find(ring=>ring.id===design.bandId)??template;
  const zones=[...head.zones.filter(zone=>zone!=='shoulder'),...band.zones.filter(zone=>zone==='shoulder')];
  return {head,band,zones};
}

export function referenceQuote(template:CatalogRing,design:ReferenceDesign){
  const {head,band}=referenceParts(template,design);
  return combinationQuote(head,band,design);
}
export const ZONE_NAMES={center:'主石',halo:'外围配钻',shoulder:'戒臂配钻'};
export function referenceDetails(template:CatalogRing,design:ReferenceDesign,pave?:PaveSummary|null){
  const {head,band,zones}=referenceParts(template,design);
  return [
    ...(head.id===template.id&&band.id===template.id
      ?[{field:'head',label:'款式',value:template.name+' · 原款镶座'}]
      :[{field:'head',label:'戒头',value:headName(head.name)},{field:'band',label:'戒圈',value:bandName(band.id)}]),
    ...zones.map(zone=>({field:zone,label:ZONE_NAMES[zone],value:STONE_APPEARANCES[design[zone]].name+(zone==='shoulder'&&pave
      ?' · '+pave.count+' 颗'
      :' · 原款切形与大小')})),
    ...(pave?[
      {field:'pave',label:'配钻石径 / 铺钻长度',value:(design.paveDiameter??100)+'% / '+(design.paveLength??100)+'%'},
      {field:'pave',label:'同列配钻间距',value:describePaveGap(pave)},
    ]:[]),
    {field:'material',label:'金属外观',value:'银色'},
    {field:'engraving',label:'内圈刻字',value:design.engraving||'未添加'},
    ...(design.image?[{field:'image',label:'图片个性化',value:design.image.name+' · '+imagePosition(design.image.position)+'（待复核）'}]:[]),
    {field:'size',label:'尺寸与制作要求',value:design.requestNote||'待工艺确认'},
  ];
}
