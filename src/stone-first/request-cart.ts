import type {DesignRequest} from './consumer-types';
import {addDemoOrder} from './ring02/demoOrder';
import {STONE_APPEARANCES} from '../viewer/stoneAppearance';
export function addConfirmedRequestToCart(record:DesignRequest){
  if(record.status!=='confirmed'||!record.quote||!record.confirmedAt)throw new Error('方案与正式报价尚未确认。');
  const saved=record.design,design=saved.design;
  return addDemoOrder({name:saved.name,templateRevision:saved.templates.head.revision,revision:saved.revision,confirmedAt:record.confirmedAt,design,
    request:{id:record.id,designId:saved.id,revision:saved.revision},thumbnail:saved.thumbnail,
    quote:{amount:record.quote.amount,currency:'CNY',version:record.stateRevision,leadTime:record.quote.leadTime},stones:[],
    details:[{label:'戒头',value:saved.templates.head.name},{label:'戒圈',value:saved.templates.band.name},{label:'主石',value:STONE_APPEARANCES[design.center].name},{label:'内圈刻字',value:design.engraving||'未添加'},
      {label:'石径 / 铺钻长度',value:(design.paveDiameter??100)+'% / '+(design.paveLength??100)+'%'},{label:'制作要求',value:record.quote.productionRequirements}],
  });
}
