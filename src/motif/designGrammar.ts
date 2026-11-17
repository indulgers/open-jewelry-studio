/**
 * Xiangyan's original parametric design grammar, informed by publicly documented
 * setting techniques; brand product photos are references, never CAD assets.
 *
 * Three independent layers:
 *   Motif silhouette -> surface & setting -> wearable body and connector.
 * Rules are proposals for visual construction, NOT certified manufacturing limits.
 */
import profiles from './profiles.json';

export type MotifId=keyof typeof profiles;
export type Product='ring'|'necklace';
export type Technique='inlay'|'guilloche'|'sculpted'|'pave'|'cluster';
export type ShankStyle='classic'|'split'|'pave';
export type NecklaceMount='side'|'bail';
export type DesignPresetId='carnelian'|'malachite'|'sunburst'|'diamond-cluster'|'pave-flower'|'mirror-flower';
type Inlay='pearl'|'onyx'|'malachite'|'lapis'|'carnelian';
type Metal='yellow'|'rose'|'silver';

export type DesignPreset={
  id:DesignPresetId;name:string;short:string;technique:Technique;
  motif:MotifId;product:Product;metal:Metal;inlay:Inlay;
  edge:'double'|'smooth'|'none';shank:ShankStyle;necklaceMount:NecklaceMount;centerStone:boolean;
  note:string;
};

export const TECHNIQUES:Readonly<Record<Technique,{name:string;description:string;requires:string}>>={
  inlay:{name:'彩石嵌片',description:'独立彩色嵌片 + 金属底托 + 固定边框',requires:'均适用'},
  guilloche:{name:'放射雕纹',description:'金属面放射纹，保留轮廓与金属镶边',requires:'适合较宽实心轮廓'},
  sculpted:{name:'立体花瓣',description:'有弯曲体积的独立金属花瓣 + 中心爪镶',requires:'仅花朵'},
  pave:{name:'花瓣密钉',description:'宝石排布在镶嵌座中，避开边缘并保留金属余量',requires:'有足够填充面积的轮廓'},
  cluster:{name:'钻石花簇',description:'围绕中心主石的分离式石座与装饰底盘',requires:'四叶草/花卉'},
};

export const ALLOWED_TECHNIQUES:Readonly<Record<MotifId,readonly Technique[]>>={
  clover:['inlay','guilloche','pave','cluster'],
  flower:['inlay','sculpted','pave','cluster'],
  blossom:['inlay','sculpted','pave','cluster'],
  butterfly:['inlay','guilloche','pave'],
  heart:['inlay','guilloche','pave'],
  shell:['inlay','guilloche','pave'],
  feather:['inlay','guilloche','pave'],
};

export const PRESETS:readonly DesignPreset[]=[
  {id:'carnelian',name:'红玉髓·金珠',short:'彩石典藏',technique:'inlay',motif:'clover',product:'ring',metal:'yellow',inlay:'carnelian',edge:'double',shank:'classic',necklaceMount:'side',centerStone:true,note:'暖金×朱红，强调完整镶片及细金珠轮廓'},
  {id:'malachite',name:'绿纹·金珠',short:'自然纹理',technique:'inlay',motif:'clover',product:'ring',metal:'yellow',inlay:'malachite',edge:'double',shank:'classic',necklaceMount:'side',centerStone:true,note:'深绿石纹保留连续性，细金珠负责轮廓'},
  {id:'sunburst',name:'放射纹·金质',short:'光的纹理',technique:'guilloche',motif:'clover',product:'ring',metal:'yellow',inlay:'pearl',edge:'double',shank:'classic',necklaceMount:'side',centerStone:true,note:'以向心雕纹与金属起伏取代整片宝石'},
  {id:'diamond-cluster',name:'银白·群钻花簇',short:'繁复闪烁',technique:'cluster',motif:'blossom',product:'ring',metal:'silver',inlay:'pearl',edge:'none',shank:'pave',necklaceMount:'bail',centerStone:true,note:'中心石与周边小钻形成群簇，戒臂侧石呼应主石'},
  {id:'pave-flower',name:'花瓣·满钻',short:'花形密钉',technique:'pave',motif:'flower',product:'ring',metal:'rose',inlay:'pearl',edge:'smooth',shank:'split',necklaceMount:'bail',centerStone:true,note:'五瓣花的曲面铺钻，与分叉肩位形成呼应'},
  {id:'mirror-flower',name:'金属·立体花瓣',short:'雕塑花卉',technique:'sculpted',motif:'flower',product:'necklace',metal:'yellow',inlay:'pearl',edge:'none',shank:'classic',necklaceMount:'bail',centerStone:true,note:'利用曲面金属与单颗中心钻构成低复杂度优雅造型'},
];
/** Pave/cluster layouts are validated only at >= 15mm. Smaller scaling shrinks
 * their displayed metal edge allowance beneath the GIA-inspired 0.50mm target. */
