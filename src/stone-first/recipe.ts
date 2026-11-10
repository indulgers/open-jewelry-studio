/** Stone-first parametric jewelry grammar. Units are millimeters at the UI boundary;
 * the renderer uses 0.1 scene units / mm. Visual approximation, not certified CAD. */
export type RingStructure='slim'|'wide'|'signet'|'open'|'wrap';
export type VisualGrammar='flow'|'floral'|'rhythm'|'architectural';
export type GemSetting='none'|'solitaire'|'graduated'|'line'|'pave'|'nodes';
export type MountType='prong'|'bezel'|'channel'|'bead';
export type GemCut='round'|'oval'|'rectangle';
export const GEM_CUTS=[['round','圆形明亮式'],['oval','椭圆形'],['rectangle','长方形阶梯式']] as const;
export type RecipeId='floral-solitaire'|'floral-pave'|'architectural-halo'|'flowing-shoulder'|'geometry-eternity'|'leaf-nodes';
export type Parameters={bend:number;blend:number;rotation:number;repeat:number;emphasis:number;taper:number};
export type Design={
  recipe:RecipeId;structure:RingStructure;grammar:VisualGrammar;setting:GemSetting;mount:MountType;
  metal:'white'|'yellow'|'rose';gemCut:GemCut;ringDiameter:number;mainDiameter:number;accentDiameter:number;
  gapMm:number;crownLiftMm:number;seatDepthMm:number;prongCount:4|6;parameters:Parameters;
};
export type Site={id:string;kind:'main'|'accent';zone:'center'|'petal'|'shoulder'|'rim';x:number;y:number;z:number;diameter:number;tilt:number;angle:number;mount:MountType;leaf?:number;t?:number;u?:number};
export type Check={severity:'pass'|'advice'|'block'|'unverified';title:string;detail:string};
export const STRUCTURES=[['slim','细戒臂'],['wide','宽戒臂'],['signet','戒面式'],['open','开口式'],['wrap','环绕式']] as const;
export const GRAMMARS=[['flow','流线曲面'],['floral','花瓣'],['rhythm','几何重复'],['architectural','建筑结构']] as const;
export const SETTINGS=[['none','无钻纯金属'],['solitaire','主石聚焦'],['graduated','渐变点缀'],['line','沿线排钻'],['pave','局部密镶'],['nodes','结构节点镶']] as const;
export const MOUNTS=[['prong','爪镶'],['bezel','包镶'],['channel','轨道镶'],['bead','密钉镶']] as const;
export const PARAMS=[
 ['bend','弯曲',0.7,1.3,0.05],['blend','融合过渡',0.25,1,0.05],
 ['rotation','旋转',-30,30,5],['repeat','模组重复',3,8,1],
 ['emphasis','局部放大',0.75,1.25,0.05],['taper','厚薄渐变',0.7,1.3,0.05],
] as const;
const BASE:Parameters={bend:1,blend:0.75,rotation:0,repeat:4,emphasis:1,taper:1};
export const RECIPES:{id:RecipeId;name:string;description:string;structure:RingStructure;grammar:VisualGrammar;setting:GemSetting;mount:MountType;mainDiameter:number;accentDiameter:number}[]=[
 {id:'floral-solitaire',name:'四瓣主钻戒',description:'中心圆钻 + 花瓣金属承托',structure:'slim',grammar:'floral',setting:'solitaire',mount:'prong',mainDiameter:4.6,accentDiameter:0.85},
 {id:'floral-pave',name:'花瓣密镶戒',description:'交错铺钻 + 中心主石',structure:'signet',grammar:'floral',setting:'pave',mount:'bead',mainDiameter:3.1,accentDiameter:0.78},
 {id:'architectural-halo',name:'建筑几何镶嵌',description:'中央主石 + 对称双肩宝石',structure:'wide',grammar:'architectural',setting:'line',mount:'channel',mainDiameter:4.3,accentDiameter:1.05},
 {id:'flowing-shoulder',name:'流线渐变戒',description:'雕塑曲线 + 两侧渐变钻石',structure:'wrap',grammar:'flow',setting:'graduated',mount:'prong',mainDiameter:4.1,accentDiameter:0.95},
 {id:'geometry-eternity',name:'几何满钻戒',description:'周期金属结构 + 连续宝石轨迹',structure:'wide',grammar:'rhythm',setting:'pave',mount:'bead',mainDiameter:2.5,accentDiameter:0.95},
 {id:'leaf-nodes',name:'叶片节点戒',description:'叶片交汇 + 结构性节点镶嵌',structure:'open',grammar:'floral',setting:'nodes',mount:'bezel',mainDiameter:3.5,accentDiameter:0.9}
];
export function recipeDesign(id:RecipeId):Design{
 const r=RECIPES.find(v=>v.id===id)??RECIPES[0];
 return {recipe:r.id,structure:r.structure,grammar:r.grammar,setting:r.setting,mount:r.mount,metal:'white',gemCut:id==='architectural-halo'?'rectangle':'round',
 ringDiameter:18,mainDiameter:r.mainDiameter,accentDiameter:r.accentDiameter,gapMm:0.14,crownLiftMm:.55,seatDepthMm:.12,prongCount:4,parameters:{...BASE}};
}
export function constrainDesign(input:Design):Design{
 const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:a));
 const parameters={...input.parameters};
 for(const [key,,min,max] of PARAMS)parameters[key]=clamp(parameters[key],min,max);
 parameters.repeat=Math.round(parameters.repeat);
 return {...input,parameters,ringDiameter:clamp(input.ringDiameter,15,23),
  mainDiameter:clamp(input.mainDiameter,2,6),accentDiameter:clamp(input.accentDiameter,0.55,1.4),
  gapMm:clamp(input.gapMm,0.10,0.3),crownLiftMm:clamp(input.crownLiftMm,.2,1.7),seatDepthMm:clamp(input.seatDepthMm,.06,.25),prongCount:input.prongCount===6?6:4};
}
export const MM=0.1;
export function bandRadius(d:Design){return d.ringDiameter*MM/2;}
/** Sculpted 4-8 petal centerlines, top surface approximation. All coordinates in scene units. */
export function petalSample(d:Design,petal:number,t:number,u:number){
 const n=d.parameters.repeat;
 const phi=2*Math.PI*petal/n+d.parameters.rotation*Math.PI/180+Math.PI/n;
 const rad=0.085+(0.56*d.parameters.emphasis*d.parameters.bend)*t;
 const width=0.295*d.parameters.emphasis*Math.pow(Math.max(0,Math.sin(Math.PI*t)),0.85);
 const x=Math.cos(phi)*rad-Math.sin(phi)*width*u;
 const z=Math.sin(phi)*rad+Math.cos(phi)*width*u;
 const y=bandRadius(d)+0.17+d.parameters.blend*0.045+0.085*(1-u*u)*Math.sin(Math.PI*t)+0.025*t;
 return {x,y,z,width,phi};
}
function shoulder(d:Design,x:number,z=0){
 const radius=bandRadius(d),theta=Math.acos(Math.max(-1,Math.min(1,x/radius)));
 const power=Math.pow(Math.max(0,Math.sin(theta)),4.5);
 const width=(d.structure==='slim'?.20:d.structure==='wide'?.38:d.structure==='signet'?.37:d.structure==='open'?.23:.28)
  +(d.structure==='signet'?.18:d.structure==='wide'?.07:0)*power;
 const halfWidth=width*d.parameters.taper/2;
 const thickness=(d.structure==='signet'?.175:.135)+(d.structure==='wide'?.035:0)+d.parameters.blend*.025*power;
 const zRatio=Math.min(.998,Math.abs(z)/Math.max(.01,halfWidth));
 const y=Math.sqrt(Math.max(0.16,radius*radius-x*x))+thickness*Math.sqrt(1-zRatio*zRatio);
 const tilt=Math.asin(Math.min(0.75,Math.max(-0.75,x/radius)));
 return {x,y,z,tilt};
}
function within(s:Site,others:Site[],gap:number){
 return others.every(v=>Math.hypot(s.x-v.x,s.z-v.z) >= (s.diameter+v.diameter)/2+gap*MM-1e-6);
}
function addSafe(out:Site[],candidate:Site,gapMm:number){
 if(within(candidate,out,gapMm))out.push(candidate);
}
export function buildStoneLayout(unbounded:Design):Site[]{
 const d=constrainDesign(unbounded),out:Site[]=[],r=bandRadius(d),main=d.mainDiameter*MM,small=d.accentDiameter*MM,gap=d.gapMm*MM;
 const mainEnabled=d.setting!=='none' && !(d.setting==='line' && d.grammar==='rhythm');
 if(mainEnabled){
  out.push({id:'center-main',kind:'main',zone:'center',x:0,y:r+0.22+d.crownLiftMm*MM,z:0,
   diameter:main,tilt:0,angle:0,mount:d.mount==='channel'||d.mount==='bead'?'prong':d.mount});
 }
 const add=(zone:Site['zone'],x:number,y:number,z:number,diameter=small,tilt=0,angle=0,mount:MountType=d.mount,metadata:Pick<Site,'leaf'|'t'|'u'>={})=>{
  addSafe(out,{id:'accent-'+out.length,kind:'accent',zone,x,y,z,diameter,tilt,angle,mount,...metadata},d.gapMm);
 };
 if(d.setting==='graduated'||d.setting==='line'){
  const num=d.setting==='graduated'?4:6;
  for(const side of [-1,1]){
   for(let i=0;i<num;i++){
    const x=side*(main/2+gap+small/2+0.035+i*(small+gap));
    if(Math.abs(x)>r*0.78)break;
    const s=shoulder(d,x);
    add('shoulder',x,s.y-d.seatDepthMm*MM,0,d.setting==='graduated'?Math.max(.045,small*(1-0.12*i)):small,s.tilt,0,
       d.setting==='line'?'channel':'prong');
   }
  }
 }
 if(d.setting==='nodes'){
  const count=d.grammar==='floral'?d.parameters.repeat:Math.max(4,d.parameters.repeat);
  const dist=main/2+small/2+gap+0.065;
  for(let i=0;i<count;i++){
   const theta=i*Math.PI*2/count+d.parameters.rotation*Math.PI/180;
   if(d.grammar==='floral'){
     const p=petalSample(d,i,.75,0);
     add('petal',p.x,p.y-d.seatDepthMm*MM,p.z,small,0,p.phi,'bezel',{leaf:i,t:.75,u:0});
   }else add('rim',Math.cos(theta)*dist,r+0.21,Math.sin(theta)*dist,small,0,theta,'bezel');
  }
 }
 if(d.setting==='pave'){
  if(d.grammar==='floral'){
   // Diamond sites follow each petal's physical envelope. Alternate rows are staggered.
   const pitch=small+gap;
   const rows=Math.max(4,Math.floor(0.65*d.parameters.emphasis/pitch));
   for(let leaf=0;leaf<d.parameters.repeat;leaf++)for(let row=0;row<rows;row++){
    const t=0.19+0.72*(row+0.5)/rows;
    const sample=petalSample(d,leaf,t,0);
    const span=2*(sample.width-small*0.62-gap*0.75);
    if(span<0)continue;
    const count=Math.max(1,Math.floor(span/pitch)+1);
    for(let col=0;col<count;col++){
      const along=(col-(count-1)/2)*pitch+((row%2===1&&count>1)?pitch*0.16:0);
      const u=sample.width>0?along/sample.width:0;
      if(Math.abs(u)>0.9||Math.abs(along)+small*.59>sample.width)continue;
      const p=petalSample(d,leaf,t,u);
      // The stone girdle is placed just under the perforated metal surface.
      add('petal',p.x,p.y-d.seatDepthMm*MM,p.z,small,0,p.phi,'bead',{leaf,t,u});
    }
   }
  }else{
   // Two or three close rows on the shoulder. Avoid the central bezel / prongs.
   const rows=d.structure==='wide'||d.structure==='signet'?3:2;
   const pitch=small+gap;
   for(const side of [-1,1])for(let row=0;row<rows;row++){
    const z=(row-(rows-1)/2)*pitch;
    for(let i=0;i<8;i++){
     const x=side*(main/2+gap+small/2+0.035+i*pitch+((row%2)?pitch*0.32:0));
     if(Math.abs(x)>r*0.82)continue;
     const s=shoulder(d,x,z);
     add('shoulder',x,s.y-d.seatDepthMm*MM,z,small,s.tilt,0,'bead');
    }
   }
  }
 }
 return out;
}
export function measureGaps(sites:Site[]){
 let min=Infinity;
 for(let i=0;i<sites.length;i++)for(let j=i+1;j<sites.length;j++){
  const a=sites[i],b=sites[j],gap=Math.hypot(a.x-b.x,a.z-b.z)-(a.diameter+b.diameter)/2;
  min=Math.min(min,gap/MM);
 }
 return Number.isFinite(min)?min:null;
}
export function checkDesign(input:Design,sites=buildStoneLayout(input)):Check[]{
 const d=constrainDesign(input),checks:Check[]=[],minGap=measureGaps(sites);
 checks.push({severity:'pass',title:'设计配方与镶嵌方案已关联',detail:'主石、配石和花瓣/戒肩由同一份参数化工程计算。'});
 if(d.gemCut!=='round')checks.push({severity:'advice',title:'非圆形宝石装配待核对',detail:'切形可在视觉上更换，但镶口的实际包边、长宽与爪位置尚未针对该切工执行 CAD 适配。'});
 if(d.setting!=='none'&&sites.length<=1&&d.setting!=='solitaire')checks.push({severity:'block',title:'没有形成预期的配钻布局',detail:'当前石径与结构留白不匹配；请缩小配石或更换适配模板。'});
 if(minGap!==null&&minGap+0.002<d.gapMm)checks.push({severity:'block',title:'石位间距不合格',detail:'最小净距 '+minGap.toFixed(3)+' mm；当前设计目标 '+d.gapMm.toFixed(2)+' mm。'});
 else if(minGap!==null)checks.push({severity:'pass',title:'石位平面净距',detail:'计算的最小平面腰棱净距 '+minGap.toFixed(3)+' mm（还未包括镶爪与工具间隙）。'});
 if(d.grammar==='floral'&&d.parameters.repeat>6)checks.push({severity:'advice',title:'花瓣数量较多',detail:'多瓣会压缩每片花瓣的密镶面积。可使用 4 或 5 瓣模板。'});
 if(d.setting==='pave'&&d.mount==='prong')checks.push({severity:'advice',title:'密镶已切换金属珠固定',detail:'小钻采用 bead 结构，中心主石仍保留独立承托。'});
 if(d.mainDiameter>=5.2&&d.prongCount===4)checks.push({severity:'advice',title:'大主石爪数复核',detail:'当前选用四爪，建议同时检查六爪或加固爪位方案。'});
 if(d.mainDiameter>5&&d.structure==='slim')checks.push({severity:'advice',title:'主石与细戒臂比例',detail:'建议增厚戒肩和扩大镶座连接，当前仅为概念模型。'});
 checks.push({severity:'unverified',title:'工业 CAD 验证尚未完成',detail:'尚未计算真实镶口布尔切削、局部金属壁厚、铸造余量及压爪工艺，不能直接用于制造。'});
 return checks;
}
export function summary(d:Design,sites=buildStoneLayout(d)){
 return {total:sites.length,main:sites.filter(x=>x.kind==='main').length,
  accent:sites.filter(x=>x.kind==='accent').length,minGapMm:measureGaps(sites)};
}
