export type ComponentPrices={head:number;band:number;pave:number};
export type TemplatePrice=ComponentPrices&{base:number};
export type PriceBook={revision:string;components:Record<string,ComponentPrices>;bases:Record<string,number>};
export const ZERO_COMPONENT_PRICES:ComponentPrices={head:0,band:0,pave:0};
export const isMoney=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1000000&&Math.abs(value*100-Math.round(value*100))<1e-7;
export const sumMoney=(values:number[])=>values.reduce((sum,value)=>sum+Math.round(value*100),0)/100;
export function templateQuote(pricing:TemplatePrice,version:string){
  return {amount:sumMoney([pricing.base,pricing.head,pricing.band,pricing.pave]),currency:'CNY' as const,version,leadTime:'7–10 个工作日'};
}

// The published price book is fixed for the current browser visit; cart entries keep that snapshot.
export let activePriceBook:PriceBook|undefined;
export function setPriceBook(book:PriceBook){activePriceBook=book;}
export function componentTotal(headId:string,bandId:string,hasPave:boolean){
  const head=activePriceBook?.components[headId]??ZERO_COMPONENT_PRICES;
  const band=activePriceBook?.components[bandId]??ZERO_COMPONENT_PRICES;
  return sumMoney([head.head,band.band,hasPave?band.pave:0]);
}

export function combinationQuote(head:{id:string;price:{base:number;version:string;leadTime:string};zones:readonly string[]},band:{id:string;price:{version:string};zones:readonly string[]},appearance:Record<string,unknown>,book=activePriceBook){
  const headRates=book?.components[head.id]??ZERO_COMPONENT_PRICES;
  const bandRates=book?.components[band.id]??ZERO_COMPONENT_PRICES;
  const zones=[...head.zones.filter(zone=>zone!=='shoulder'),...band.zones.filter(zone=>zone==='shoulder')];
  return {amount:sumMoney([head.price.base,headRates.head,bandRates.band,band.zones.includes('shoulder')?bandRates.pave:0,zones.filter(zone=>appearance[zone]!=='diamond').length*100]),currency:'CNY' as const,
    version:head.price.version===band.price.version?head.price.version:head.price.version+':'+band.price.version,leadTime:head.price.leadTime};
}
