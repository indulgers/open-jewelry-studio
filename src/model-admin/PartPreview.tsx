import {Bounds, Line, OrbitControls} from '@react-three/drei';
import {Canvas, useLoader} from '@react-three/fiber';
import {Suspense, useEffect, useMemo, useState} from 'react';
import {Mesh} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

type Props = {url: string; highlight: number | null; assignments: Record<string, string>;
  anchor: number | null; centerX: number; radius: number};

function Model({url, highlight, assignments, onLoaded}: Props & {onLoaded: (url: string) => void}) {
  const {scene} = useLoader(GLTFLoader, url, loader => loader.setMeshoptDecoder(MeshoptDecoder));
  const meshes = useMemo(() => scene.children.filter((child): child is Mesh => {
    if (!(child instanceof Mesh) || child.name === 'metal_reflow_shank') return false;
    if (!child.geometry.hasAttribute('normal')) child.geometry.computeVertexNormals();
    return true;
  }), [scene]);
  useEffect(() => {onLoaded(url);}, [onLoaded, url]);
  return <group dispose={null}>
    {meshes.map(mesh => {
      const id = Number(mesh.name.split('_').at(-1));
      const active = highlight === id;
      const role = assignments[id];
      const gem = role ? ['center', 'halo', 'shoulder'].includes(role) : mesh.name.startsWith('gem_');
      return <mesh key={mesh.name} geometry={mesh.geometry} visible={role !== 'exclude' || active}>
        <meshStandardMaterial
          color={active ? '#1666bb' : gem ? '#e9f1fa' : '#a6a9ae'}
          emissive={active ? '#123a74' : '#000000'} roughness={gem ? 0.24 : 0.39}
        />
      </mesh>;
    })}
  </group>;
}

export default function PartPreview(props: Props) {
  const [loaded, setLoaded] = useState('');
  return <div className="part-preview">
    <Canvas orthographic camera={{position: [30, 23, 46]}} dpr={[1, 1.5]}
      frameloop="demand" aria-label="三维模型预览">
      <color attach="background" args={['#f5f3ef']} />
      <ambientLight intensity={1.7} />
      <directionalLight position={[4, 8, 8]} intensity={2.3} />
      <directionalLight position={[-6, 3, -4]} intensity={1} />
      <OrbitControls makeDefault />
      <Suspense fallback={null}>
        <Bounds fit clip observe margin={1.24} maxDuration={0.15}><Model {...props} onLoaded={setLoaded} /></Bounds>
        {props.anchor !== null && <Line color="#9f7633" lineWidth={1.4}
          points={[[props.centerX - props.radius, props.anchor, 0], [props.centerX + props.radius, props.anchor, 0]]} />}
      </Suspense>
    </Canvas>
    {loaded !== props.url && <p className="preview-message mesh-loading" role="status">正在读取网格…</p>}
  </div>;
}
