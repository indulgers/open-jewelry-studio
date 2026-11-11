import type {CatalogRing} from './catalog';
import {RING02_TEMPLATE} from './ring02/assets';
import {addDemoOrder,estimateRing02} from './ring02/demoOrder';
import {ORIGINAL_REFERENCE,referenceDetails,referenceQuote} from './reference/design';

export function purchaseOriginal(template:CatalogRing){
  const parametric=template.kind==='parametric';
  addDemoOrder({
    templateRevision:template.revision,revision:crypto.randomUUID(),confirmedAt:new Date().toISOString(),
    design:parametric?RING02_TEMPLATE.defaultDesign:ORIGINAL_REFERENCE,
    quote:parametric?estimateRing02(RING02_TEMPLATE.defaultDesign):referenceQuote(template,ORIGINAL_REFERENCE),
    details:parametric?[
      {label:'款式',value:'原款围钻'},
      {label:'主石',value:'圆形白钻 · 原款大小'},
      {label:'戒圈',value:'原款镶钻戒臂'},
      {label:'金属外观',value:'银色'},
      {label:'内圈刻字',value:'未添加'},
      {label:'实物圈号',value:'待工艺确认'},
    ]:referenceDetails(template,ORIGINAL_REFERENCE),
    stones:[],
  });
}
