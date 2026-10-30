import {useLayoutEffect,useRef} from 'react';
import {Vector3,type RectAreaLight} from 'three';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';

// Area lights are what a real white sweep and strip boxes contribute: long, soft
// highlights on polished metal rather than an overall lift.
RectAreaLightUniformsLib.init();

type Card={position:[number,number,number];width:number;height:number;intensity:number;color:string};
const CARDS:Card[]=[
  {position:[-2.1,2.5,3.0],width:3.4,height:2.4,intensity:1.1,color:'#fff3e6'},
  {position:[2.6,1.4,2.3],width:2.2,height:1.5,intensity:0.7,color:'#ffeadd'},
  {position:[-2.4,0.7,-1.4],width:2.0,height:1.4,intensity:0.5,color:'#ffe9da'},
  {position:[0,3.4,0.2],width:3.2,height:1.6,intensity:0.4,color:'#fff6ec'},
  {position:[0,-0.6,2.4],width:4.0,height:1.8,intensity:0.4,color:'#fff1e5'},
];
const TARGET=new Vector3(0,0.55,0);

function AreaCard({card}:{card:Card}){
  const ref=useRef<RectAreaLight>(null);
  useLayoutEffect(()=>{ref.current?.lookAt(TARGET);},[card]);
  return <rectAreaLight ref={ref} position={card.position} width={card.width} height={card.height}
    intensity={card.intensity} color={card.color}/>;
}

export function StudioFillLights(){
  return <>{CARDS.map((card,index)=><AreaCard key={index} card={card}/>)}</>;
}
