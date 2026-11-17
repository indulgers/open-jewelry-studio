import {useEffect,useMemo} from 'react';
import {CatmullRomCurve3,Quaternion,TorusGeometry,TubeGeometry,Vector3,type BufferGeometry} from 'three';
import {createComfortFitShank} from './comfortFitGeometry';
import {ShankAdornment} from './ShankStyles';
import type {ShankStyle,NecklaceMount} from './designGrammar';
import profiles from './profiles.json';
import {polishedGoldLikeMaterial,metalAppearanceProps} from './metalMaterials';
import {
  necklaceAnchors,ringShoulders,ringSizing,visibleChainPoints,
  type MotifId,type Point3,
} from './wearableGeometry';

type Props={color:string;motif:MotifId;scale:number;diameter:number;explode:number};
const vec=(p:Point3)=>new Vector3(...p);
const Y=new Vector3(0,1,0);

function ChainSide({anchor,side,color}:{anchor:Point3;side:-1|1;color:string}){
  const material=useMemo(()=>polishedGoldLikeMaterial(color,.14),[color]);
  // Each individual link is an oval wire: slim compared with the 15 mm motif.
  const geometry=useMemo(()=>new TorusGeometry(.42,.072,12,32),[]);
  const jumpRing=useMemo(()=>new TorusGeometry(.46,.115,12,40),[]);
  const links=useMemo(()=>{
    const curve=new CatmullRomCurve3(visibleChainPoints(anchor,side).map(vec),false,'centripetal');
    const count=Math.max(10,Math.ceil(curve.getLength()/.86));
    return Array.from({length:count},(_,i)=>{
      const t=(i+.35)/count;
      const point=curve.getPointAt(t);
      const tangent=curve.getTangentAt(t).normalize();
      const quaternion=new Quaternion().setFromUnitVectors(Y,tangent);
      if(i%2===1)quaternion.multiply(new Quaternion().setFromAxisAngle(Y,Math.PI/2));
      return {point,quaternion};
    });
  },[anchor[0],anchor[1],anchor[2],side]);
  useEffect(()=>()=>{geometry.dispose();jumpRing.dispose();material.dispose();},[geometry,jumpRing,material]);
  return <group name={side===-1?'necklace-left-links':'necklace-right-links'}>
    <mesh name="articulated-connector-ring" position={vec(anchor)} geometry={jumpRing}
      material={material} castShadow/>
    {links.map((link,i)=><mesh key={i} name="oval-chain-link" geometry={geometry} material={material}
      position={link.point} quaternion={link.quaternion} scale={[.73,1.20,1]} castShadow/>)}
  </group>;
}

export function NecklaceAdapter({color,motif,scale,explode,mount='side'}:Omit<Props,'diameter'>&{mount?:NecklaceMount}){
  const anchors=useMemo(()=>{
    if(mount==='side')return necklaceAnchors(motif,scale);
    const upper=Math.max(...profiles[motif].outline.map(p=>p[1]))*scale;
    const left:[number,number,number]=[-.73,upper+1.13,.58];
    const right:[number,number,number]=[.73,upper+1.13,.58];
    return {left,right};
  },[motif,scale,mount]);
  return <group name="04-necklace-assembly" position-z={-explode*.7}>
    {mount==='bail'&&<>
      {(motif==='flower'||motif==='blossom')&&<mesh name="formed-floral-bail-stem"
        position={[0,anchors.left[1]-1.27,anchors.left[2]]} castShadow>
        <capsuleGeometry args={[.16,1.18,8,12]}/>
        <meshPhysicalMaterial {...metalAppearanceProps(color,.2)}/>
      </mesh>}
      <mesh name="top-pendant-bail" position={[0,anchors.left[1]-.22,anchors.left[2]]}
        rotation={[0,0,0]} castShadow>
        <torusGeometry args={[.78,.19,14,36]}/>
        <meshPhysicalMaterial {...metalAppearanceProps(color,.18)}/>
      </mesh>
    </>}
    <ChainSide anchor={anchors.left} side={-1} color={color}/>
    <ChainSide anchor={anchors.right} side={1} color={color}/>
  </group>;
}

/** Preserve the named API for tests while upgrading the underlying geometry. */
export const createRingShankGeometry=createComfortFitShank;

export function RingAdapter({color,diameter,explode,fusedGeometry,shank='classic'}:Pick<Props,'color'|'diameter'|'explode'>&{fusedGeometry?:BufferGeometry|null;shank?:ShankStyle}){
  const shankGeometry=useMemo(()=>createRingShankGeometry(diameter),[diameter]);
  const arms=useMemo(()=>ringShoulders(diameter).map(points=>new TubeGeometry(
    new CatmullRomCurve3(points.map(vec),false,'centripetal'),44,.44,16,false,
  )),[diameter]);
  const material=useMemo(()=>{
    const m=polishedGoldLikeMaterial(color,.34);
    // The stock studio HDR contains hard black/white cards. Use a small
    // non-metallic diffuse contribution for stable preview instead of clipping
    // the broad comfort-fit band to pure white/black on software WebGL.
    m.metalness=.76;m.envMapIntensity=.63;m.anisotropy=0;
    return m;
  },[color]);
  useEffect(()=>()=>{shankGeometry.dispose();arms.forEach(a=>a.dispose());material.dispose();},[shankGeometry,arms,material]);
  return <group name="04-ring-shank-and-shoulders" position-y={-explode*.5}>
    {fusedGeometry?<mesh name="manifold-fused-ring-metal" geometry={fusedGeometry}
        material={material} castShadow receiveShadow/>:<>
      <mesh name="wearable-continuous-ring-band" geometry={shankGeometry} material={material} castShadow receiveShadow/>
      {arms.map((geo,i)=><mesh key={i} name={'shoulder-'+(i+1)} geometry={geo}
        material={material} castShadow/>)}
      <mesh name="underside-gallery-bridge" position={[0,ringSizing(diameter).motifSeatY-.70,0]}
        rotation={[Math.PI/2,0,0]} scale={[1.5,1.05,1]} castShadow>
        <torusGeometry args={[2.45,.34,18,72]}/>
        <meshPhysicalMaterial {...metalAppearanceProps(color,.19)}/>
      </mesh>
    </>}
    <ShankAdornment style={shank} diameter={diameter} color={color}/>
  </group>;
}
