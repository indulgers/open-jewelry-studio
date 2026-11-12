export const BAND_STYLES = [
  {name:'分段式戒圈', finishes:[{id:'ring-floral',name:'素面'},{id:'ring-02',name:'单列铺钻'}]},
  {name:'纤细戒圈', finishes:[{id:'ring-rosette',name:'素面'},{id:'ring-petal',name:'单列铺钻'}]},
  {name:'宽肩戒圈', finishes:[{id:'ring-crown',name:'双列铺钻'}]},
] as const;

export function bandStyle(id:string) {
  return BAND_STYLES.find(style=>style.finishes.some(finish=>finish.id===id))!;
}

export function bandName(id:string) {
  const style=bandStyle(id);
  return style.name+' · '+style.finishes.find(finish=>finish.id===id)!.name;
}

export const headName=(name:string)=>name.replace(/戒指$/,'戒头');
export const HALO_COMBINATION_ROUTE='#/stonefirst/combine/ring-02';

// These are the original basket seat heights and band-side connector parts, in source coordinates.
export const SEAT_Y:Record<string,number>={
  'ring-02':10.972,'ring-floral':13.495,'ring-rosette':13.985,'ring-petal':13.920,'ring-crown':12.982,
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
    default:return false;
  }
}
