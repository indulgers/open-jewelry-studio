import {isRingSize} from '../fit/sizing.ts';
import {parseEngravingStyle,type EngravingStyle} from '../engraving/style.ts';
import {STONE_APPEARANCES,type StoneAppearance} from '../../viewer/stoneAppearance.ts';
import {engravingProblem} from './engraving.ts';

export const HEADS=[
  ['halo','原款围钻','四段围钻与四颗隔断装饰钻'],
  ['four-prong','四爪单钻','开放式篮托，露出主石侧面'],
  ['bezel','包镶单钻','金属圈贴合主石外缘'],
] as const;
export type Head=typeof HEADS[number][0];

export const ZONES=['center','halo','shoulder'] as const;
export const SIZES=[0.94,1,1.06] as const;
export const REACHES=[0.97,1,1.05] as const;
export type Zone=typeof ZONES[number];
export type StoneSpec={cut:'round'|'oval';size:typeof SIZES[number];appearance:StoneAppearance};
export type RingDesign=Record<Zone,StoneSpec>&{ringSizeUS?:number;head:Head;reach:typeof REACHES[number];metal:'white';engraving:string;engravingStyle?:EngravingStyle};

function record(value:unknown):value is Record<string,unknown>{
  return typeof value==='object'&&value!==null;
}
export function parseDesign(value:unknown):RingDesign|null{
  if(!record(value))return null;
  if(value.ringSizeUS!==undefined&&!isRingSize(value.ringSizeUS))return null;
  const engravingStyle=value.engravingStyle===undefined?undefined:parseEngravingStyle(value.engravingStyle);
  if(engravingStyle===null)return null;
  const {head='halo',center,halo,shoulder,reach,metal,engraving=''}=value;
  const spec=(v:unknown):v is StoneSpec=>record(v)&&(v.cut==='round'||v.cut==='oval')
    &&SIZES.some(size=>size===v.size)&&typeof v.appearance==='string'&&Object.hasOwn(STONE_APPEARANCES,v.appearance);
  if(!HEADS.some(([id])=>id===head)||!spec(center)||!spec(halo)||!spec(shoulder)||!REACHES.some(length=>length===reach)
    ||(metal!=='white'&&metal!=='yellow'&&metal!=='rose')||typeof engraving!=='string'
    ||engraving!==engraving.trim()||engravingProblem(engraving))return null;
  return {...(value.ringSizeUS===undefined?{}:{ringSizeUS:value.ringSizeUS}),...(engravingStyle?{engravingStyle}:{}),head:head as Head,center:{...center,appearance:'diamond'},halo:{...halo,appearance:'diamond'},shoulder:{...shoulder,appearance:'diamond'},reach:reach as RingDesign['reach'],metal:'white',engraving};
}
