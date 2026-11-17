import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {InstancedMesh,Object3D,Shape,ExtrudeGeometry,Vector3,Quaternion,Color} from 'three';
import {createSmallBrilliantGeometry} from './brilliantGeometry';
import {buildRadialEngraving,createPetalSolid,petalFaceZAt} from './designGeometry';
import {settingPlan,type MotifId,type Technique,type SettingPoint} from './designGrammar';
import {metalAppearanceProps} from './metalMaterials';
import profiles from './profiles.json';

const UP=new Vector3(0,1,0);
function shapeFor(motif:MotifId){
  const s=new Shape(),points=profiles[motif].outline;
  s.moveTo(points[0][0],points[0][1]);
  for(let i=1;i<points.length;i++)s.lineTo(points[i][0],points[i][1]);
  s.closePath();return s;
}

/** Real closed metal backing for a surface design; gemstones are separate. */
function MetalRelief({motif,metal,height=.48}:{motif:MotifId;metal:string;height?:number}){
  const geometry=useMemo(()=>new ExtrudeGeometry(shapeFor(motif),{
    depth:height,steps:1,bevelEnabled:true,bevelThickness:.085,bevelSize:.06,bevelSegments:3,curveSegments:7,
  }),[motif,height]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh name="technique-solid-metal-relief" geometry={geometry} position={[0,0,.14]}
    castShadow receiveShadow><meshPhysicalMaterial {...metalAppearanceProps(metal,.23)}/></mesh>;
}

function RadialStrokePattern({motif,metal}:{motif:MotifId;metal:string}){
  const rays=useMemo(()=>buildRadialEngraving(motif,105),[motif]);
  const ref=useRef<InstancedMesh>(null);
  useLayoutEffect(()=>{
    if(!ref.current)return;
    const dummy=new Object3D(),s=new Vector3(),e=new Vector3();
    for(let i=0;i<rays.length;i++){
      const ray=rays[i];s.set(...ray.start);e.set(...ray.end);
      dummy.position.copy(s).add(e).multiplyScalar(.5);
      dummy.quaternion.setFromUnitVectors(UP,e.sub(s).normalize());
      dummy.scale.set(ray.width,s.distanceTo(new Vector3(...ray.end)),ray.width);
      // Distance must be computed before normalization; use original vector.
      dummy.scale.y=new Vector3(...ray.start).distanceTo(new Vector3(...ray.end));
      dummy.updateMatrix();ref.current.setMatrixAt(i,dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate=true;
  },[rays]);
  return <group name="guilloche-light-rays">
    <instancedMesh ref={ref} args={[undefined,undefined,rays.length]} name="guilloche-radial-strokes">
      <cylinderGeometry args={[1,1,1,6]}/>
      <meshPhysicalMaterial {...metalAppearanceProps(metal,.13)} color={new Color(metal).multiplyScalar(.72)}/>
    </instancedMesh>
    <mesh name="guilloche-center-boss" position={[0,0,.72]} castShadow>
      <sphereGeometry args={[.58,24,16]}/><meshPhysicalMaterial {...metalAppearanceProps(metal,.12)}/>
    </mesh>
  </group>;
}

function SculptedFlower({metal}:{metal:string}){
  const petals=useMemo(()=>Array.from({length:5},(_,i)=>createPetalSolid(i*Math.PI*2/5)),[]);
  useEffect(()=>()=>petals.forEach(g=>g.dispose()),[petals]);
  return <group name="five-separate-sculpted-petals">
    {petals.map((geometry,i)=><mesh key={i} geometry={geometry} name={'formed-petal-'+i}
      castShadow receiveShadow><meshPhysicalMaterial color={metal} metalness={.73} roughness={.29} envMapIntensity={.58}/></mesh>)}
    <mesh name="petal-center-gallery" position={[0,0,.46]} rotation={[Math.PI/2,0,0]} castShadow>
      <cylinderGeometry args={[.86,1.16,.72,32]}/>
      <meshPhysicalMaterial color={metal} metalness={.72} roughness={.24} envMapIntensity={.65}/>
    </mesh>
  </group>;
}

/**
 * Instanced gems, under-bezel rings and four small bead tips per stone.
 * These are mounted on distinct 3D parts rather than white dots in a texture.
 */
function GemSettingArray({sites,metal,raisedPetals=false}:{sites:readonly SettingPoint[];metal:string;raisedPetals?:boolean}){
  const gems=useRef<InstancedMesh>(null),bezels=useRef<InstancedMesh>(null),prongs=useRef<InstancedMesh>(null);
  const gem=useMemo(()=>createSmallBrilliantGeometry(16),[]);
  const diamonds=useMemo(()=>sites.length, [sites]);
  useEffect(()=>()=>gem.dispose(),[gem]);
  useLayoutEffect(()=>{
    const a=gems.current,b=bezels.current,c=prongs.current;
    if(!a||!b||!c)return;
    const obj=new Object3D();
    sites.forEach((site,i)=>{
      const r=site.radius;
      // Map the bearing to the real 3D petal crown. Metal seats, facets
      // and prongs share this elevation so no stone appears to float.
      const bearing=raisedPetals?Math.max(.71,petalFaceZAt(site.x,site.y)+.055):.665;
      obj.position.set(site.x,site.y,bearing+.005);obj.quaternion.identity();obj.scale.set(r,r,r*.74);
      obj.updateMatrix();a.setMatrixAt(i,obj.matrix);
      obj.position.set(site.x,site.y,bearing+.08);obj.scale.set(r*.94,r*.94,r*.94);
      obj.updateMatrix();b.setMatrixAt(i,obj.matrix);
      for(let j=0;j<4;j++){
        const theta=Math.PI/4+j*Math.PI/2;
        obj.position.set(site.x+Math.cos(theta)*r*.87,site.y+Math.sin(theta)*r*.87,bearing+.19);
        obj.scale.set(.09,.09,.11);obj.updateMatrix();c.setMatrixAt(i*4+j,obj.matrix);
      }
    });
    a.instanceMatrix.needsUpdate=true;b.instanceMatrix.needsUpdate=true;c.instanceMatrix.needsUpdate=true;
  },[sites,raisedPetals]);
  if(!diamonds)return null;
  return <group name="individual-gem-seats-prongs-and-stones">
    <instancedMesh ref={bezels} args={[undefined,undefined,sites.length]} name="individual-metal-seats">
      <torusGeometry args={[1,.1,10,24]}/>
      <meshPhysicalMaterial {...metalAppearanceProps(metal,.23)}/>
    </instancedMesh>
    <instancedMesh ref={gems} args={[gem,undefined,sites.length]} name="faceted-gems">
      <meshPhysicalMaterial color="#ffffff" vertexColors metalness={0} roughness={.065}
        transmission={0} ior={2.333} thickness={.36} envMapIntensity={1.35} flatShading/>
    </instancedMesh>
    <instancedMesh ref={prongs} args={[undefined,undefined,sites.length*4]} name="raised-bead-prongs">
      <sphereGeometry args={[1,10,8]}/>
      <meshPhysicalMaterial {...metalAppearanceProps(metal,.22)}/>
    </instancedMesh>
  </group>;
}

export function DesignedSurface({motif,technique,metal,centerStone}:{motif:MotifId;technique:Technique;metal:string;centerStone:boolean}){
  const plan=useMemo(()=>settingPlan(motif,technique),[motif,technique]);
  const sites=useMemo(()=>plan.sites.filter(p=>!(centerStone&&technique==='pave'&&Math.hypot(p.x,p.y)<1.35)),[plan,centerStone,technique]);
  switch(plan.surface){
    case 'engraved-metal':return <group name="guilloche-relief">
      <MetalRelief motif={motif} metal={metal}/><RadialStrokePattern motif={motif} metal={metal}/>
    </group>;
    case 'petals':return <group name="sculpted-flower-relief"><SculptedFlower metal={metal}/></group>;
    case 'gem-seats':return <group name={technique==='cluster'?'diamond-cluster':'pave-floral-surface'}>
      {(motif==='flower'||motif==='blossom')
        ?<SculptedFlower metal={metal}/>
        :<MetalRelief motif={motif} metal={metal}/>}
      <GemSettingArray sites={sites} metal={metal} raisedPetals={motif==='flower'||motif==='blossom'}/>
    </group>;
    default:return null;
  }
}

export function summarizeGemSetting(motif:MotifId,technique:Technique,centerStone:boolean){
  const plan=settingPlan(motif,technique);
  return {
    technique:plan.technique,
    modeledAccentStones:plan.sites.filter(p=>!(centerStone&&technique==='pave'&&Math.hypot(p.x,p.y)<1.35)).length,
    metalEdgeAllowanceMm:plan.proposedMinEdgeMm,
    visualGapMm:plan.proposedMinGapMm,
    surface:plan.surface,
    manufacturingApproved:false,
    warnings:plan.warnings,
  };
}
