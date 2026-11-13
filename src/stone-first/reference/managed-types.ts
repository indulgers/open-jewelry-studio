import type {ComponentPrices,TemplatePrice} from '../pricing';
import type {ReferenceAssets} from './part-library';

export type LibrarySource = {
  id: string;
  name: string;
  revision: string;
  stock: boolean;
  assets: ReferenceAssets;
  model: string;
  source: string;
  editor?: string;
  surcharges?:ComponentPrices;
};

export type ManufacturingReview = {
  status:'pending'|'approved'|'rejected';
  minDiameter:number|null;
  maxDiameter:number|null;
  step:number|null;
  note:string;
};
export type TemplateSelection = {
  name: string;
  head: string;
  headStones: string;
  band: string;
  pave: string;
  review?:ManufacturingReview;
  basePrice?:number;
  pricing?:TemplatePrice;
};
export type TemplateDraft = TemplateSelection & {id: string; revision: string; updatedAt: string};
export type ManagedTemplate = {
  id: string;
  revision: string;
  name: string;
  headName: string;
  bandName: string;
  headId: string;
  bandId: string;
  library: Record<string, ReferenceAssets>;
  publishedAt?: string;
  review?:ManufacturingReview;
  basePrice?:number;
  pricing?:TemplatePrice;
};
export type PublishedTemplate = Pick<ManagedTemplate,'id'|'name'|'revision'|'headName'|'bandName'|'pricing'> & {url: string; image: string};

export async function fetchManaged<T>(path:string,signal:AbortSignal):Promise<T>{
  const response=await fetch(((import.meta.env.PROD||import.meta.env.VITE_CLOUD_MODE)?'/api/model-admin/public/':'/models/managed/')+path,{signal});
  if(!response.ok)throw new Error('款式暂不可用。');
  return response.json();
}

export const templateRoute = (id: string, revision: string) => '#/stonefirst/template/'+id+'/'+revision;
