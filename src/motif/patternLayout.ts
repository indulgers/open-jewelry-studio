import {Matrix4, Vector3} from 'three';
import profiles from './profiles.json';
import {necklaceAnchors, type MotifId, type Point3} from './wearableGeometry';

export type PatternMode = 'single' | 'axis' | 'center';
export const PATTERNS: Record<PatternMode, string> = {
  single: '单枚', axis: '轴对称', center: '中心对称',
};

/** Work in the face plane before attaching it to the ring or necklace. */
export function patternLayout(motif: MotifId, mode: PatternMode) {
  const outline = profiles[motif].outline;
  if (mode === 'single') {
    return {
      copies: [new Matrix4()], bridgeHalfWidth: 0, anchors: necklaceAnchors(motif),
      topY: Math.max(...outline.map(point => point[1])),
    };
  }
  const left = new Matrix4().makeRotationZ(Math.PI / 8);
  const rotated = outline.map(([x, y]) => new Vector3(x, y, 0).applyMatrix4(left));
  const bridgeHalfWidth = Math.max(...rotated.map(point => point.x)) + .35;
  left.setPosition(-bridgeHalfWidth, 0, 0);
  const symmetry = mode === 'axis'
    ? new Matrix4().makeScale(-1, 1, 1)
    : new Matrix4().makeRotationZ(Math.PI);
  const copies = [left, symmetry.multiply(left)];
  // Each chain begins on the upper outside shoulder of its own actual outline.
  const shoulders = copies.map((transform, index): Point3 => {
    const side = index === 0 ? -1 : 1;
    const contour = outline.map(([x,y]) => new Vector3(x, y, .58).applyMatrix4(transform));
    const score = (point: Vector3) => point.x * side + point.y;
    const anchor = contour.reduce((best, point) => score(point) > score(best) ? point : best);
    return [anchor.x, anchor.y, anchor.z];
  });
  const topY = Math.max(...rotated.map(point => mode === 'axis' ? point.y : Math.abs(point.y)));
  return {copies, bridgeHalfWidth, anchors: {left: shoulders[0], right: shoulders[1]}, topY};
}
