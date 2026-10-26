import {describe, expect, it} from 'vitest';
import {Box3, Vector3} from 'three';
import {createRingGeometry, createSettingGeometry} from './ringGeometry';
import {getGemPlacement, stoneScale} from './gemPlacement';

describe('ring geometry', () => {
  it('closes the prong tips and feet so close inspection cannot look inside hollow metal',()=>{
    const setting=createSettingGeometry('medium');
    for(const geometry of setting){
      const p=geometry.attributes.position,idx=geometry.index!;
      const vertex=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(n=>Math.round(n*100000)).join(',');
      const edges=new Map<string,number>();
      for(let i=0;i<idx.count;i+=3){
        const points=[vertex(idx.getX(i)),vertex(idx.getX(i+1)),vertex(idx.getX(i+2))];
        if(new Set(points).size<3)continue;
        for(let e=0;e<3;e++){
          const key=[points[e],points[(e+1)%3]].sort().join('|');
          edges.set(key,(edges.get(key)??0)+1);
        }
      }
      expect([...edges.values()].filter(count=>count!==2)).toHaveLength(0);
    }
    for(const geometry of setting)geometry.dispose();
  });
  it('ties the prong feet into a lower basket rather than leaving four exposed stems',()=>{
    const setting=createSettingGeometry('medium');
    let distance=Infinity;
    for(const g of setting){const p=g.attributes.position;for(let i=0;i<p.count;i++)
      distance=Math.min(distance,Math.hypot(p.getX(i),p.getY(i)-1.18,p.getZ(i)-0.10));}
    expect(distance).toBeLessThan(0.027);
    for(const g of setting)g.dispose();
  });
  it('keeps each split shoulder joined to the small-stone setting',()=>{
    const ring=createRingGeometry('split','small'),setting=createSettingGeometry('small');
    for(const shoulder of ring.slice(1)){
      const p=shoulder.attributes.position;
      let distance=Infinity;
      for(let i=p.count-13;i<p.count;i++)for(const item of setting){
        const q=item.attributes.position;
        for(let j=0;j<q.count;j++)distance=Math.min(distance,Math.hypot(p.getX(i)-q.getX(j),p.getY(i)-q.getY(j),p.getZ(i)-q.getZ(j)));
      }
      expect(distance).toBeLessThan(0.018);
    }
    for(const g of [...ring,...setting])g.dispose();
  });
  it('closes the split band ends so close-ups do not expose hollow sections',()=>{
    const [band]=createRingGeometry('split');
    const p=band.attributes.position,idx=band.index!;
    const vertex=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(n=>Math.round(n*100000)).join(',');
    const edges=new Map<string,number>();
    for(let i=0;i<idx.count;i+=3){
      const points=[vertex(idx.getX(i)),vertex(idx.getX(i+1)),vertex(idx.getX(i+2))];
      for(let e=0;e<3;e++){
        const key=[points[e],points[(e+1)%3]].sort().join('|');
        edges.set(key,(edges.get(key)??0)+1);
      }
    }
    expect([...edges.values()].filter(count=>count!==2)).toHaveLength(0);
    band.dispose();
  });
  it('has a broad comfort-fit inner face instead of a round wire cross-section',()=>{
    const [band]=createRingGeometry('plain');
    const p=band.attributes.position;
    const innerBottom=[];
    for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))<0.0001&&p.getY(i)<-1&&p.getY(i)>-1.065)
      innerBottom.push(p.getZ(i));
    expect(Math.max(...innerBottom)-Math.min(...innerBottom)).toBeGreaterThan(0.18);
    band.dispose();
  });
  it('makes distinct plain and split constructions with finite geometry', () => {
    const plain=createRingGeometry('plain');
    const split=createRingGeometry('split');
    expect(plain.length).toBe(1);
    expect(split.length).toBeGreaterThan(plain.length);
    for(const geometry of [...plain,...split]) {
      expect([...geometry.attributes.position.array].every(Number.isFinite)).toBe(true);
      geometry.computeBoundingBox();
      expect(geometry.boundingBox!.getSize(new Vector3()).length()).toBeGreaterThan(0.1);
      geometry.dispose();
    }
  });
  it('never shares disposable geometry between assemblies', () => {
    const a=createRingGeometry('plain'),b=createRingGeometry('plain');
    expect(a[0]).not.toBe(b[0]);
    a[0].dispose();
    expect(b[0].attributes.position.count).toBeGreaterThan(0);
    b[0].dispose();
  });
  it('adapts the setting width when the visual stone size changes', () => {
    const a=createSettingGeometry('small'),b=createSettingGeometry('large');
    const extents=(items:typeof a)=>{
      const box=new Box3();
      for(const g of items){g.computeBoundingBox();box.union(g.boundingBox!);}
      return box.getSize(new Vector3());
    };
    expect(extents(b).x).toBeGreaterThan(extents(a).x);
    for(const g of [...a,...b])g.dispose();
  });
});

describe('gem placement', () => {
  it('scales only the stone into the requested envelope', () => {
    const box=new Box3(new Vector3(-1,-0.6665,-1),new Vector3(1,0.6665,1));
    expect(getGemPlacement(box,'medium').scale).toBeCloseTo(0.325);
    expect(getGemPlacement(box,'large').scale).toBeGreaterThan(getGemPlacement(box,'small').scale);
    expect(stoneScale('small')).toBe(0.85);
    expect(stoneScale('large')).toBe(1.15);
  });
  it('rejects empty, zero-width and invalid envelopes', () => {
    expect(()=>getGemPlacement(new Box3(),'medium')).toThrow();
    expect(()=>getGemPlacement(new Box3(new Vector3(),new Vector3(0,1,0)),'medium')).toThrow();
  });
});
