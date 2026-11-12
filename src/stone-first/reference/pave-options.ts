export const PAVE_DIAMETERS=[80,90,100] as const;
export const PAVE_LENGTHS=[70,85,100] as const;
export type PaveDiameter=typeof PAVE_DIAMETERS[number];
export type PaveLength=typeof PAVE_LENGTHS[number];

export type PaveSummary={count:number;minGap:number|null;maxGap:number|null;diameter:number};

export function describePaveGap({minGap,maxGap,diameter}:PaveSummary){
  if(minGap===null||maxGap===null)return '无相邻配钻';
  const min=Math.round(minGap/diameter*100),max=Math.round(maxGap/diameter*100);
  return '石径的 '+(min===max?min+'%':min+'–'+max+'%');
}
