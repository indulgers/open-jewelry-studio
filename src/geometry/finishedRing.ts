import {Box3, Euler, Matrix4, Mesh, Vector3, type BufferGeometry, type Object3D} from 'three';
import {GROUND_Y} from '../viewer/contactShadowResources';
import {fitRoundGem} from './productGeometry';

export type FinishedPart = {name: string; kind: 'metal' | 'gem'; geometry: BufferGeometry};
export type FinishedRingGeometry = {
  metals: FinishedPart[];
  gems: FinishedPart[];
  bounds: Box3;
  dispose: () => void;
};

const METAL = /gold|silver|alliance|entourage|platinum|metal|shank|band|setting|mount/i;
const GEM = /diamond|gemstone|gem\b|stone|dia\d|object/i;

function classify(mesh: Mesh): 'metal' | 'gem' | null {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const materialNames = materials.map((material) => material?.name ?? '').join(' ');
  if (METAL.test(mesh.name) || METAL.test(materialNames)) return 'metal';
  if (GEM.test(mesh.name) || GEM.test(materialNames)) return 'gem';
  return null;
}

function firstGeometry(scene: Object3D): BufferGeometry {
  scene.updateWorldMatrix(true, true);
  let result: BufferGeometry | null = null;
  scene.traverse((object) => {
    if (!result && object instanceof Mesh) result = object.geometry.clone().applyMatrix4(object.matrixWorld);
  });
  if (!result) throw new Error('Missing replacement stone');
  return result as BufferGeometry;
}

export function prepareFinishedRing(
  scene: Object3D,
  options: {
    rotation?: [number, number, number];
    targetHeight?: number;
    replaceCenter?: boolean;
    replacement?: Object3D;
  } = {},
): FinishedRingGeometry {
  const {rotation = [0, 0, 0], targetHeight = 2.5, replaceCenter = false, replacement} = options;
  scene.updateWorldMatrix(true, true);
  const roll = new Matrix4().makeRotationFromEuler(new Euler(...rotation));
  const metals: FinishedPart[] = [];
  const gems: FinishedPart[] = [];
  const box = new Box3();
  const replacementGeometry = replaceCenter && replacement ? firstGeometry(replacement) : null;
  let replacedCenter = false;

  try {
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const kind = classify(object);
      if (!kind) return;
      let geometry = object.geometry.clone().applyMatrix4(object.matrixWorld).applyMatrix4(roll);
      if (replaceCenter && replacementGeometry && /center/i.test(object.name)) {
        const next = fitRoundGem(replacementGeometry, geometry);
        geometry.dispose();
        geometry = next;
        replacedCenter = true;
      }
      geometry.computeBoundingBox();
      box.union(geometry.boundingBox!);
      (kind === 'metal' ? metals : gems).push({name: object.name, kind, geometry});
    });

    if (!metals.length) throw new Error('Missing metal parts');
    if (!gems.length) throw new Error('Missing gemstone parts');
    if (replaceCenter && !replacedCenter) throw new Error('Missing centre stone');

    const size = box.getSize(new Vector3());
    if (!Number.isFinite(size.y) || size.y <= 1e-6) throw new Error('Invalid ring dimensions');
    const scale = targetHeight / size.y;
    const centered = box.getCenter(new Vector3());
    const offset = new Vector3(-centered.x * scale, GROUND_Y + 0.008 - box.min.y * scale, -centered.z * scale);
    for (const part of [...metals, ...gems]) {
      part.geometry.scale(scale, scale, scale).translate(offset.x, offset.y, offset.z);
      part.geometry.computeBoundingBox();
    }
    box.translate(offset);
  } catch (error) {
    [...metals, ...gems].forEach((part) => part.geometry.dispose());
    throw error;
  } finally {
    replacementGeometry?.dispose();
  }

  let disposed = false;
  return {
    metals,
    gems,
    bounds: box,
    dispose() {
      if (disposed) return;
      disposed = true;
      [...metals, ...gems].forEach((part) => part.geometry.dispose());
    },
  };
}
