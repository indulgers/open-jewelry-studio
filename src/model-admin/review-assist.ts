export const labels={unassigned:'待确认',head:'戒头金属',band:'戒圈金属',center:'主石',halo:'戒头配钻',shoulder:'戒臂配钻',paveMetal:'铺钻镶座',adapter:'接合件',exclude:'不导出'};
export type Role=keyof typeof labels;
export type Part={id:number;triangles:number;min:number[];max:number[];role:Role};
export type Assignments=Record<string,Role>;
export function similarParts(parts:Part[],seed:Part){
  const sizes=(part:Part)=>[part.max[1]-part.min[1],Math.hypot(part.max[0]-part.min[0],part.max[2]-part.min[2])];
  const reference=sizes(seed);
  // Bounding boxes only suggest candidates; the reviewer chooses their role.
  return parts.filter(part=>Math.abs(part.triangles-seed.triangles)<=Math.max(2,seed.triangles*.08)&&sizes(part).every((v,i)=>Math.abs(v-reference[i])<=Math.max(.001,reference[i]*.22))).map(part=>part.id);
}
export function suggestAssignments(parts:Part[],current:Assignments){
  const bands=parts.filter(part=>current[part.id]==='band');
  const result={...current};
  if(!bands.length)return result;
  const top=Math.max(...bands.map(part=>part.max[1]));
  const low=Math.min(...bands.map(part=>part.min[1]));
  const left=Math.min(...bands.map(part=>part.min[0]));
  const right=Math.max(...bands.map(part=>part.max[0]));
  for(const part of parts){
    if(current[part.id]==='unassigned'&&part.min[1]>top+(top-low)*.005&&part.min[0]>=left&&part.max[0]<=right)result[part.id]='head';
  }
  return result;
}
export function suggestSeat(parts:Part[],assignments:Assignments,known:number|null){
  if(known!==null)return {value:known,reason:'采用匹配原款的接合高度。'};
  const bands=parts.filter(part=>assignments[part.id]==='band');
  const heads=parts.filter(part=>assignments[part.id]==='head');
  if(!bands.length||!heads.length)return null;
  const bandTop=Math.max(...bands.map(part=>part.max[1]));
  const headBottom=Math.min(...heads.map(part=>part.min[1]));
  return {value:(bandTop+headBottom)/2,reason:bandTop>headBottom?'戒头与戒圈范围有重叠，先取重叠高度中点，请从侧面检查。':'取已分配戒圈顶部与戒头底部之间的中点，请从侧面检查。'};
}
export function reviewIssues(parts:Part[],assignments:Assignments,seat:string,min:number,max:number){
  const values=parts.map(part=>assignments[part.id]);
  const issues:string[]=[];
  const pending=values.filter(role=>!role||role==='unassigned').length;
  if(pending)issues.push(pending+' 个部件待确认');
  if(!values.includes('head'))issues.push('未指定戒头金属');
  if(!values.includes('band'))issues.push('未指定戒圈金属');
  if(values.filter(role=>role==='center').length!==1)issues.push('需要恰好一颗主石');
  if(!seat.trim()||!Number.isFinite(Number(seat))||Number(seat)<=min||Number(seat)>=max)issues.push('请设置有效接合高度');
  return issues;
}
