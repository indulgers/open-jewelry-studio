import {describe,it,expect} from 'vitest';
import {OrthographicCamera,TorusGeometry,Vector3} from 'three';
import {engravingProblem} from '../ring02/engraving';
import {parseReferenceDesign,ORIGINAL_REFERENCE,referenceDetails} from '../reference/design';
import {RING_CATALOG} from '../catalog';
import {engravingSurface} from './surface';
describe('engraving personalization',()=>{
  it('reads legacy alignment settings at the fixed inner-band position and retains the font',()=>{
    const design={...ORIGINAL_REFERENCE,engraving:'相伴四季',engravingStyle:{font:'sans' as const,align:'right' as const}};
    expect(parseReferenceDesign(JSON.parse(JSON.stringify(design)))).toEqual({...design,engravingStyle:{font:'sans',align:'center'}});
    expect(referenceDetails(RING_CATALOG[0],design).find(d=>d.label==='内圈刻字')?.value).toBe('相伴四季 · 简洁黑体 · 内圈中央');
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
    const camera=new OrthographicCamera(-1,1,1,-1,.03,30);
    camera.position.set(0,1.4,2.4);camera.lookAt(0,-.85,0);camera.updateMatrixWorld();
    const uv=surface!.getAttribute('uv');
    const points=[...Array(p.count).keys()].filter(index=>uv.getX(index)===.5);
    const projectedY=(v:number)=>point.fromBufferAttribute(p,points.find(index=>uv.getY(index)===v)!).project(camera).y;
    expect(projectedY(1)).toBeGreaterThan(projectedY(0));
    expect(ring.getAttribute('position').array).toEqual(before);surface?.dispose();ring.dispose();
    expect(engravingSurface([])).toBeNull();
  });
});
