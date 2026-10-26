import {ShaderMaterial} from 'three';
import {expect,it} from 'vitest';
import {createPlanarFloor} from './planarFloor';

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
