import {RING_CATALOG} from '../stone-first/catalog';
import {parseReferenceDesign,referenceDetails,ZONE_NAMES} from '../stone-first/reference/design';
import {parseDesign,ZONES} from '../stone-first/ring02/model';
import {HEADS} from '../stone-first/ring02/head';
import {engravingStyleLabel} from '../stone-first/engraving/style';
import {ringSizeDescription} from '../stone-first/fit/sizing';
import {STONE_APPEARANCES} from '../viewer/stoneAppearance';
import type {Work} from './client';

export function summarizeSavedDesign(work:Pick<Work,'design'|'templateId'|'details'>){
  if(work.details?.length)return work.details;
  const raw=work.design;
  if(!raw)return [];
  const ids=['headId','bandId'].map(key=>Reflect.get(raw,key)).filter((id):id is string=>typeof id==='string');
  const reference=parseReferenceDesign(raw,ids);
  const template=RING_CATALOG.find(ring=>ring.id===work.templateId);
  if(reference){
    const componentsKnown=ids.every(id=>RING_CATALOG.some(ring=>ring.id===id));
    const pave=reference.paveDiameter||reference.paveLength
      ?[{label:'配钻石径 / 铺钻长度',value:(reference.paveDiameter??100)+'% / '+(reference.paveLength??100)+'%'}]:[];
    if(template&&componentsKnown)return [...referenceDetails(template,reference),...pave];
    const partLabel=(id?:string)=>id?RING_CATALOG.find(ring=>ring.id===id)?.name??'历史部件 '+id:'随原款';
    return [
      {label:'戒头',value:partLabel(reference.headId)},{label:'戒圈',value:partLabel(reference.bandId)},
      {label:'主石外观',value:STONE_APPEARANCES[reference.center].name},...pave,
      {label:'实物圈号',value:ringSizeDescription(reference.ringSizeUS)},
      {label:'内圈刻字',value:reference.engraving?reference.engraving+' · '+engravingStyleLabel(reference.engravingStyle):'未添加'},
    ];
  }
  const precise=parseDesign(raw);
  if(!precise)return [];
  return [
    {label:'镶座',value:HEADS.find(([id])=>id===precise.head)![1]},
    ...ZONES.filter(zone=>zone!=='halo'||precise.head==='halo').map(zone=>{
      const stone=precise[zone];
      return {label:ZONE_NAMES[zone],value:[stone.cut==='oval'?'椭圆形':'圆形',STONE_APPEARANCES[stone.appearance].name,Math.round(stone.size*100)+'%'].join(' · ')};
    }),
    {label:'戒臂铺钻长度',value:Math.round(precise.reach*100)+'%'},
    {label:'实物圈号',value:ringSizeDescription(precise.ringSizeUS)},
    {label:'内圈刻字',value:precise.engraving?precise.engraving+' · '+engravingStyleLabel(precise.engravingStyle):'未添加'},
  ];
}
