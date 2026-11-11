import {RING02_TEMPLATE} from './ring02/assets';

export type CatalogRing={
  id:string;kind:'parametric'|'reference';name:string;collection:string;subtitle:string;description:string;
  editor:string;revision:string;listed:boolean;model:string;image:string;campaign:string;
  price:{base:number;version:string;leadTime:string};
  zones:readonly ('center'|'halo'|'shoulder')[];stoneCount:number;
};
export const RING_CATALOG:CatalogRing[]=[{
  ...RING02_TEMPLATE,
  get listed(){return RING02_TEMPLATE.listed;},
  id:'ring-02',kind:'parametric',collection:'相映系列',
  subtitle:'圆形主石 · 分段围钻 · 镶钻戒臂',
  campaign:'/media/campaign/halo-on-model.jpg',zones:['center','halo','shoulder'],stoneCount:29,
},...[
  {id:'ring-floral',name:'花环戒指',collection:'花语系列',subtitle:'圆形主石 · 双层花环 · 素面戒臂',description:'细密配钻围合花环，圆形主石在层叠镶座之上舒展。',base:2380,zones:['center','halo'] as const,stoneCount:17},
  {id:'ring-rosette',name:'花冠戒指',collection:'花语系列',subtitle:'圆形主石 · 层叠花冠 · 纤细戒臂',description:'层叠的花瓣镂空托起主石，保留原作细致的金属雕饰。',base:2480,zones:['center','halo'] as const,stoneCount:3},
  {id:'ring-petal',name:'繁花戒指',collection:'花语系列',subtitle:'花瓣镶座 · 环绕配钻 · 密镶戒臂',description:'一圈配钻沿花瓣铺陈，光泽从戒面延续到两侧戒臂。',base:2580,zones:['center','halo','shoulder'] as const,stoneCount:35},
  {id:'ring-crown',name:'冠冕戒指',collection:'相守系列',subtitle:'圆形主石 · 高托镶座 · 双列配钻',description:'圆形主石与立体镶座相衬，戒臂的双列配钻延展银色光线。',base:2180,zones:['center','shoulder'] as const,stoneCount:17},
].map(({base,...ring})=>({...ring,kind:'reference' as const,editor:'#/stonefirst/'+ring.id,
  revision:ring.id+'-source-1',listed:true,model:'/models/atelier/'+ring.id+'/ring-v1.glb',
  image:'/media/diy/'+ring.id+'.jpg',campaign:'/media/campaign/'+ring.id+'-on-model.jpg',
  price:{base,version:ring.id+'-demo-1',leadTime:'7–10 个工作日'},
}))];
