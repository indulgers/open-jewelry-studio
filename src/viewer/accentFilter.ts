import {Vector2,type WebGLRenderTarget,type WebGLRenderer} from 'three';
import type {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

// In the editor's half-float scene target, each covered accent sample adds 2N
// to alpha. After MSAA resolve, an even integer counts the tagged samples and
// the remainder is ordinary coverage. A fraction smaller than half a coverage
// step carries the close-up fade. Decode at texel centers before pan/bilinear
// sampling. Direct renders and thumbnail cameras do not opt into this encoding.
export function installAccentFilter(output:OutputPass,target:WebGLRenderTarget){
  const tag={value:0};
  target.texture.userData.accentFilter=tag;
  const material=output.material;
  material.uniforms.accentTexel={value:new Vector2(1/target.width,1/target.height)};
  material.uniforms.accentTag=tag;
  material.fragmentShader=material.fragmentShader.replace('void main()',`
    uniform vec2 accentTexel;
    uniform float accentTag;
    vec4 filterAccent(vec2 uv){
      vec4 center=texture2D(tDiffuse,uv);
      if(center.a<1.5)return center;
      float samples=accentTag*.5;
      float coverage=floor(mod(center.a,2.)*samples+.5)/samples;
      // Exclude silhouettes, partial coverage, prongs and the center stone.
      if(center.a<accentTag+.99)return vec4(center.rgb,coverage);
      float strength=clamp((center.a-(accentTag+1.))*3.*samples,0.,1.);
      vec3 sum=center.rgb*4.;
      float weight=4.;
      for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
        if(x==0&&y==0)continue;
        vec4 neighbor=texture2D(tDiffuse,uv+vec2(float(x),float(y))*accentTexel);
        if(neighbor.a<accentTag+.99)continue;
        float w=(x==0||y==0)?2.:1.;
        sum+=w*neighbor.rgb;
        weight+=w;
      }
      return vec4(mix(center.rgb,sum/weight,strength),coverage);
    }
    void main()`).replace('texture2D( tDiffuse, vUv )','filterAccent(vUv)');
}

export function accentDrawTag(renderer:WebGLRenderer){
  const tag=renderer.getRenderTarget()?.texture.userData.accentFilter;
  if(!tag)return 0;
  if(!tag.value){
    // Query once on the bound scene framebuffer. Drivers may allocate more
    // samples than requested. Zero is a single, non-multisampled pixel.
    const gl=renderer.getContext();
    tag.value=2*Math.max(1,gl.getParameter(gl.SAMPLES));
  }
  return tag.value;
}
