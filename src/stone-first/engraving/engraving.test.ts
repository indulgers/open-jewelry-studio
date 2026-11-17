import {describe,it,expect} from 'vitest';
import {TorusGeometry,Vector3} from 'three';
import {engravingProblem} from '../ring02/engraving';
import {parseReferenceDesign,ORIGINAL_REFERENCE,referenceDetails} from '../reference/design';
import {RING_CATALOG} from '../catalog';
import {engravingSurface} from './surface';
describe('engraving personalization',()=>{
  it('preserves text, font and alignment through stored designs and cart summaries',()=>{
    const design={...ORIGINAL_REFERENCE,engraving:'相伴四季',engravingStyle:{font:'sans' as const,align:'right' as const}};
    expect(parseReferenceDesign(JSON.parse(JSON.stringify(design)))).toEqual(design);
    expect(referenceDetails(RING_CATALOG[0],design).find(d=>d.label==='内圈刻字')?.value).toBe('相伴四季 · 简洁黑体 · 靠右');
    expect(parseReferenceDesign(ORIGINAL_REFERENCE)).toEqual(ORIGINAL_REFERENCE);
    expect(parseReferenceDesign({...design,engravingStyle:{font:'constructor',align:'right'}})).toBeNull();
  });
  it('accepts Chinese characters but rejects markup, control characters and excess length',()=>{
    expect(engravingProblem('相伴四季 A & B')).toBe('');
    expect(engravingProblem('花'.repeat(17))).not.toBe('');
    expect(engravingProblem('<img>')).not.toBe('');
    expect(engravingProblem('a\nb')).not.toBe('');
  });
  it('projects lettering onto the inside of metal, without changing the source mesh',()=>{
    const ring=new TorusGeometry(.9,.1,24,96),before=ring.getAttribute('position').array.slice();
    const surface=engravingSurface([{name:'band',geometry:ring}]);expect(surface).not.toBeNull();
    const p=surface!.getAttribute('position'),point=new Vector3();
    for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i);expect(point.y).toBeLessThan(-.65);expect(Math.hypot(point.x,point.y)).toBeLessThan(.83);}
    expect(ring.getAttribute('position').array).toEqual(before);surface?.dispose();ring.dispose();
    expect(engravingSurface([])).toBeNull();
  });
});
