import {Vector2} from 'three';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {CopyShader} from 'three/addons/shaders/CopyShader.js';
export function liveResolve(width:number,height:number,opaqueWhite=false){
    const offset=new Vector2(0.32/width,0.32/height);
    return new ShaderPass({
      defines:opaqueWhite?{COMPOSITE_WHITE:1}:{},
      uniforms:{tDiffuse:{value:null},offset:{value:offset}},
      vertexShader:CopyShader.vertexShader,
      fragmentShader:`uniform sampler2D tDiffuse;
        uniform vec2 offset;
        varying vec2 vUv;
        void main(){
          vec2 mirror=vec2(offset.x,-offset.y);
          gl_FragColor=0.25*(texture2D(tDiffuse,vUv+offset)+texture2D(tDiffuse,vUv-offset)
            +texture2D(tDiffuse,vUv+mirror)+texture2D(tDiffuse,vUv-mirror));
          #ifdef COMPOSITE_WHITE
          gl_FragColor=vec4(gl_FragColor.rgb+vec3(1.0-gl_FragColor.a),1.0);
          #endif
        }`,
    });
}
