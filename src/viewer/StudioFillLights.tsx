import {useLayoutEffect,useRef} from 'react';
import {Vector3,type RectAreaLight} from 'three';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';

// Area lights are what a real white sweep and strip boxes contribute: long, soft
// highlights on polished metal rather than an overall lift.
RectAreaLightUniformsLib.init();

import {CARDS,type Card} from './studioCards';
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
