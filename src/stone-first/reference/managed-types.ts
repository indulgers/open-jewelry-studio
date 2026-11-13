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
};
export type PublishedTemplate = Pick<ManagedTemplate,'id'|'name'|'revision'|'headName'|'bandName'> & {url: string; image: string};

export async function fetchManaged<T>(path:string,signal:AbortSignal):Promise<T>{
  if(import.meta.env.PROD){
    try{
      const response=await fetch('/api/model-admin/public/'+path,{signal});
      if(response.ok)return await response.json();
    }catch(error){if(signal.aborted)throw error;}
  }
  const response=await fetch('/models/managed/'+path,{signal});
  if(!response.ok)throw new Error('款式暂不可用。');
  return response.json();
}

export const templateRoute = (id: string, revision: string) => '#/stonefirst/template/'+id+'/'+revision;
