import {Color,Mesh,MeshBasicMaterial,Scene,WebGLRenderTarget,type WebGLRenderer} from 'three';
import {describe,expect,it} from 'vitest';
import {createContactShadowResources,renderContactShadow} from './contactShadowResources';

describe('owned contact-shadow resources',()=>{
  it('releases every private target, geometry and material exactly once',()=>{
    const resources=createContactShadowResources(256);
    const owned=[resources.target,resources.blurTarget,resources.planeGeometry,resources.quadGeometry,
      resources.depthMaterial,resources.horizontalMaterial,resources.verticalMaterial,resources.displayMaterial];
    const disposed=owned.map(()=>0);
    owned.forEach((resource,index)=>resource.addEventListener('dispose',()=>disposed[index]++));
    resources.dispose();resources.dispose();
    expect(disposed).toEqual([1,1,1,1,1,1,1,1]);
  });

  it('restores the beauty scene and render target even when a shadow render fails',()=>{
    const resources=createContactShadowResources(256),scene=new Scene(),ground=new Mesh();
    const background=new Color('#eeeae2'),override=new MeshBasicMaterial(),initialTarget=new WebGLRenderTarget();
    scene.background=background;scene.overrideMaterial=override;
    const reflector=new Mesh();reflector.userData.excludeFromContactShadow=true;scene.add(reflector);
    let excludedDuringCapture=false;
    let target:WebGLRenderTarget|null=initialTarget,clearColor=new Color('red'),clearAlpha=0.7;
    // Only the GPU boundary is replaced; the resource owner and Three.js scene stay real.
    const renderer={autoClear:false,
      getRenderTarget:()=>target,setRenderTarget:(value:WebGLRenderTarget|null)=>{target=value;},
      getClearColor:(out:Color)=>out.copy(clearColor),getClearAlpha:()=>clearAlpha,
      setClearColor:(value:Color|number,alpha:number)=>{clearColor=new Color(value);clearAlpha=alpha;},
      clear:()=>{},render:()=>{excludedDuringCapture=!reflector.visible;throw new Error('GPU capture failed');},
    } as unknown as WebGLRenderer;
    expect(()=>renderContactShadow(renderer,scene,ground,resources,1)).toThrow('GPU capture failed');
    expect(scene.background).toBe(background);expect(scene.overrideMaterial).toBe(override);
    expect(ground.visible).toBe(true);expect(target).toBe(initialTarget);
    expect(clearColor.getHexString()).toBe('ff0000');expect(clearAlpha).toBe(0.7);
    expect(renderer.autoClear).toBe(false);
    expect(excludedDuringCapture).toBe(true);expect(reflector.visible).toBe(true);
    resources.dispose();override.dispose();initialTarget.dispose();
  });
});
