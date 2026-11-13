import type {CatalogRing} from '../../src/stone-first/catalog.ts';

export function processModel(action:'analyze'|'export',job:string,output:string|undefined,options:{
  catalog:CatalogRing[];
  seatHeights:Record<string,number>;
  referencePartRole:(id:string,name:string)=>string;
  root?:string;
}):Promise<void>;
