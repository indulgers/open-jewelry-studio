import type {CatalogRing} from '../catalog';
import partAssets from './part-assets.json';

type PartSource={sourceId?:string;head:string;band:string};

export function partCardImage(ring:CatalogRing,kind:'head'|'band',sources:Record<string,PartSource>=partAssets){
  if(ring.partViews?.[kind])return ring.partViews[kind];
  const releaseKey=kind==='head'?ring.headSourceId:ring.bandSourceId;
  const sourceId=releaseKey?sources[releaseKey]?.sourceId:ring.id;
  if(!sourceId||!Object.hasOwn(partAssets,sourceId)||!partAssets[sourceId as keyof typeof partAssets][kind].startsWith('/models/parts/'))return ring.image;
  return import.meta.env.BASE_URL+'part-views/'+sourceId+'-'+kind+'.webp';
}
