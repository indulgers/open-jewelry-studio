import {expect,it} from 'vitest';
import {isNumericalShell} from './numericalShell';
it('distinguishes observed zero-volume CSG shells from real detached metal',()=>{
 expect(isNumericalShell({volume:5.8e-17,bounds:{min:[0,0,0],max:[.0005,.0002,.0003]}})).toBe(true);
 expect(isNumericalShell({volume:.00000478,bounds:{min:[0,0,0],max:[.02,.02,.02]}})).toBe(false);
 expect(isNumericalShell({volume:0,bounds:{min:[0,0,0],max:[1,.001,1]}})).toBe(false);
 expect(isNumericalShell({volume:-.0003,bounds:{min:[0,0,0],max:[.1,.1,.1]}})).toBe(false);
 expect(isNumericalShell({volume:NaN,bounds:{min:[0,0,0],max:[.0001,.0001,.0001]}})).toBe(false);
});
