import {expect,it} from 'vitest';
import {RING_CATALOG} from '../catalog';
import {ORIGINAL_REFERENCE,parseReferenceDesign,referenceDetails} from '../reference/design';
import {BASE_DESIGN,parseDesign} from '../ring02/model';

it('restores a chosen quarter US size in each editor and records it as a requested measurement',()=>{
  const design={...ORIGINAL_REFERENCE,ringSizeUS:6.25};
  expect(parseReferenceDesign(design)).toEqual(design);
  expect(referenceDetails(RING_CATALOG[0],design)).toContainEqual({label:'实物圈号',value:'美码 6.25 · 参考内周 52.5 mm · 待工艺确认'});
  expect(parseDesign({...BASE_DESIGN,ringSizeUS:4})).toMatchObject({ringSizeUS:4});
  expect(parseReferenceDesign({...design,ringSizeUS:6.3})).toBeNull();
  expect(parseDesign({...BASE_DESIGN,ringSizeUS:'8'})).toBeNull();
});
