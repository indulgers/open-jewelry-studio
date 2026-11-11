import type {FittedStone,RingDesign,paveSpacing} from './model';
import {RING02_TEMPLATE} from './assets';

export const RING02_PRICE=RING02_TEMPLATE.price;

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
  thumbnail?:string;
  pave?:{units:'model';halo?:ReturnType<typeof paveSpacing>;shoulder:ReturnType<typeof paveSpacing>};
  stones:{id:string;zone:FittedStone['zone'];appearance:FittedStone['appearance'];placement:number[]}[];
};

const ORDER_PREFIX='open-jewelry-studio:diy-demo-order:';
function validThumbnail(value:unknown):value is string{
  return typeof value==='string'&&value.length<=80*1024&&/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(value);
}
export function hasDemoOrder(revision:string){
  try{return localStorage.getItem(ORDER_PREFIX+revision)!==null;}
  catch{return false;}
}
export function addDemoOrder(order:DemoOrder){
  if(!RING02_TEMPLATE.listed)throw new Error('当前款式已停售');
  const key=ORDER_PREFIX+order.revision;
  if(localStorage.getItem(key)!==null)return false;
  const thumbnail=validThumbnail(order.thumbnail)?order.thumbnail:undefined;
  try{localStorage.setItem(key,JSON.stringify({...order,thumbnail}));}
  catch(error){
    if(!thumbnail||!(error instanceof DOMException)||error.name!=='QuotaExceededError')throw error;
    localStorage.setItem(key,JSON.stringify({...order,thumbnail:undefined}));
  }
  return true;
}

export function demoOrders(){
  const orders:Pick<DemoOrder,'templateRevision'|'revision'|'confirmedAt'|'quote'|'details'|'thumbnail'>[]=[];
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
        orders.push({...order,thumbnail:validThumbnail(order.thumbnail)?order.thumbnail:undefined});
      }
    }catch{continue;}
  }
  return orders.sort((a,b)=>b.confirmedAt.localeCompare(a.confirmedAt));
}
