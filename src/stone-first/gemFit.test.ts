import {describe,expect,it} from 'vitest';
import {BufferGeometry,Float32BufferAttribute} from 'three';
import {prepareGirdleGem} from './gemFit';
describe('stone seating datum',()=>{
 it('places girdle at zero, preserving the crown above and pavilion below a metal aperture',()=>{
  // A deliberately asymmetric faceted gemstone; bbox center is NOT the girdle.
  const points:number[]=[];
  const n=16;
  for(let i=0;i<n;i++){
   const a=2*Math.PI*i/n;
   points.push(Math.cos(a),0,Math.sin(a));
  }
  for(let i=0;i<n;i++){
   const a=2*Math.PI*i/n;
   points.push(.4*Math.cos(a),.6,.4*Math.sin(a));
  }
  for(let i=0;i<n;i++){
   const a=2*Math.PI*i/n;
   points.push(.0,-1.1,.0);
  }
  const g=new BufferGeometry();
  g.setAttribute('position',new Float32BufferAttribute(points,3));
  const prepared=prepareGirdleGem(g);
  const p=prepared.geometry.getAttribute('position');
  let max=Number.NEGATIVE_INFINITY,min=Number.POSITIVE_INFINITY;
  for(let i=0;i<p.count;i++){max=Math.max(max,p.getY(i));min=Math.min(min,p.getY(i));}
  expect(max).toBeGreaterThan(.5);
  expect(min).toBeLessThan(-.9);
  for(let i=0;i<n;i++)expect(Math.abs(p.getY(i))).toBeLessThan(1e-6);
  prepared.geometry.dispose();g.dispose();
 });
});
