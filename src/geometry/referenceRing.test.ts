import {BoxGeometry,Group,Mesh,MeshBasicMaterial,Vector3} from 'three';
import {describe,expect,it} from 'vitest';
import {prepareReferenceRing} from './referenceRing';

function fixture(){
  const scene=new Group(),parent=new Group();parent.position.set(4,2,-3);parent.scale.setScalar(2);scene.add(parent);
  const metal=new Mesh(new BoxGeometry(1,2,0.3),new MeshBasicMaterial());metal.name='mesh_0';
  const gem=new Mesh(new BoxGeometry(0.4,0.3,0.4),new MeshBasicMaterial());gem.name='Brillant_1';gem.position.y=1.1;
  parent.add(metal,gem);return {scene,metal,gem};
}
describe('reference ring preparation',()=>{
  it('bakes all ancestor transforms and grounds the complete aligned assembly',()=>{
    const {scene,metal}=fixture(),original=metal.geometry.getAttribute('position').array.slice();
    const ring=prepareReferenceRing(scene,-1.295);
    expect(ring.parts.map(p=>p.kind)).toEqual(['metal','gem']);
    const centre=ring.bounds.getCenter(new Vector3());
    expect(centre.x).toBeCloseTo(0);expect(centre.z).toBeCloseTo(0);
    expect(ring.bounds.min.y).toBeCloseTo(-1.287);
    expect(ring.bounds.getSize(new Vector3()).x).toBeCloseTo(2);
    const gem=ring.parts.find(p=>p.kind==='gem')!;
    gem.geometry.computeBoundingBox();
    expect(gem.geometry.boundingBox!.max.y).toBeCloseTo(3.213);
    expect(metal.geometry.getAttribute('position').array).toEqual(original);
    expect(ring.parts[0].geometry).not.toBe(metal.geometry);
    ring.dispose();
  });
  it('rejects absent gemstone instead of silently treating an entire ring as diamond',()=>{
    const {scene,gem}=fixture();gem.removeFromParent();
    expect(()=>prepareReferenceRing(scene,-1.295)).toThrow(/gem/i);
  });
  it('disposes only its owned geometry once without destroying loader cache',()=>{
    const {scene,metal}=fixture(),ring=prepareReferenceRing(scene,-1.295);
    let sourceDisposed=0,ownedDisposed=0;
    metal.geometry.addEventListener('dispose',()=>sourceDisposed++);
    ring.parts.forEach(p=>p.geometry.addEventListener('dispose',()=>ownedDisposed++));
    ring.dispose();ring.dispose();
    expect(ownedDisposed).toBe(2);expect(sourceDisposed).toBe(0);
  });
});
