import {BoxGeometry,Color,DataTexture,Matrix4,PerspectiveCamera,Vector2,WebGLRenderTarget,type WebGLRenderer} from 'three';
import {describe,expect,it} from 'vitest';
import {attenuationCoefficients,createGemOptics,syncGemDraw,updateGemOptics} from './gemOptics';
import {STONE_APPEARANCES} from './stoneAppearance';

describe('open gemstone optics',()=>{
  it('derives path-length absorption without tinting a white diamond',()=>{
    expect(attenuationCoefficients(new Color(1,1,1),1).toArray()).toEqual([0,0,0]);
    const coefficients=attenuationCoefficients(new Color(0.5,0.25,1),2);
    expect(Math.exp(-coefficients.x*2)).toBeCloseTo(0.5);
    expect(Math.exp(-coefficients.y*4)).toBeCloseTo(0.0625);
    expect(()=>attenuationCoefficients(new Color('white'),0)).toThrow();
  });
  it('changes the center gem optical path without recreating the mesh',()=>{
    const geometry=new BoxGeometry(),environment=new DataTexture(),owned=createGemOptics(geometry,environment,'standard');
    const originalBvh=owned.material.uniforms.bvh.value;
    updateGemOptics(owned.material,{appearance:'sapphire',dispersion:0.006});
    expect(owned.material.uniforms.ior.value).toBe(STONE_APPEARANCES.sapphire.ior);
    expect(owned.material.uniforms.attenuation.value.length()).toBeGreaterThan(0);
    expect(owned.material.uniforms.aberrationStrength.value).toBeCloseTo(0.006*STONE_APPEARANCES.sapphire.dispersionScale);
    expect(owned.material.uniforms.bvh.value).toBe(originalBvh);
    updateGemOptics(owned.material,{appearance:'diamond'});
    expect(owned.material.uniforms.ior.value).toBe(2.42);
    expect(owned.material.uniforms.attenuation.value.length()).toBeCloseTo(0);
    owned.dispose();geometry.dispose();environment.dispose();
  });
  it('uses actual mirrored/jittered draw camera and framebuffer pixel dimensions',()=>{
    const geometry=new BoxGeometry(),environment=new DataTexture(),owned=createGemOptics(geometry,environment,'standard');
    expect(owned.material.uniforms.stoneDiameter.value).toBeCloseTo(Math.sqrt(3));
    const camera=new PerspectiveCamera(25,1,0.1,50);camera.position.set(1,-3,4);camera.updateMatrixWorld();
    camera.setViewOffset(512,512,0.25,-0.25,512,512);
    let target:WebGLRenderTarget|null=new WebGLRenderTarget(512,512);
    const renderer={getRenderTarget:()=>target,getDrawingBufferSize:(out:Vector2)=>out.set(1800,1200)} as WebGLRenderer;
    syncGemDraw(owned.material,renderer,camera);
    expect(owned.material.uniforms.resolution.value.toArray()).toEqual([512,512]);
    expect(owned.material.uniforms.detailResolution.value.toArray()).toEqual([1800,1200]);
    expect(owned.material.uniforms.viewMatrixInverse.value.equals(camera.matrixWorld)).toBe(true);
    const inverse=owned.material.uniforms.projectionMatrixInverse.value as Matrix4;
    expect(new Matrix4().multiplyMatrices(camera.projectionMatrix,inverse).elements[0]).toBeCloseTo(1);
    expect(inverse.equals(new Matrix4().copy(camera.projectionMatrix).invert())).toBe(true);
    target!.setSize(256,256);syncGemDraw(owned.material,renderer,camera);
    expect(owned.material.uniforms.resolution.value.toArray()).toEqual([256,256]);
    expect(owned.material.uniforms.detailResolution.value.toArray()).toEqual([1800,1200]);
    target!.dispose();target=null;syncGemDraw(owned.material,renderer,camera);
    expect(owned.material.uniforms.resolution.value.toArray()).toEqual([1800,1200]);
    owned.dispose();geometry.dispose();environment.dispose();
  });
  it('owns its BVH textures and material but not the loaded environment or source geometry',()=>{
    const geometry=new BoxGeometry(),environment=new DataTexture(),owned=createGemOptics(geometry,environment,'high');
    const bvh=owned.material.uniforms.bvh.value;
    const resources=[owned.material,bvh.index,bvh.position,bvh.bvhBounds,bvh.bvhContents];
    const disposed=resources.map(()=>0);
    resources.forEach((resource,i)=>resource.addEventListener('dispose',()=>disposed[i]++));
    let sourceDisposed=0;geometry.addEventListener('dispose',()=>sourceDisposed++);environment.addEventListener('dispose',()=>sourceDisposed++);
    owned.dispose();owned.dispose();
    expect(disposed).toEqual([1,1,1,1,1]);expect(sourceDisposed).toBe(0);
    geometry.dispose();environment.dispose();
  });
});
