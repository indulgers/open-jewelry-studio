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
      expect(referenceQuote(template,design).amount).toBe(template.price.base+100*template.zones.length);
      const details=referenceDetails(template,design);
      expect(details).toHaveLength(template.zones.length+4);
      expect(details[0].value).toContain(template.name);
    }
  });
});
