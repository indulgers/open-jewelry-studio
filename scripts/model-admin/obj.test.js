// @vitest-environment node
import {expect, test} from 'vitest';
import {inspectObj, writeSemanticObj} from './obj.mjs';

const obj = text => Buffer.from(text.trim());

test('splits connected meshes by vertex index and keeps all triangulated faces', () => {
  const mesh = inspectObj(obj(`
v 0 0 0
v 2 0 0
v 2 1 0
v 0 1 0
v 0 0 1
f 1 2 3 4
f 1 4 5
v 0 0 0
v 3 3 0
v 1 3 2
f -3 -2 -1
  `));
  expect(mesh.parts.map(part => [part.id, part.faces.length])).toEqual([[1, 3], [6, 1]]);
  expect(mesh.min).toEqual([0, 0, 0]);
  expect(mesh.max).toEqual([3, 3, 2]);
  expect(mesh.triangleCount).toBe(4);
  expect(writeSemanticObj(mesh, id => id === 1 ? 'band' : 'exclude')).toContain(
    'o metal_1\nf 1 2 3\nf 1 3 4\nf 1 4 5\no unresolved_6\nf 6 7 8',
  );
});

test.each([
  ['v 0 0 0\nf 1 2 3', '无效顶点'],
  ['v 0 0 0\nv 0 1 0\nf 1 2 2', '重复顶点'],
  ['mtllib ./unknown.mtl', '没有可处理'],
])('rejects incomplete or invalid input', (source, error) => {
  expect(() => inspectObj(obj(source))).toThrow(error);
});
