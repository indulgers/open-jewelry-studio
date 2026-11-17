import {useEffect,useMemo} from 'react';
import {
  CatmullRomCurve3,ExtrudeGeometry,MeshPhysicalMaterial,Path,Quaternion,Shape,
  TorusGeometry,TubeGeometry,Vector3,
} from 'three';
import {
  necklaceAnchors,ringShoulders,ringSizing,visibleChainPoints,
  type MotifId,type Point3,
} from './wearableGeometry';

type Props={color:string;motif:MotifId;scale:number;diameter:number;explode:number};
const vec=(p:Point3)=>new Vector3(...p);
const Y=new Vector3(0,1,0);

function ChainSide({anchor,side,color}:{anchor:Point3;side:-1|1;color:string}){
  const material=useMemo(()=>new MeshPhysicalMaterial({color,metalness:.98,roughness:.16,envMapIntensity:1.45}),[color]);
  const geometry=useMemo(()=>new TorusGeometry(.52,.105,10,24),[]);
  const links=useMemo(()=>{
    const curve=new CatmullRomCurve3(visibleChainPoints(anchor,side).map(vec),false,'centripetal');
    const count=Math.ceil(curve.getLength()/1.08);
    return Array.from({length:count},(_,i)=>{
      const t=(i+.35)/count;
      const point=curve.getPointAt(t);
      const tangent=curve.getTangentAt(t).normalize();
      const quaternion=new Quaternion().setFromUnitVectors(Y,tangent);
      // Adjacent oval links interlock in perpendicular planes, never a continuous rigid tube.
      if(i%2===1)quaternion.multiply(new Quaternion().setFromAxisAngle(Y,Math.PI/2));
      return {point,quaternion};
    });
  },[anchor[0],anchor[1],anchor[2],side]);
  useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);
  return <group name={side===-1?'necklace-left-links':'necklace-right-links'}>
    <mesh name="articulated-connector-ring" position={vec(anchor)} material={material} castShadow>
      <torusGeometry args={[.61,.165,12,32]}/>
    </mesh>
    {links.map((link,i)=><mesh key={i} name="oval-chain-link" geometry={geometry} material={material}
      position={link.point} quaternion={link.quaternion} scale={[.78,1.38,1]} castShadow/>)}
  </group>;
}

export function NecklaceAdapter({color,motif,scale,explode}:Omit<Props,'diameter'>){
  const anchors=useMemo(()=>necklaceAnchors(motif,scale),[motif,scale]);
  return <group name="04-necklace-assembly" position-z={-explode*.7}>
    <ChainSide anchor={anchors.left} side={-1} color={color}/>
    <ChainSide anchor={anchors.right} side={1} color={color}/>
  </group>;
}

export function createRingShankGeometry(innerDiameter:number){
  const sizes=ringSizing(innerDiameter);
  const loop=new Shape();
  loop.absarc(0,0,sizes.outerRadius,0,Math.PI*2,false);
  const opening=new Path();
  opening.absarc(0,0,sizes.modeledInnerRadius,0,Math.PI*2,true);
  loop.holes.push(opening);
  const geometry=new ExtrudeGeometry(loop,{
    depth:sizes.bandWidth-2*sizes.bevel,
    bevelEnabled:true,bevelSize:sizes.bevel,bevelThickness:sizes.bevel,
    bevelSegments:3,steps:1,curveSegments:128,
  });
  // World X is the finger axis. The original XY annulus becomes a YZ annulus.
  geometry.translate(0,0,-(sizes.bandWidth/2-sizes.bevel));
  geometry.rotateY(Math.PI/2);
  geometry.computeVertexNormals();
  return geometry;
}

export function RingAdapter({color,diameter,explode}:Pick<Props,'color'|'diameter'|'explode'>){
  const shank=useMemo(()=>createRingShankGeometry(diameter),[diameter]);
  const arms=useMemo(()=>ringShoulders(diameter).map(points=>new TubeGeometry(
    new CatmullRomCurve3(points.map(vec),false,'centripetal'),38,.47,12,false,
  )),[diameter]);
  useEffect(()=>()=>{shank.dispose();arms.forEach(a=>a.dispose());},[shank,arms]);
  return <group name="04-ring-shank-and-shoulders" position-y={-explode*.5}>
    <mesh name="wearable-continuous-ring-band" geometry={shank} castShadow receiveShadow>
      <meshPhysicalMaterial color={color} metalness={.98} roughness={.17} envMapIntensity={1.35}/>
    </mesh>
    {arms.map((geo,i)=><mesh key={i} name={'shoulder-'+(i+1)} geometry={geo} castShadow>
      <meshPhysicalMaterial color={color} metalness={.98} roughness={.18} envMapIntensity={1.35}/>
    </mesh>)}
  </group>;
}
