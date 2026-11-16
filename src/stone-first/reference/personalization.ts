export type PersonalImage={id:string;name:string;position:'inner-band'|'outer-band'};
export function parsePersonalImage(value:unknown):PersonalImage|null{
  if(!value||typeof value!=='object')return null;
  const v=value as Record<string,unknown>;
  if(typeof v.id!=='string'||!/^([a-f0-9]{64})$/.test(v.id)||typeof v.name!=='string'||!v.name.trim()||v.name.length>120||!['inner-band','outer-band'].includes(v.position as string))return null;
  return {id:v.id,name:v.name,position:v.position as PersonalImage['position']};
}
export const imagePosition=(position:PersonalImage['position'])=>position==='inner-band'?'内圈':'外侧戒臂';
