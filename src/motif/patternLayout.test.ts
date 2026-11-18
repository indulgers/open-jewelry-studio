import {expect, it} from 'vitest';
import {Vector3} from 'three';
import {PRESETS} from './designGrammar';
import {patternLayout,sideChainAnchors} from './patternLayout';
import {createPetalSolid} from './designGeometry';

it.each(PRESETS)('keeps the original $name and constructs distinct mirror and half-turn pairs', preset => {
  const single = patternLayout(preset.motif, 'single');
  expect(single.copies).toHaveLength(1);
  const point = new Vector3(4.1, -2.3, .7);
  expect(point.clone().applyMatrix4(single.copies[0]).toArray()).toEqual(point.toArray());
  for (const mode of ['axis', 'center'] as const) {
    const layout = patternLayout(preset.motif, mode);
    const [left, right] = layout.copies.map(matrix => point.clone().applyMatrix4(matrix));
    expect(right.x).toBeCloseTo(-left.x);
    expect(right.y).toBeCloseTo(mode === 'axis' ? left.y : -left.y);
    expect(right.z).toBeCloseTo(left.z);
    expect(layout.anchors.left[0]).toBeLessThan(-5);
    expect(layout.anchors.right[0]).toBeGreaterThan(5);
    expect(layout.bridgeHalfWidth).toBeGreaterThan(3);
  }
});


it.each(['single','axis','center'] as const)('attaches both side rings to the actual sculpted petal metal in %s mode',mode=>{
  const petals=Array.from({length:5},(_,i)=>createPetalSolid(i*2*Math.PI/5));
  try{
    for(const motif of ['flower','blossom'] as const){
      const layout=patternLayout(motif,mode);
      for(const technique of ['sculpted','pave','cluster'] as const){
        for(const scale of [12/15,1,20/15]){
          const anchors=sideChainAnchors(motif,technique,layout,scale);
          for(const [index,anchor] of [anchors.left,anchors.right].entries()){
            const transform=layout.copies[index]??layout.copies[0];
            let nearest=Infinity;
            for(const petal of petals){
              const positions=petal.getAttribute('position');
              for(let i=0;i<positions.count;i++){
                const p=new Vector3().fromBufferAttribute(positions,i).applyMatrix4(transform).multiplyScalar(scale);
                const radial=Math.hypot(p.x-anchor[0],p.y-anchor[1]);
                nearest=Math.min(nearest,Math.hypot(radial-.46,p.z-anchor[2]));
              }
            }
            // A visual metal contact must reach inside the connector's .115 mm wire.
            expect(nearest).toBeLessThan(.105);
          }
        }
      }
    }
  }finally{petals.forEach(petal=>petal.dispose());}
});
