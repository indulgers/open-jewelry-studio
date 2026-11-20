export type ComponentPrices={head:number;band:number;pave:number};
export type TemplatePrice=ComponentPrices&{base:number};
export type PriceBook={revision:string;components:Record<string,ComponentPrices>;bases:Record<string,number>};
export const ZERO_COMPONENT_PRICES:ComponentPrices={head:0,band:0,pave:0};
export const maxPriceYuan=1_000_000;
export const isMoney=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=maxPriceYuan&&Math.abs(value*100-Math.round(value*100))<1e-7;
export const sumMoney=(values:number[])=>values.reduce((sum,value)=>sum+Math.round(value*100),0)/100;
export function templateQuote(pricing:TemplatePrice,version:string){
  return {amount:sumMoney([pricing.base,pricing.head,pricing.band,pricing.pave]),currency:'CNY' as const,version,leadTime:'7–10 个工作日'};
}

export type PriceQuote=ReturnType<typeof templateQuote>;
export function isPriceQuote(value:unknown):value is PriceQuote{
  if(!value||typeof value!=='object')return false;
  const quote=value as Partial<PriceQuote>;
  return isMoney(quote.amount)&&quote.amount>0&&quote.currency==='CNY'
    &&typeof quote.version==='string'&&quote.version.trim().length>0
    &&typeof quote.leadTime==='string'&&quote.leadTime.trim().length>0;
}

// The published price book is fixed for the current browser visit; cart entries keep that snapshot.
export let activePriceBook:PriceBook|undefined;
export function setPriceBook(book:PriceBook){activePriceBook=book;}
export function componentTotal(headId:string,bandId:string,hasPave:boolean){
  const head=activePriceBook?.components[headId]??ZERO_COMPONENT_PRICES;
  const band=activePriceBook?.components[bandId]??ZERO_COMPONENT_PRICES;
  return sumMoney([head.head,band.band,hasPave?band.pave:0]);
}

export function combinationQuote(head:{id:string;price:{base:number;version:string;leadTime:string};zones:readonly string[]},band:{id:string;price:{version:string};zones:readonly string[]},_appearance:Record<string,unknown>,book=activePriceBook){
  const headRates=book?.components[head.id]??ZERO_COMPONENT_PRICES;
  const bandRates=book?.components[band.id]??ZERO_COMPONENT_PRICES;
  return {amount:sumMoney([head.price.base,headRates.head,bandRates.band,band.zones.includes('shoulder')?bandRates.pave:0]),currency:'CNY' as const,
    version:head.price.version===band.price.version?head.price.version:head.price.version+':'+band.price.version,leadTime:head.price.leadTime};
}
