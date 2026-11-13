import {activePriceBook,componentTotal,isMoney,sumMoney} from '../pricing';
import type {FittedStone,RingDesign,paveSpacing} from './model';
import {RING02_TEMPLATE} from './assets';
import {RING_CATALOG} from '../catalog';
import type {ReferenceDesign} from '../reference/design';

export const RING02_PRICE=RING02_TEMPLATE.price;

const yuan=new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY',minimumFractionDigits:0,maximumFractionDigits:2});
export function formatYuan(amount:number){return yuan.format(amount);}
export function priceNote(amount:number){return amount?(amount>0?' +':' −')+formatYuan(Math.abs(amount)):'';}

export function estimateRing02(design:RingDesign){
  const price=RING02_PRICE;
  const accent=(spec:RingDesign['halo'])=>(spec.size>1?price.accentLarge:0)
    +(spec.appearance==='diamond'?0:price.coloredAccent);
  const amount=price.base+price.head[design.head]+(design.center.size>1?price.centerLarge:0)
    +(design.head==='halo'?accent(design.halo):0)+accent(design.shoulder)+(design.reach>1?price.longShoulder:0);
  return {amount:sumMoney([amount,componentTotal('ring-02','ring-02',true)]),currency:'CNY' as const,version:activePriceBook?.revision??price.version,leadTime:price.leadTime};
}

export type Detail={label:string;value:string};
export type DemoOrder={
  templateRevision:string;
  revision:string;
  confirmedAt:string;
  design:RingDesign|ReferenceDesign;
  quote:{amount:number;currency:'CNY';version:string;leadTime:string};
  details:Detail[];
  thumbnail?:string;
  managed?:{id:string;revision:string;name:string};
  pave?:{units:'model';halo?:ReturnType<typeof paveSpacing>;shoulder:ReturnType<typeof paveSpacing>};
  stones:{id:string;zone:FittedStone['zone'];appearance:FittedStone['appearance'];placement:number[]}[];
};

const ORDER_PREFIX='open-jewelry-studio:diy-demo-order:';
export const CART_CHANGED='xiangyan:cart-changed';
function validThumbnail(value:unknown):value is string{
  return typeof value==='string'&&value.length<=80*1024&&/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(value);
}
export function hasDemoOrder(revision:string){
  try{return localStorage.getItem(ORDER_PREFIX+revision)!==null;}
  catch{return false;}
}
export function addDemoOrder(order:DemoOrder){
  if(!validManaged(order.managed)&&!RING_CATALOG.some(template=>template.revision===order.templateRevision&&template.listed))throw new Error('当前款式已停售');
  const key=ORDER_PREFIX+order.revision;
  if(localStorage.getItem(key)!==null)return false;
  const thumbnail=validThumbnail(order.thumbnail)?order.thumbnail:undefined;
  try{localStorage.setItem(key,JSON.stringify({...order,thumbnail}));}
  catch(error){
    if(!thumbnail||!(error instanceof DOMException)||error.name!=='QuotaExceededError')throw error;
    localStorage.setItem(key,JSON.stringify({...order,thumbnail:undefined}));
  }
  window.dispatchEvent(new Event(CART_CHANGED));
  return true;
}

export function removeDemoOrder(revision:string){
  localStorage.removeItem(ORDER_PREFIX+revision);
  window.dispatchEvent(new Event(CART_CHANGED));
}

export function demoOrders(){
  const orders:(Pick<DemoOrder,'templateRevision'|'revision'|'confirmedAt'|'quote'|'details'|'thumbnail'|'pave'|'managed'>&{design?:unknown})[]=[];
  for(let index=0;index<localStorage.length;index++){
    const key=localStorage.key(index);
    if(!key?.startsWith(ORDER_PREFIX))continue;
    try{
      const order=JSON.parse(localStorage.getItem(key)??'null');
      if(order&&typeof order.templateRevision==='string'&&order.revision===key.slice(ORDER_PREFIX.length)
        &&typeof order.confirmedAt==='string'&&Number.isFinite(Date.parse(order.confirmedAt))
        &&isMoney(order.quote?.amount)&&order.quote.amount>0&&order.quote.currency==='CNY'
        &&typeof order.quote.version==='string'&&typeof order.quote.leadTime==='string'&&Array.isArray(order.details)
        &&order.details.every((detail:Detail)=>detail&&typeof detail.label==='string'&&typeof detail.value==='string')){
        orders.push({...order,managed:validManaged(order.managed)?order.managed:undefined,thumbnail:validThumbnail(order.thumbnail)?order.thumbnail:undefined});
      }
    }catch{continue;}
  }
  return orders.sort((a,b)=>b.confirmedAt.localeCompare(a.confirmedAt));
}

function validManaged(value:unknown):value is NonNullable<DemoOrder['managed']>{
  if(!value||typeof value!=='object')return false;
  const v=value as Record<string,unknown>;
  return typeof v.id==='string'&&typeof v.revision==='string'&&[v.id,v.revision].every(id=>/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id))&&typeof v.name==='string'&&v.name.length>0&&v.name.length<=60;
}
