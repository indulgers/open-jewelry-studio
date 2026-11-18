import {Box3, InstancedMesh, Matrix4, Mesh, Vector3, type Object3D} from 'three';

/** Fit visible geometry in camera space. The orthographic frustum uses CSS pixels before zoom. */
export function frameMotifModel(subject: Object3D, direction: Vector3, width: number, height: number) {
  if (width <= 0 || height <= 0) return;
  const cameraBasis = new Matrix4().lookAt(direction, new Vector3(), new Vector3(0, 1, 0));
  const worldToCamera = cameraBasis.clone().invert();
  const bounds = new Box3();
  const localBounds = new Box3();
  const transform = new Matrix4();
  subject.updateWorldMatrix(true, true);
  subject.traverseVisible(node => {
    if (!(node instanceof Mesh)) return;
    const shape = node instanceof InstancedMesh ? node : node.geometry;
    if (!shape.boundingBox) shape.computeBoundingBox();
    if (!shape.boundingBox || shape.boundingBox.isEmpty()) return;
    transform.multiplyMatrices(worldToCamera, node.matrixWorld);
    bounds.union(localBounds.copy(shape.boundingBox).applyMatrix4(transform));
  });
  if (bounds.isEmpty()) return;
  const extent = bounds.getSize(new Vector3());
  return {
    target: bounds.getCenter(new Vector3()).applyMatrix4(cameraBasis),
    zoom: .86 * Math.min(width / Math.max(.1, extent.x), height / Math.max(.1, extent.y)),
  };
}
