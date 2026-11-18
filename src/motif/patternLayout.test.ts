import {expect, it} from 'vitest';
import {Vector3} from 'three';
import {PRESETS} from './designGrammar';
import {patternLayout} from './patternLayout';

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
