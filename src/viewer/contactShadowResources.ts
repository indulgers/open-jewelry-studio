import {Color,DoubleSide,Mesh,MeshDepthMaterial,OrthographicCamera,PlaneGeometry,
  Scene,ShaderMaterial,UniformsUtils,WebGLRenderTarget,type WebGLRenderer} from 'three';
import {HorizontalBlurShader,VerticalBlurShader} from 'three-stdlib';

export const GROUND_Y=-1.295;

// Based on drei's MIT contact-shadow depth/blur technique, with explicit ownership.
// Nothing allocated here relies on React traversing a private render target to dispose it.
export function createContactShadowResources(resolution:number){
  const target=new WebGLRenderTarget(resolution,resolution),blurTarget=new WebGLRenderTarget(resolution,resolution);
  target.texture.generateMipmaps=blurTarget.texture.generateMipmaps=false;
  const planeGeometry=new PlaneGeometry(8,8),quadGeometry=new PlaneGeometry(2,2);
  const depthMaterial=new MeshDepthMaterial();
  depthMaterial.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace(
      'vec4( vec3( 1.0 - fragCoordZ ), opacity );',
      'vec4( vec3( 0.0 ), 1.0 - fragCoordZ );',
    );
  };
  const horizontalMaterial=new ShaderMaterial({...HorizontalBlurShader,
    uniforms:UniformsUtils.clone(HorizontalBlurShader.uniforms),depthTest:false,depthWrite:false});
  const verticalMaterial=new ShaderMaterial({...VerticalBlurShader,
    uniforms:UniformsUtils.clone(VerticalBlurShader.uniforms),depthTest:false,depthWrite:false});
  // A finite ground plane would otherwise end in a visible horizon seam on the
  // transparent canvas. Fade the alpha well before the plane edge; the shadow itself
  // stays inside the central third of the texture.
  const displayMaterial=new ShaderMaterial({
    uniforms:{map:{value:target.texture},opacity:{value:0.72}},
    vertexShader:/* glsl */`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:/* glsl */`uniform sampler2D map;uniform float opacity;varying vec2 vUv;
      void main(){
        vec4 shadow=texture2D(map,vUv);
        float edge=1.0-smoothstep(0.22,0.34,max(abs(vUv.x-0.5),abs(vUv.y-0.5)));
        gl_FragColor=vec4(vec3(0.0),shadow.a*opacity*edge);
      }`,
    transparent:true,depthWrite:false,side:DoubleSide,
  });
  // Only geometry close to the sweep casts this contact shadow.
  const shadowCamera=new OrthographicCamera(-4,4,4,-4,0,0.72);
  shadowCamera.position.set(0,GROUND_Y,0);shadowCamera.up.set(0,0,1);
  shadowCamera.lookAt(0,1,0);shadowCamera.updateMatrixWorld();
  const quadCamera=new OrthographicCamera(-1,1,1,-1,0,2);
  quadCamera.position.z=1;quadCamera.updateMatrixWorld();
  const quadScene=new Scene(),quad=new Mesh(quadGeometry,horizontalMaterial);
  quad.frustumCulled=false;quadScene.add(quad);
  let disposed=false;
  return {target,blurTarget,planeGeometry,quadGeometry,depthMaterial,horizontalMaterial,verticalMaterial,
    displayMaterial,shadowCamera,quadCamera,quadScene,quad,
    dispose(){
      if(disposed)return;disposed=true;
      target.dispose();blurTarget.dispose();planeGeometry.dispose();quadGeometry.dispose();
      depthMaterial.dispose();horizontalMaterial.dispose();verticalMaterial.dispose();displayMaterial.dispose();
      quadScene.clear();
    },
  };
}
export type ContactShadowResources=ReturnType<typeof createContactShadowResources>;

export function renderContactShadow(gl:WebGLRenderer,scene:Scene,ground:Mesh,resources:ContactShadowResources,passes:number){
  const previousTarget=gl.getRenderTarget(),background=scene.background,override=scene.overrideMaterial;
  const clearColor=gl.getClearColor(new Color()).clone(),clearAlpha=gl.getClearAlpha();
  const visible=ground.visible,autoClear=gl.autoClear;
  const excluded:Mesh[]=[];
  scene.traverse(object=>{if(object instanceof Mesh&&object.visible&&object.userData.excludeFromContactShadow)excluded.push(object);});
  try{
    excluded.forEach(object=>{object.visible=false;});
    ground.visible=false;scene.background=null;scene.overrideMaterial=resources.depthMaterial;
    gl.autoClear=true;gl.setClearColor(0x000000,0);
    gl.setRenderTarget(resources.target);gl.clear();gl.render(scene,resources.shadowCamera);
    for(let pass=0;pass<passes;pass++){
      const blur=(pass===0?1.0:0.55)/256;
      resources.quad.material=resources.horizontalMaterial;
      resources.horizontalMaterial.uniforms.tDiffuse.value=resources.target.texture;
      resources.horizontalMaterial.uniforms.h.value=blur;
      gl.setRenderTarget(resources.blurTarget);gl.render(resources.quadScene,resources.quadCamera);
      resources.quad.material=resources.verticalMaterial;
      resources.verticalMaterial.uniforms.tDiffuse.value=resources.blurTarget.texture;
      resources.verticalMaterial.uniforms.v.value=blur;
      gl.setRenderTarget(resources.target);gl.render(resources.quadScene,resources.quadCamera);
    }
  }finally{
    excluded.forEach(object=>{object.visible=true;});
    ground.visible=visible;scene.background=background;scene.overrideMaterial=override;
    gl.setRenderTarget(previousTarget);gl.setClearColor(clearColor,clearAlpha);gl.autoClear=autoClear;
  }
}
