import {RING_CATALOG} from '../catalog.ts';
export const BAND_STYLES:{name:string;finishes:{id:string;name:string}[]}[] = [
  {name:'分段式戒圈', finishes:[{id:'ring-floral',name:'素面'},{id:'ring-02',name:'单列铺钻'}]},
  {name:'纤细戒圈', finishes:[{id:'ring-rosette',name:'素面'},{id:'ring-petal',name:'单列铺钻'}]},
  {name:'收腰戒圈', finishes:[{id:'ring-solstice',name:'素面'},{id:'ring-starlight',name:'单列铺钻'}]},
  {name:'宽肩戒圈', finishes:[{id:'ring-crown',name:'双列铺钻'}]},
];

for(const ring of RING_CATALOG){
  if(BAND_STYLES.some(style=>style.finishes.some(finish=>finish.id===ring.id)))continue;
  const name=ring.bandStructure||ring.bandLabel||ring.name.replace(/戒指$/,'戒圈');
  let style=BAND_STYLES.find(item=>item.name===name);
  if(!style){style={name,finishes:[]};BAND_STYLES.push(style);}
  style.finishes.push({id:ring.id,name:ring.bandFinish||(ring.zones.includes('shoulder')?'单列铺钻':'素面')});
}

export function bandStyle(id:string) {
  return BAND_STYLES.find(style=>style.finishes.some(finish=>finish.id===id))!;
}

export function bandName(id:string) {
  const style=bandStyle(id);
  return style.name+' · '+style.finishes.find(finish=>finish.id===id)!.name;
}

export const headName=(name:string)=>name.replace(/戒指$/,'戒头');
export const HALO_COMBINATION_ROUTE='#/stonefirst/combine/ring-02';

export const LEGACY_HALO_COLLARS:Record<string,readonly string[]>={
  'ring-crown':['metal_23','metal_26'],'ring-starlight':[],'ring-solstice':['metal_25'],
};

// These are the original basket seat heights and band-side connector parts, in source coordinates.
export const SEAT_Y:Record<string,number>={
  'ring-02':10.972,'ring-floral':13.495,'ring-rosette':13.985,'ring-petal':13.920,'ring-crown':12.982,'ring-starlight':14.2,'ring-solstice':6.4,
};

export function isBandMetal(id:string,name:string) {
  if(id==='ring-02')return name==='metal_lower_shank_shell'||name==='metal_shank_with_shoulders'
    ||name==='reference_crown_shank_shell'||name.startsWith('metal_shoulder_');
  const part=Number(name.slice('metal_'.length));
  switch(id){
    case 'ring-floral':return [4,7,10,13,16,680,683,686,689].includes(part);
    case 'ring-rosette':return [12,40,43,46,49].includes(part);
    case 'ring-petal':return [1,14100,14114,14314,14317,14320].includes(part)||(part>=13944&&part<=14097);
    case 'ring-crown':return part!==170;
    case 'ring-starlight':return part===97;
    case 'ring-solstice':return [1,25].includes(part);
    default:return false;
  }
}

// Source mesh names identify the original beads separately from the shank and collars.
export function isShoulderBead(id:string|undefined,name:string){
  if(id==='ring-02')return name.startsWith('metal_shoulder_bead_');
  const part=Number(name.slice('metal_'.length));
  return id==='ring-petal'?part>=13944&&part<=14097:id==='ring-crown'&&part>=77&&part<=164;
}

export function referencePartRole(id:string,name:string){
  return name==='reference_crown_shank_shell'?'adapter':/^gem_(center|halo)/.test(name)?'headStones'
    :name.startsWith('gem_shoulder')||isShoulderBead(id,name)?'pave'
    :name==='metal_reflow_shank'||isBandMetal(id,name)?'band':'head';
}
