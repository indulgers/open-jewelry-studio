import {ATELIER_GEMS,atelierGem,type GemShapeId} from '../../assets/atelierManifest.ts';
import type {MetalFinish} from '../../configuration/configuration.ts';

// Art-direction values for the preview material. They do not identify a physical stone.
const diamond={ior:2.42,absorptionDistance:1.8,dispersionScale:1};
const moissanite={ior:2.65,absorptionDistance:.42,dispersionScale:1.65};
const corundum={ior:1.77,absorptionDistance:.45,dispersionScale:.65};
export const GEM_SAMPLES=[
  {id:'original',family:'原款',name:'白钻',swatch:'#ebedee',optics:{...diamond,transmittance:'#ffffff'}},
  {id:'moissanite-white',family:'莫桑钻',name:'纯白',swatch:'#eeede9',optics:{...moissanite,transmittance:'#ffffff'}},
  {id:'moissanite-blue',family:'莫桑钻',name:'灰蓝色',swatch:'#7d99a6',optics:{...moissanite,transmittance:'#769dad'}},
  {id:'moissanite-yellow',family:'莫桑钻',name:'黄色',swatch:'#d4b358',optics:{...moissanite,transmittance:'#e9c15c'}},
  {id:'grown-white',family:'培育钻石',name:'纯白',swatch:'#f1eff0',optics:{...diamond,transmittance:'#ffffff'}},
  {id:'grown-pink',family:'培育钻石',name:'粉色',swatch:'#d79ea9',optics:{...diamond,absorptionDistance:.48,transmittance:'#e7a0b7'}},
  {id:'grown-ruby',family:'培育红蓝宝石',name:'红宝石',swatch:'#a2334a',optics:{...corundum,transmittance:'#d53857'}},
  {id:'grown-sapphire',family:'培育红蓝宝石',name:'蓝宝石',swatch:'#516ca5',optics:{...corundum,transmittance:'#537bcb'}},
  {id:'natural',family:'天然宝石',name:'待选实石',swatch:'#d7dddf',optics:{...diamond,transmittance:'#ffffff'}},
] as const;
export const CARATS=[.75,1,1.5,2,3] as const;
export const PLATING={white:'银色',yellow:'黄金色',rose:'玫瑰金色'} satisfies Record<MetalFinish,string>;
export const SURFACES={polished:'抛光',matte:'哑面'} as const;

export type ReferenceStyling={
  cut:GemShapeId|'original';
  carat:typeof CARATS[number]|'original';
  gem:typeof GEM_SAMPLES[number]['id'];
  plating:keyof typeof PLATING;
  surface:keyof typeof SURFACES;
};
export const ORIGINAL_STYLING:ReferenceStyling={cut:'original',carat:'original',gem:'original',plating:'white',surface:'polished'};
export function parseStyling(input:unknown):ReferenceStyling|null{
  if(!input||typeof input!=='object')return null;
  const {cut,carat,gem,plating,surface}=input as Partial<ReferenceStyling>;
  if(!cut||(cut!=='original'&&!ATELIER_GEMS.some(shape=>shape.id===cut)))return null;
  if(!carat||(carat!=='original'&&!CARATS.includes(carat)))return null;
  if(!gem||!GEM_SAMPLES.some(stone=>stone.id===gem))return null;
  if(!plating||!Object.hasOwn(PLATING,plating)||!surface||!Object.hasOwn(SURFACES,surface))return null;
  return {cut,carat,gem,plating,surface};
}
export function isCustomStyling(style?:ReferenceStyling){
  return !!style&&Object.entries(ORIGINAL_STYLING).some(([key,value])=>style[key as keyof ReferenceStyling]!==value);
}
export const gemSample=(id:ReferenceStyling['gem'])=>GEM_SAMPLES.find(stone=>stone.id===id)!;
export const caratLabel=(value:ReferenceStyling['carat'])=>value==='original'?'原款大小':value===3?'3+ ct':value+' ct';
export function centerStoneLabel(style:ReferenceStyling){
  const {name,family}=gemSample(style.gem);
  return [family,name,style.cut==='original'?'原款切形':atelierGem(style.cut).name,caratLabel(style.carat)].join(' · ');
}
