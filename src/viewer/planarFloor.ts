import {Color,Matrix4,PlaneGeometry,Vector2} from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';

export function createPlanarFloor(resolution:number,groundY:number){
  const geometry=new PlaneGeometry(200,200);
  const reflector=new Reflector(geometry,{
    textureWidth:resolution,textureHeight:resolution,multisample:0,clipBias:0.0003,color:'#ececeb',
    shader:{name:'JewelryPlanarFloor',uniforms:{
      color:{value:new Color('#ececeb')},tDiffuse:{value:null},textureMatrix:{value:new Matrix4()},
      texel:{value:new Vector2(1/resolution,1/resolution)},
    },vertexShader:/* glsl */`
      uniform mat4 textureMatrix;
      varying vec4 vReflection;
      varying vec3 vWorldPosition;
      void main(){
        vReflection=textureMatrix*vec4(position,1.0);
        vWorldPosition=(modelMatrix*vec4(position,1.0)).xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }`,fragmentShader:/* glsl */`
      uniform vec3 color;
      uniform sampler2D tDiffuse;
      uniform vec2 texel;
      varying vec4 vReflection;
      varying vec3 vWorldPosition;
      void main(){
        vec2 uv=vReflection.xy/vReflection.w;
        float distanceFromRing=length(vWorldPosition.xz);
        vec2 spread=texel*(0.45+distanceFromRing*0.25);
        vec3 reflected=texture2D(tDiffuse,uv).rgb*0.4;
        reflected+=texture2D(tDiffuse,uv+vec2(spread.x,0.0)).rgb*0.15;
        reflected+=texture2D(tDiffuse,uv-vec2(spread.x,0.0)).rgb*0.15;
        reflected+=texture2D(tDiffuse,uv+vec2(0.0,spread.y)).rgb*0.15;
        reflected+=texture2D(tDiffuse,uv-vec2(0.0,spread.y)).rgb*0.15;
        float weight=0.38*(1.0-smoothstep(0.8,4.5,distanceFromRing));
        gl_FragColor=vec4(mix(color,reflected,weight),1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    },
  });
  reflector.rotation.x=-Math.PI/2;reflector.position.y=groundY;
  reflector.userData.excludeFromContactShadow=true;
  const draw=reflector.onBeforeRender;
  reflector.onBeforeRender=function(renderer,scene,camera,geometry,material,group){
    if(!scene.overrideMaterial)draw.call(this,renderer,scene,camera,geometry,material,group);
  };
  let disposed=false;
  return {reflector,dispose(){if(disposed)return;disposed=true;reflector.dispose();geometry.dispose();}};
}
