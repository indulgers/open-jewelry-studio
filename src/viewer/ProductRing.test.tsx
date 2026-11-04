import {render} from '@testing-library/react';
import {BoxGeometry,DataTexture,Group,Mesh,MeshStandardMaterial} from 'three';
import {afterEach,expect,it,vi} from 'vitest';
import {ProductRing} from './ProductRing';
import * as mountGeometry from './mountGeometry';
import {STUDIO_PRESETS} from './studioPresets';

const source=vi.hoisted(()=>({scene:null as unknown}));
const load=vi.hoisted(()=>vi.fn());
vi.mock('@react-three/drei',()=>({useGLTF:load}));
vi.mock('./OpticalGem',()=>({OpticalGem:()=>null}));
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals()});
it('does not build the mount or bake occlusion on the page thread while loading a ring',()=>{
  const scene=new Group(),metal=new Mesh(new BoxGeometry(),new MeshStandardMaterial()),gem=new Mesh(new BoxGeometry(.2,.2,.2),new MeshStandardMaterial());
  metal.name='gold';gem.name='diamond';gem.position.y=1;scene.add(metal,gem);source.scene=scene;
  load.mockReturnValue([source]);
  const build=vi.spyOn(mountGeometry,'createMountGeometry'),bake=vi.spyOn(mountGeometry,'bakeMetalOcclusion'),ready=vi.fn();
  const terminate=vi.fn(),post=vi.fn();
  vi.stubGlobal('Worker',class {postMessage=post;terminate=terminate;onmessage=null;onerror=null;});
  vi.spyOn(console,'error').mockImplementation(()=>{});
  const view=render(<ProductRing ringStyle="solitaire" metal="yellow" environment={new DataTexture()} quality="standard" simplified={false} onReady={ready} preset={STUDIO_PRESETS.catalog}/>);
  expect(build).not.toHaveBeenCalled();
  expect(bake).not.toHaveBeenCalled();
  expect(ready).not.toHaveBeenCalled();
  expect(load).toHaveBeenCalledWith(['/models/webgi/ring2_webgi3.glb'],'/draco/');
  expect(post).toHaveBeenCalledTimes(1);
  view.unmount();expect(terminate).toHaveBeenCalledTimes(1);metal.geometry.dispose();gem.geometry.dispose();
});
