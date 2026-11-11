import type {FittedStone,RingDesign} from './model';

// Sample values in whole yuan. Replace this table with business-approved data for a live quote.
export const RING02_PRICE={
  version:'ring-02-demo-1',
  base:2280,
  leadTime:'7–10 个工作日',
  head:{halo:0,'four-prong':-200,bezel:-100},
  centerLarge:200,
  accentLarge:80,
  coloredAccent:100,
  longShoulder:120,
} as const;

const yuan=new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY',maximumFractionDigits:0});
export function formatYuan(amount:number){return yuan.format(amount);}
export function priceNote(amount:number){return amount?(amount>0?' +':' −')+formatYuan(Math.abs(amount)):'';}

export function estimateRing02(design:RingDesign){
  const price=RING02_PRICE;
  const accent=(spec:RingDesign['halo'])=>(spec.size>1?price.accentLarge:0)
    +(spec.appearance==='diamond'?0:price.coloredAccent);
  const amount=price.base+price.head[design.head]+(design.center.size>1?price.centerLarge:0)
    +(design.head==='halo'?accent(design.halo):0)+accent(design.shoulder)+(design.reach>1?price.longShoulder:0);
  return {amount,currency:'CNY' as const,version:price.version,leadTime:price.leadTime};
}

export type Detail={label:string;value:string};
export type DemoOrder={
  templateRevision:string;
  revision:string;
  confirmedAt:string;
  design:RingDesign;
  quote:ReturnType<typeof estimateRing02>;
  details:Detail[];
  stones:{id:string;zone:FittedStone['zone'];appearance:FittedStone['appearance'];placement:number[]}[];
};

const ORDER_PREFIX='open-jewelry-studio:diy-demo-order:';
export function hasDemoOrder(revision:string){
  try{return localStorage.getItem(ORDER_PREFIX+revision)!==null;}
  catch{return false;}
}
export function addDemoOrder(order:DemoOrder){
  const key=ORDER_PREFIX+order.revision;
  if(localStorage.getItem(key)!==null)return false;
  localStorage.setItem(key,JSON.stringify(order));
  return true;
}

export function demoOrders(){
  const orders:Pick<DemoOrder,'templateRevision'|'revision'|'confirmedAt'|'quote'|'details'>[]=[];
  for(let index=0;index<localStorage.length;index++){
    const key=localStorage.key(index);
    if(!key?.startsWith(ORDER_PREFIX))continue;
    try{
      const order=JSON.parse(localStorage.getItem(key)??'null');
      if(order&&typeof order.templateRevision==='string'&&order.revision===key.slice(ORDER_PREFIX.length)
        &&typeof order.confirmedAt==='string'&&Number.isFinite(Date.parse(order.confirmedAt))
        &&Number.isSafeInteger(order.quote?.amount)&&order.quote.amount>0&&order.quote.currency==='CNY'
        &&typeof order.quote.version==='string'&&typeof order.quote.leadTime==='string'&&Array.isArray(order.details)
        &&order.details.every((detail:Detail)=>detail&&typeof detail.label==='string'&&typeof detail.value==='string')){
        orders.push(order);
      }
    }catch{continue;}
  }
  return orders.sort((a,b)=>b.confirmedAt.localeCompare(a.confirmedAt));
}
