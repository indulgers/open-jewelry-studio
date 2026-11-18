import {expect,it} from 'vitest';
import {summarizeSavedDesign} from './saved-design-summary';
import {ORIGINAL_REFERENCE} from '../stone-first/reference/design';
import {RING02_TEMPLATE} from '../stone-first/ring02/assets';

it('retains a published head name even after the catalog changes',()=>{
  const details=[{label:'戒头',value:'试制花冠'}];
  expect(summarizeSavedDesign({details,templateId:'retired',design:ORIGINAL_REFERENCE})).toEqual(details);
});
it('shows historical missing parts without assigning current parts to them',()=>{
  const rows=summarizeSavedDesign({templateId:'retired',design:{...ORIGINAL_REFERENCE,headId:'old-part',ringSizeUS:7,engraving:'2026'}});
  expect(rows).toContainEqual({label:'戒头',value:expect.stringContaining('old-part')});
  expect(rows).toContainEqual({label:'实物圈号',value:expect.stringContaining('美码 7')});
  expect(rows).toContainEqual({label:'内圈刻字',value:expect.stringContaining('2026')});
});
it('describes a precision design and does not invent data for an unknown legacy format',()=>{
  expect(summarizeSavedDesign({templateId:'ring-02',design:RING02_TEMPLATE.defaultDesign})).toContainEqual({label:'镶座',value:'原款围钻'});
  expect(summarizeSavedDesign({design:{unrecognized:true}})).toEqual([]);
});
