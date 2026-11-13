import {Bounds, Line, OrbitControls} from '@react-three/drei';
import {Canvas, useLoader, useThree} from '@react-three/fiber';
import {Suspense, useEffect, useMemo, useState} from 'react';
import {DoubleSide,Mesh,Vector3} from 'three';
import type {OrbitControls as OrbitControlsImpl} from 'three-stdlib';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

type Props = {url: string; selected?:number[];onPick?:(id:number,multiple:boolean)=>void;view?:'overall'|'front'|'side'; assignments: Record<string, string>;
  anchor: number | null; centerX: number; radius: number};

function Model({url, selected=[],onPick, assignments, onLoaded}: Props & {onLoaded: (url: string) => void}) {
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
      const active = selected.includes(id);
      const role = assignments[id];
      const gem = role ? ['center', 'halo', 'shoulder'].includes(role) : mesh.name.startsWith('gem_');
      return <mesh key={mesh.name} geometry={mesh.geometry} visible={role !== 'exclude' || active} onClick={onPick?event=>{event.stopPropagation();onPick(id,event.shiftKey);}:undefined}>
        <meshStandardMaterial
          color={active ? '#1666bb' : role==='unassigned'?'#c9aa78':gem ? '#e9f1fa' : '#a6a9ae'}
          emissive={active ? '#123a74' : '#000000'} roughness={gem ? 0.24 : 0.39}
        />
      </mesh>;
    })}
  </group>;
}

function View({view='overall'}:Pick<Props,'view'>){
  const camera=useThree(state=>state.camera);
  const controls=useThree(state=>state.controls) as OrbitControlsImpl|undefined;
  const invalidate=useThree(state=>state.invalidate);
  useEffect(()=>{
    if(!controls)return;
    const distance=camera.position.distanceTo(controls.target)||60;
    const direction=view==='front'?new Vector3(0,0,1):view==='side'?new Vector3(1,0,0):new Vector3(30,23,46).normalize();
    camera.position.copy(controls.target).addScaledVector(direction,distance);camera.lookAt(controls.target);controls.update();invalidate();
  },[view,camera,controls,invalidate]);
  return null;
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
      <OrbitControls makeDefault /><View view={props.view}/>
      <Suspense fallback={null}>
        <Bounds fit clip observe margin={1.12} maxDuration={0.15}><Model {...props} onLoaded={setLoaded} /></Bounds>
        {props.anchor !== null && <mesh position={[props.centerX,props.anchor,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[props.radius*2,props.radius]}/><meshBasicMaterial color="#bc9450" transparent opacity={.16} side={DoubleSide} depthWrite={false}/></mesh>}
        {props.anchor !== null && <Line color="#9f7633" lineWidth={1.4}
          points={[[props.centerX - props.radius, props.anchor, 0], [props.centerX + props.radius, props.anchor, 0]]} />}
      </Suspense>
    </Canvas>
    {loaded !== props.url && <p className="preview-message mesh-loading" role="status">正在读取网格…</p>}
  </div>;
}
