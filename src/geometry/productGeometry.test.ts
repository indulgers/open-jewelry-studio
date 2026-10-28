import {BoxGeometry,Group,Mesh,MeshBasicMaterial,Vector3} from 'three';
import {describe,expect,it} from 'vitest';
import {normalizeLooseGem,fitRoundGem,prepareProductRing} from './productGeometry';

describe('atelier asset preparation',()=>{
  it('normalizes without stretching the cut or changing source geometry',()=>{
    const source=new BoxGeometry(5,3,10);source.translate(2,1,4);
    const before=source.getAttribute('position').array.slice();
    const result=normalizeLooseGem(source);result.computeBoundingBox();
    const size=result.boundingBox!.getSize(new Vector3());expect(size.x).toBeCloseTo(1);expect(size.y).toBeCloseTo(0.6);expect(size.z).toBeCloseTo(2);
    expect(result.boundingBox!.getCenter(new Vector3()).length()).toBeLessThan(1e-6);
    expect(source.getAttribute('position').array).toEqual(before);result.dispose();source.dispose();
  });
  it('fits round diameter uniformly and preserves pavilion/crown proportions',()=>{
    const source=new BoxGeometry(10,6.4,10),target=new BoxGeometry(0.6,0.4,0.6);target.translate(0,1.3,0);
    const result=fitRoundGem(source,target);result.computeBoundingBox();
    const size=result.boundingBox!.getSize(new Vector3());
    expect(size.x).toBeCloseTo(0.6);expect(size.y/size.x).toBeCloseTo(0.64);
    expect(result.boundingBox!.getCenter(new Vector3()).y).toBeCloseTo(1.3);
    result.dispose();source.dispose();target.dispose();
  });
  it('replaces only the center stone while preserving shared side-stone source geometry',()=>{
    const scene=new Group(),shared=new BoxGeometry(0.6,0.4,0.6),metal=new Mesh(new BoxGeometry(2,2,0.2));metal.name='RingSilver';
    const center=new Mesh(shared),side=new Mesh(shared);center.name='CenterDiamond';side.name='HaloDiamond.001';side.position.x=0.8;side.scale.setScalar(0.2);
    scene.add(metal,center,side);const replacement=new Group();replacement.add(new Mesh(new BoxGeometry(10,6.4,10),new MeshBasicMaterial()));
    const before=shared.getAttribute('position').array.slice(),result=prepareProductRing(scene,replacement);
    expect(result.gems).toHaveLength(2);expect(result.metals).toHaveLength(1);
    expect(result.gems[0].geometry).not.toBe(shared);expect(shared.getAttribute('position').array).toEqual(before);
    let disposed=0;result.gems[0].geometry.addEventListener('dispose',()=>disposed++);result.dispose();result.dispose();expect(disposed).toBe(1);
  });
  it('rejects zero-sized stone geometry',()=>{const bad=new BoxGeometry(0,1,0);expect(()=>normalizeLooseGem(bad)).toThrow();bad.dispose();});
});
