import {useEffect,useMemo} from 'react';
import {CatmullRomCurve3,TorusGeometry,TubeGeometry,Vector3} from 'three';
import {createSmallBrilliantGeometry} from './brilliantGeometry';
import {metalAppearanceProps} from './metalMaterials';
import {ringSizing} from './wearableGeometry';
import type {ShankStyle} from './designGrammar';

/** Additive visual architecture; every styled shank needs its own manufacture test. */
export function ShankAdornment({style,diameter,color}:{style:ShankStyle;diameter:number;color:string}){
  const spec=ringSizing(diameter);
  const split=useMemo(()=>{
    if(style!=='split')return [];
    const r=spec.outerRadius;
    return [-1,1].flatMap(side=>[-1,1].map(track=>{
      const v=(z:number,x:number,elev=0)=>new Vector3(x,Math.sqrt(Math.max(.001,r*r-z*z))+elev,z*side);
      const curve=new CatmullRomCurve3([
        v(5.9,track*.34,-.04),v(4.6,track*.68,.06),
        v(3.3,track*1.12,.16),v(1.8,track*.82,.36),
      ],false,'centripetal');
      return new TubeGeometry(curve,44,.25,12,false);
    }));
  },[style,diameter,spec.outerRadius]);
  const gem=useMemo(()=>style==='pave'?createSmallBrilliantGeometry(16):null,[style]);
  const sites=useMemo(()=>[-1,1].flatMap(side=>Array.from({length:7},(_,i)=>{
    const z=(3+i*.56)*side;
    const y=Math.sqrt(Math.max(.001,spec.outerRadius**2-z*z))+.14;
    return {y,z};
  })),[spec.outerRadius]);
  useEffect(()=>()=>{split.forEach(x=>x.dispose());gem?.dispose();},[split,gem]);
  if(style==='classic')return null;
  if(style==='split')return <group name="split-shoulder-visual-work">
    {split.map((g,i)=><mesh key={i} name={'split-shoulder-track-'+i} geometry={g} castShadow>
      <meshPhysicalMaterial {...metalAppearanceProps(color,.20)}/>
    </mesh>)}
  </group>;
  return <group name="pave-shoulder-visual-setting">
    {sites.map((p,i)=><group key={i} position={[0,p.y,p.z]} rotation={[-Math.PI/2+Math.atan2(p.z,p.y),0,0]}>
      <mesh name="pave-shoulder-stone-seat" position-z={.11} castShadow>
        <torusGeometry args={[.27,.055,10,24]}/>
        <meshPhysicalMaterial {...metalAppearanceProps(color,.19)}/>
      </mesh>
      {gem&&<mesh name="pave-shoulder-faceted-diamond" geometry={gem}
        position-z={.10} scale={[.25,.25,.19]} castShadow>
        <meshPhysicalMaterial vertexColors color="#f6fdff" metalness={0} roughness={.04}
          transmission={.24} ior={2.33} thickness={.3} envMapIntensity={1.8} flatShading/>
      </mesh>}
      {[[1,0],[-1,0],[0,1],[0,-1]].map(([x,y],j)=><mesh key={j} name="shoulder-accent-prong"
        position={[x*.24,y*.24,.28]} castShadow>
        <sphereGeometry args={[.063,8,6]}/>
        <meshPhysicalMaterial {...metalAppearanceProps(color,.20)}/>
      </mesh>)}
    </group>)}
  </group>;
}