export function minimumMotifSize(technique:Technique):number{
  return technique==='pave'||technique==='cluster'?15:11;
}
export function normalizeMotifSize(technique:Technique,requested:number):number{
  if(!Number.isFinite(requested))return minimumMotifSize(technique);
  return Math.min(20,Math.max(minimumMotifSize(technique),Math.round(requested)));
}
export function allowedTechniques(motif:MotifId):readonly Technique[]{return ALLOWED_TECHNIQUES[motif];}
export function compatibleTechnique(motif:MotifId,requested:Technique):Technique{
  return ALLOWED_TECHNIQUES[motif].includes(requested)?requested:'inlay';
}
export function compatibleShank(style:ShankStyle,product:Product):ShankStyle{
  return product==='ring'?style:'classic';
}
export type SettingPoint={x:number;y:number;radius:number;kind:'center'|'accent'};
export type SettingPlan={technique:Technique;sites:SettingPoint[];proposedMinEdgeMm:number;proposedMinGapMm:number;
  surface:'stone-inlay'|'engraved-metal'|'petals'|'gem-seats';
  constructionReady:false;warnings:string[]};

/** Scalar point-to-polygon distance, units in mm at the default 15mm motif. */
export function distanceToOutline(x:number,y:number,poly:readonly (readonly number[])[]):number{
  let distance=Infinity;
  for(let i=0;i<poly.length;i++){
    const p=poly[i],q=poly[(i+1)%poly.length];
    const dx=q[0]-p[0],dy=q[1]-p[1],ll=dx*dx+dy*dy;
    const t=ll?Math.max(0,Math.min(1,((x-p[0])*dx+(y-p[1])*dy)/ll)):0;
    distance=Math.min(distance,Math.hypot(x-p[0]-dx*t,y-p[1]-dy*t));
  }
  return distance;
}
export function inSilhouette(x:number,y:number,poly:readonly (readonly number[])[]):boolean{
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
const minDistance=(a:SettingPoint,b:SettingPoint)=>Math.hypot(a.x-b.x,a.y-b.y)-a.radius-b.radius;
/**
 * Hex-sample layout constrained by the source silhouette. Every proposed gem
 * has a simulated metal lip/setting allowance; no gem is simply scattered on
 * top of the OBJ. Real prong roots and bearing cuts still require CAD.
 */
export function settingPlan(motif:MotifId,technique:Technique):SettingPlan{
  const mode=compatibleTechnique(motif,technique);
  const poly=profiles[motif].outline;
  const edge=.50, gap=.22,sites:SettingPoint[]=[];
  if(mode==='pave'){
    const r=motif==='feather'?.44:.61, step=(r*2+gap);
    for(let row=-10;row<=10;row++)for(let col=-11;col<=11;col++){
      const x=(col+(Math.abs(row)%2)*.5)*step;
      const y=row*step*.866;
      const point={x,y,radius:r,kind:'accent' as const};
      if(inSilhouette(x,y,poly)&&distanceToOutline(x,y,poly)>=r+edge
         &&sites.every(other=>minDistance(other,point)>=gap-.0001))sites.push(point);
    }
  }else if(mode==='cluster'){
    const center={x:0,y:0,radius:.94,kind:'center' as const};
    if(inSilhouette(0,0,poly)&&distanceToOutline(0,0,poly)>1.42)sites.push(center);
    for(let layer=0;layer<2;layer++){
      const n=layer===0?7:12,rr=layer===0?2.6:4.5,r=layer===0?.70:.49;
      for(let i=0;i<n;i++){
        const angle=2*Math.PI*i/n+(layer===0?.15:.05);
        const p={x:Math.cos(angle)*rr,y:Math.sin(angle)*rr,radius:r,kind:'accent' as const};
        if(inSilhouette(p.x,p.y,poly)&&distanceToOutline(p.x,p.y,poly)>=r+edge
          &&sites.every(other=>minDistance(other,p)>=gap-.0001))sites.push(p);
      }
    }
  }
  const surface=mode==='inlay'?'stone-inlay':mode==='guilloche'?'engraved-metal':
    mode==='sculpted'?'petals':'gem-seats';
  const warnings=[
    ...(sites.length<5&&(mode==='cluster'||mode==='pave')?['当前轮廓的镶石位置不足，需调整尺寸或布局']:[]),
    '镶石位置为展示级占位；金属余量、实际切座深度和镶爪强度尚未通过珠宝工艺验证',
  ];
  return {technique:mode,sites,proposedMinEdgeMm:edge,proposedMinGapMm:gap,
    surface,constructionReady:false,warnings};
}
export function validatePreset(preset:DesignPreset){
  return {
    permitted:allowedTechniques(preset.motif).includes(preset.technique),
    motif:preset.motif,
    product:preset.product,
    technique:preset.technique,
    gemstonePositions:settingPlan(preset.motif,preset.technique).sites.length,
  };
}
