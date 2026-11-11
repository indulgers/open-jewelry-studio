import {STONE_APPEARANCES,type StoneAppearance} from '../../viewer/stoneAppearance';
import {engravingProblem} from '../ring02/engraving';
import type {CatalogRing} from '../catalog';

export type ReferenceDesign={kind:'reference';center:StoneAppearance;halo:StoneAppearance;shoulder:StoneAppearance;engraving:string};
export const ORIGINAL_REFERENCE:ReferenceDesign={kind:'reference',center:'diamond',halo:'diamond',shoulder:'diamond',engraving:''};
export function parseReferenceDesign(value:unknown):ReferenceDesign|null{
  if(!value||typeof value!=='object')return null;
  const v=value as Record<string,unknown>;
  if(v.kind!=='reference'||typeof v.engraving!=='string'||v.engraving!==v.engraving.trim()||engravingProblem(v.engraving))return null;
  if(!['center','halo','shoulder'].every(zone=>typeof v[zone]==='string'&&Object.hasOwn(STONE_APPEARANCES,v[zone] as string)))return null;
  return {kind:'reference',center:v.center as StoneAppearance,halo:v.halo as StoneAppearance,shoulder:v.shoulder as StoneAppearance,engraving:v.engraving};
}
export function referenceQuote(template:CatalogRing,design:ReferenceDesign){
  return {amount:template.price.base+template.zones.filter(zone=>design[zone]!=='diamond').length*100,
    currency:'CNY' as const,version:template.price.version,leadTime:template.price.leadTime};
}
export const ZONE_NAMES={center:'主石',halo:'外围配钻',shoulder:'戒臂配钻'};
export function referenceDetails(template:CatalogRing,design:ReferenceDesign){
  return [
    {label:'款式',value:template.name+' · 原款镶座'},
    ...template.zones.map(zone=>({label:ZONE_NAMES[zone],value:STONE_APPEARANCES[design[zone]].name+' · 原款切形与大小'})),
    {label:'金属外观',value:'银色'},
    {label:'内圈刻字',value:design.engraving||'未添加'},
    {label:'实物圈号',value:'待工艺确认'},
  ];
}
