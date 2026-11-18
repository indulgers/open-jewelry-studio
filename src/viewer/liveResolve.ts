import {Vector2} from 'three';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {CopyShader} from 'three/addons/shaders/CopyShader.js';
export function liveResolve(width:number,height:number,opaqueWhite=false){
    const offset=new Vector2(0.32/width,0.32/height);
    return new ShaderPass({
      defines:opaqueWhite?{COMPOSITE_WHITE:1}:{},
      uniforms:{tDiffuse:{value:null},offset:{value:offset},panOffset:{value:new Vector2()}},
      vertexShader:CopyShader.vertexShader,
      fragmentShader:`uniform sampler2D tDiffuse;
        uniform vec2 offset,panOffset;
        varying vec2 vUv;
        vec4 sampleFrame(vec2 uv){
          #ifdef COMPOSITE_WHITE
          if(any(lessThan(uv,vec2(0)))||any(greaterThan(uv,vec2(1))))return vec4(0);
          #endif
          return texture2D(tDiffuse,uv);
        }
        void main(){
          vec2 uv=vUv+panOffset;
          vec2 mirror=vec2(offset.x,-offset.y);
          gl_FragColor=0.25*(sampleFrame(uv+offset)+sampleFrame(uv-offset)
            +sampleFrame(uv+mirror)+sampleFrame(uv-mirror));
          #ifdef COMPOSITE_WHITE
          gl_FragColor=vec4(gl_FragColor.rgb+vec3(1.0-gl_FragColor.a),1.0);
          #endif
        }`,
    });
}
