import {describe, expect, it} from 'vitest';
import profiles from './profiles.json';

const polygonArea=(points:number[][])=>points.reduce((sum,p,i)=>{
  const next=points[(i+1)%points.length];
  return sum+p[0]*next[1]-next[0]*p[1];
},0)/2;

describe('user OBJ motif contours',()=>{
  it('imports all seven distinct contours',()=>{
    expect(Object.keys(profiles)).toHaveLength(7);
    expect(new Set(Object.values(profiles).map(item=>item.src)).size).toBe(7);
  });
  it.each(Object.entries(profiles))('%s has a valid normalized positive-area outline',(_id,profile)=>{
    expect(profile.outline.length).toBeGreaterThan(20);
    expect(profile.outline.every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y))).toBe(true);
    const range=(axis:number)=>Math.max(...profile.outline.map(p=>p[axis]))-Math.min(...profile.outline.map(p=>p[axis]));
    expect(Math.max(range(0),range(1))).toBeCloseTo(15,0);
    expect(polygonArea(profile.outline)).toBeGreaterThan(20);
    expect(profile.faces).toBeGreaterThan(1000);
  });
});
