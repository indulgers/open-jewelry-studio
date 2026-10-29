import {Color,ShaderMaterial} from 'three';
import {expect,it} from 'vitest';
import {createPlanarFloor} from './planarFloor';

it('uses the selected studio floor color and reflection strength',()=>{
  const floor=createPlanarFloor(256,-1.295,'#f4f3ef',0.06);
  const material=floor.reflector.material as ShaderMaterial;
  expect(material.uniforms.color.value.equals(new Color('#f4f3ef'))).toBe(true);
  expect(material.uniforms.strength.value).toBe(0.06);
  floor.dispose();
});

it('owns the planar reflection target and surface without leaking on quality changes',()=>{
  const floor=createPlanarFloor(512,-1.295),target=floor.reflector.getRenderTarget();
  expect(target.width).toBe(512);expect(target.height).toBe(512);
  expect(floor.reflector.position.y).toBeCloseTo(-1.295);
  expect(floor.reflector.userData.excludeFromContactShadow).toBe(true);
  expect(floor.reflector.material).toBeInstanceOf(ShaderMaterial);
  const resources=[target,floor.reflector.geometry,floor.reflector.material as ShaderMaterial],disposed=[0,0,0];
  resources.forEach((resource,i)=>resource.addEventListener('dispose',()=>disposed[i]++));
  floor.dispose();floor.dispose();expect(disposed).toEqual([1,1,1]);
});
