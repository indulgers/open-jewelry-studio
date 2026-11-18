import {describe, expect, it} from 'vitest';
import {BoxGeometry, Group, Mesh, OrthographicCamera, Vector3} from 'three';
import {frameMotifModel} from './previewFrame';

function makeNecklace() {
  const assembly = new Group();
  const face = new Mesh(new BoxGeometry(15, 15, 2));
  face.name = '01-03-face-and-setting';
  assembly.add(face);
  for (const x of [-17, 17]) {
    const link = new Mesh(new BoxGeometry(1, 1, 1));
    link.position.set(x, 31, 0);
    assembly.add(link);
  }
  return assembly;
}

describe('motif preview framing', () => {
  it.each([[284, 180], [688, 490]])('keeps the whole preview inside %i × %i including the ends of the chain', (width, height) => {
    const camera = new OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, .1, 400);
    const direction = new Vector3(1, .3, 2).normalize();
    const frame = frameMotifModel(makeNecklace(), direction, width, height);
    expect(frame).toBeDefined();
    camera.position.copy(frame!.target).addScaledVector(direction, 80);
    camera.lookAt(frame!.target);
    camera.zoom = frame!.zoom;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    for (const point of [[-17.5, 31.5, .5], [17.5, 31.5, -.5], [-7.5, -7.5, 1], [7.5, -7.5, 1]]) {
      const projected = new Vector3(...point).project(camera);
      expect(Math.abs(projected.x)).toBeLessThan(.95);
      expect(Math.abs(projected.y)).toBeLessThan(.95);
    }
  });
});
