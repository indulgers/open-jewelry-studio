import {describe,expect,it} from 'vitest';
import {RING_CATALOG} from '../catalog';
import {ORIGINAL_REFERENCE,parseReferenceDesign,referenceDetails,referenceQuote} from './design';

describe('source model customization',()=>{
  it('rejects invalid saved appearance and engraving without trusting extra fields',()=>{
    expect(parseReferenceDesign(null)).toBeNull();
    expect(parseReferenceDesign({...ORIGINAL_REFERENCE,center:'constructor'})).toBeNull();
    expect(parseReferenceDesign({...ORIGINAL_REFERENCE,engraving:' a '})).toBeNull();
    expect(parseReferenceDesign({...ORIGINAL_REFERENCE,engraving:'x'.repeat(17)})).toBeNull();
    expect(parseReferenceDesign({...ORIGINAL_REFERENCE,engraving:'A & B',price:1})).toEqual({...ORIGINAL_REFERENCE,engraving:'A & B'});
  });
  it('round-trips supported pavé controls while retaining older drafts',()=>{
    expect(parseReferenceDesign(ORIGINAL_REFERENCE)).toEqual(ORIGINAL_REFERENCE);
    const design={...ORIGINAL_REFERENCE,paveDiameter:90,paveLength:85};
    expect(parseReferenceDesign(design)).toEqual(design);
    expect(parseReferenceDesign({...design,paveDiameter:95})).toBeNull();
    expect(parseReferenceDesign({...design,paveLength:'85'})).toBeNull();
  });
  it('charges and describes only the stone zones actually present in each supplied model',()=>{
    for(const template of RING_CATALOG.filter(item=>item.kind==='reference')){
      const design={...ORIGINAL_REFERENCE,center:'sapphire' as const,halo:'ruby' as const,shoulder:'emerald' as const};
      expect(referenceQuote(template,design).amount).toBe(template.price.base);
      expect(parseReferenceDesign(design)).toMatchObject({center:'diamond',halo:'diamond',shoulder:'diamond'});
      const details=referenceDetails(template,design);
      expect(details).toHaveLength(template.zones.length+4);
      expect(details[0].value).toContain(template.name);
    }
  });
});

it('keeps custom cut, carat, stone and finish when a saved reference design is reopened',()=>{
  const styling={cut:'pear',carat:1.5,gem:'moissanite-blue',plating:'rose',surface:'matte'} as const;
  const saved={...ORIGINAL_REFERENCE,styling};
  expect(parseReferenceDesign(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  const details=referenceDetails(RING_CATALOG[0],saved);
  expect(details.find(row=>row.label==='主石')?.value).toBe('莫桑钻 · 灰蓝色 · 梨形 · 1.5 ct');
  expect(details.find(row=>row.label==='金属外观')?.value).toBe('玫瑰金色 · 哑面');
  expect(parseReferenceDesign({...saved,styling:{...styling,carat:9}})).toBeNull();
  expect(parseReferenceDesign({...saved,styling:{...styling,gem:'toString'}})).toBeNull();
});
