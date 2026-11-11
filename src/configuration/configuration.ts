export type ShankStyle = 'plain' | 'split';
export type MetalFinish = 'yellow' | 'white' | 'rose';
export const METALS={
  yellow:{name:'黄金色',color:'#efcf94',swatch:'#c3a05e'},
  white:{name:'白金色',color:'#ededeb',swatch:'#c9cece'},
  rose:{name:'玫瑰金色',color:'#e4bda7',swatch:'#c79078'},
};
export type StoneSize = 'small' | 'medium' | 'large';
export type Configuration = {schemaVersion:1; shankStyle:ShankStyle; metalFinish:MetalFinish; stoneSize:StoneSize};
export type ConfigurationAction =
  | {type:'set-shank';value:ShankStyle}
  | {type:'set-metal';value:MetalFinish}
  | {type:'set-size';value:StoneSize}
  | {type:'reset'};
export const DEFAULT_CONFIGURATION:Configuration={schemaVersion:1,shankStyle:'plain',metalFinish:'yellow',stoneSize:'medium'};
export function parseConfiguration(input:unknown):Configuration|null {
  if(!input||typeof input!=='object'||Array.isArray(input))return null;
  const value=input as Record<string,unknown>;
  if(typeof value.shankStyle!=='string'||typeof value.metalFinish!=='string'||typeof value.stoneSize!=='string')return null;
  if(value.schemaVersion!==1||!['plain','split'].includes(value.shankStyle)||
    !['yellow','white','rose'].includes(String(value.metalFinish))||
    !['small','medium','large'].includes(String(value.stoneSize)))return null;
  return {schemaVersion:1,shankStyle:value.shankStyle as ShankStyle,
    metalFinish:value.metalFinish as MetalFinish,stoneSize:value.stoneSize as StoneSize};
}
export function configurationReducer(state:Configuration,action:ConfigurationAction):Configuration {
  switch(action.type){
    case 'set-shank':return {...state,shankStyle:action.value};
    case 'set-metal':return {...state,metalFinish:action.value};
    case 'set-size':return {...state,stoneSize:action.value};
    case 'reset':return {...DEFAULT_CONFIGURATION};
  }
}
