import {jewelryModelLoader} from '../../viewer/modelLoader';
import {combineReferenceRings,prepareReferenceBand,prepareReferenceGeometry,type ReferenceHead,type ReferenceBand} from './model';
import {LEGACY_HALO_COLLARS} from './parts';
import assets from './part-assets.json';

export type ReferenceAssets={
  zones?:readonly ('center'|'halo'|'shoulder')[];sourceId?:string;scale:number;axisY:number;seatY:number;head:string;band:string;headStones:string;pave?:string;adapter?:string;classified?:boolean;profileId?:string;
};
const library:Record<string,ReferenceAssets>=assets;
type Geometry=ReturnType<typeof prepareReferenceGeometry>;
type ReadPart=(url:string,signal:AbortSignal)=>Promise<ArrayBuffer>;

async function readPart(url:string,signal:AbortSignal){
  const response=await fetch(url,{signal});
  if(!response.ok)throw new Error('戒指部件不可用');
  return response.arrayBuffer();
}

export function createReferenceLibrary(read:ReadPart=readPart, sources:Record<string,ReferenceAssets>=library){
  const controller=new AbortController();
  const geometry=new Map<string,Promise<Geometry>>();
  const combinations=new Map<string,Promise<{stock:ReturnType<typeof combineReferenceRings>;band:ReferenceBand}>>();
  const heads=new Map<string,Promise<ReferenceHead>>();
  const bands=new Map<string,Promise<ReferenceBand>>();
  const order=(a:{sourceOrder?:number},b:{sourceOrder?:number})=>(a.sourceOrder??0)-(b.sourceOrder??0);

  function cached<T>(cache:Map<string,Promise<T>>,key:string,load:()=>Promise<T>){
    const pending=cache.get(key);
    if(pending)return pending;
    const result=load().catch(error=>{cache.delete(key);throw error;});
    cache.set(key,result);
    return result;
  }

  function part(source:ReferenceAssets,url:string):Promise<Geometry>{
    return cached(geometry,JSON.stringify([url,source.scale,source.axisY]),async()=>{
      const data=await read(url,controller.signal);
      controller.signal.throwIfAborted();
      const {scene}=await jewelryModelLoader().parseAsync(data,'');
      const result=prepareReferenceGeometry(scene,source.scale,source.axisY);
      if(controller.signal.aborted){result.dispose();controller.signal.throwIfAborted();}
      if(!result.metal.length&&!result.stones.length&&!result.reflowShank)throw new Error('戒指部件为空');
      return result;
    });
  }

  function head(id:string){
    return cached(heads,id,async()=>{
      const source=sources[id];
      const [metal,stones]=await Promise.all([part(source,source.head),part(source,source.headStones)]);
      if(!metal.metal.length||!stones.stones.some(stone=>stone.zone==='center'))throw new Error('戒头缺少主石或镶座');
      return {id:source.sourceId??id,classified:source.classified,profileId:source.profileId,seatY:source.seatY,metal:metal.metal,stones:stones.stones};
    });
  }

  function band(id:string){
    return cached(bands,id,async()=>{
      const source=sources[id];
      const [base,pave,adapter]=await Promise.all([
        part(source,source.band),
        source.pave&&part(source,source.pave),
        source.adapter&&part(source,source.adapter),
      ]);
      const metal=[...base.metal,...(pave?pave.metal:[]),...(adapter?adapter.metal:[])].sort(order);
      if(!metal.length)throw new Error('戒圈缺少金属结构');
      return prepareReferenceBand({id:source.sourceId??id,classified:source.classified,profileId:source.profileId,seatY:source.seatY,metal,supportMetal:base.metal,paveMetalNames:pave?pave.metal.map(part=>part.name):[],stones:pave?pave.stones:[],reflowShank:base.reflowShank});
    });
  }

  return {
    load(headId:string,bandId:string){
      return cached(combinations,JSON.stringify([headId,bandId]),async()=>{
      const source=sources[headId];
      const needsAdapter=(source.profileId??source.sourceId??headId)==='ring-02'&&
        Object.hasOwn(LEGACY_HALO_COLLARS,sources[bandId].profileId??sources[bandId].sourceId??bandId);
      const [selectedHead,selectedBand,adapter]=await Promise.all([
        head(headId),band(bandId),
        needsAdapter&&source.adapter?part(source,source.adapter):undefined,
      ]);
      return {stock:combineReferenceRings(selectedHead,selectedBand,adapter?.metal[0]),band:selectedBand};
      });
    },
    dispose(){
      controller.abort();
      for(const result of bands.values())void result.then(band=>band.disposePave(),()=>{});
      for(const result of geometry.values())void result.then(part=>part.dispose(),()=>{});
      for(const result of combinations.values())void result.then(({stock})=>stock.metal.filter(part=>part.name==='head:connection').forEach(part=>part.geometry.dispose()),()=>{});
      heads.clear();bands.clear();geometry.clear();combinations.clear();
    },
  };
}
