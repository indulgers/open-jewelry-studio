import {useLayoutEffect,useRef,type ReactNode} from 'react';
import {act,render,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import type {RootState} from '@react-three/fiber';
import {recipeDesign,buildStoneLayout} from './recipe';
import type {BooleanResult} from './solid/manifoldFusion';
import {StoneFirstStage} from './StoneFirstStage';

const harness=vi.hoisted(()=>({state:null as RootState|null,resolve:null as ((v:BooleanResult)=>void)|null,call:vi.fn(),scene:null as THREE.Group|null,texture:null as THREE.Texture|null}));
vi.mock('./solid/manifoldFusion',()=>({fuseDesign:(...args:unknown[])=>{harness.call(...args);return new Promise<BooleanResult>(resolve=>{harness.resolve=resolve;});}}));
vi.mock('@react-three/drei',()=>({useGLTF:()=>({scene:harness.scene}),OrbitControls:()=>null}));
vi.mock('../viewer/JewelryLighting',()=>({JewelryLighting:({children}:{children:(t:THREE.Texture)=>ReactNode})=>children(harness.texture!)}));
vi.mock('../viewer/StudioFillLights',()=>({StudioFillLights:()=>null}));
vi.mock('../viewer/OpticalGem',()=>({OpticalGem:({geometry,position,scale}:any)=><mesh name="main-gem" geometry={geometry} position={position} scale={scale}><meshBasicMaterial/></mesh>}));
vi.mock('@react-three/fiber',async(importOriginal)=>{
 const actual=await importOriginal<typeof import('@react-three/fiber')>();
 actual.extend({Mesh:THREE.Mesh,Group:THREE.Group,InstancedMesh:THREE.InstancedMesh,Color:THREE.Color,AmbientLight:THREE.AmbientLight,MeshBasicMaterial:THREE.MeshBasicMaterial,MeshPhysicalMaterial:THREE.MeshPhysicalMaterial});
 return {...actual,Canvas:({children}:{children:ReactNode})=>{
   const root=useRef<ReturnType<typeof actual.createRoot>|null>(null);
   useLayoutEffect(()=>{
     const canvas=document.createElement('canvas');
     const renderer={render:vi.fn(),setSize:vi.fn(),setPixelRatio:vi.fn(),getPixelRatio:()=>1,
       shadowMap:{enabled:false,type:0},xr:{enabled:false,isPresenting:false,addEventListener:vi.fn(),removeEventListener:vi.fn(),setAnimationLoop:vi.fn()},
       outputColorSpace:'',toneMapping:0,toneMappingExposure:1,domElement:canvas};
     root.current=actual.createRoot(canvas);
     root.current.configure({gl:renderer as any,frameloop:'never',dpr:1,size:{width:500,height:500,top:0,left:0},onCreated:s=>{harness.state=s;}});
     return ()=>{root.current?.unmount();};
   },[]);
   useLayoutEffect(()=>{root.current?.render(children);},[children]);
   return <div data-testid="headless-canvas"/>;
 }};
});
function result(status:'fused'|'fragmented'='fused'):BooleanResult{
 const geometry=new THREE.TorusGeometry(.9,.1,8,24);
 return {geometry,dispose:()=>geometry.dispose(),report:{status,inputCount:3,cutterCount:9,triangles:geometry.index!.count/3,volumeSceneUnits3:1,connectedComponents:status==='fused'?1:9,componentVolumes:[1],componentBounds:[{min:[-1,-1,-1],max:[1,1,1]}],rawConnectedComponents:status==='fused'?1:9,ignoredNumericalComponents:0,minSurfaceWallMm:null,socketResidualVolume:0,clearanceValidated:false,manufacturingPassed:false,warnings:[]}};
}
async function resolveMetal(value:BooleanResult){
 await waitFor(()=>expect(harness.resolve).not.toBeNull());
 await act(async()=>{harness.resolve!(value);});
 await waitFor(()=>expect(harness.state).not.toBeNull());
}
function findInstances(){let instance:THREE.InstancedMesh|undefined;harness.state!.scene.traverse(o=>{if(o instanceof THREE.InstancedMesh)instance=o;});return instance;}
function metalMeshes(){const out:THREE.Mesh[]=[];harness.state!.scene.traverse(o=>{if(o instanceof THREE.Mesh&&o.name.includes('metal'))out.push(o);});return out;}
beforeEach(()=>{
 harness.call.mockClear();harness.resolve=null;harness.state=null;
 harness.scene=new THREE.Group();harness.scene.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1,1)));
 harness.texture=new THREE.Texture();
});
afterEach(()=>{harness.texture?.dispose();});
describe('real R3F scene across asynchronous metal assembly',()=>{
 it('initializes every accent transform when the deferred metal first mounts',async()=>{
  const d=recipeDesign('floral-pave');
  render(<StoneFirstStage design={d} quality="standard" studio="contrast"/>);
  await resolveMetal(result());
  await waitFor(()=>expect(findInstances()).toBeDefined());
  const mesh=findInstances()!,sites=buildStoneLayout(d).filter(s=>s.kind==='accent');
  const matrix=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();
  expect(mesh.count).toBe(sites.length);
  sites.forEach((s,i)=>{mesh.getMatrixAt(i,matrix);matrix.decompose(p,q,scale);
    expect(p.x).toBeCloseTo(s.x,5);expect(p.y).toBeCloseTo(s.y,5);expect(p.z).toBeCloseTo(s.z,5);
    expect(scale.x).toBeCloseTo(s.diameter/2,5);
  });
 });
 it('shows inspectable geometry on fragmented validation, without claiming a pass',async()=>{
  render(<StoneFirstStage design={recipeDesign('floral-pave')} quality="standard" studio="contrast"/>);
  await resolveMetal(result('fragmented'));
  expect(document.querySelector('.stone-first-canvas')).toHaveAttribute('data-solid-status','fragmented');
  expect(metalMeshes().length).toBeGreaterThan(0);
 });
 it('keeps the last coherent metal and stone snapshot during a rebuild',async()=>{
  const a=recipeDesign('floral-pave'),b={...a,accentDiameter:1.2};
  const view=render(<StoneFirstStage design={a} quality="standard" studio="contrast"/>);
  await resolveMetal(result());
  const oldMetal=metalMeshes()[0],oldCount=findInstances()!.count;
  await act(async()=>{view.rerender(<StoneFirstStage design={b} quality="standard" studio="contrast"/>);});
  expect(document.querySelector('.stone-first-canvas')).toHaveAttribute('data-solid-status','loading');
  expect(metalMeshes()[0]).toBe(oldMetal);expect(findInstances()!.count).toBe(oldCount);
  await resolveMetal(result());
  const mesh=findInstances()!,m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),sc=new THREE.Vector3();
  const sites=buildStoneLayout(b).filter(s=>s.kind==='accent');
  expect(mesh.count).toBe(sites.length);mesh.getMatrixAt(0,m);m.decompose(p,q,sc);
  expect(sc.x).toBeCloseTo(sites[0].diameter/2,5);
 });
 it('discards an obsolete asynchronous assembly rather than overwriting the newer design',async()=>{
  const a=recipeDesign('floral-pave'),b={...a,accentDiameter:1.2};
  const view=render(<StoneFirstStage design={a} quality="standard" studio="contrast"/>);
  await waitFor(()=>expect(harness.resolve).not.toBeNull());
  const resolveOld=harness.resolve!;
  await act(async()=>{view.rerender(<StoneFirstStage design={b} quality="standard" studio="contrast"/>);});
  const newer=result(),older=result();const dispose=vi.spyOn(older,'dispose');
  await resolveMetal(newer);
  await act(async()=>{resolveOld(older);});
  expect(dispose).toHaveBeenCalledOnce();
  expect(metalMeshes()[0].geometry).toBe(newer.geometry);
 });
});
