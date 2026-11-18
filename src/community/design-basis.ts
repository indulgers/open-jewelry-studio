import type {CatalogRing} from '../stone-first/catalog.ts';

export type VersionRef={id:string;revision:string};
export type DesignBasisInput={template:VersionRef;head:VersionRef;band:VersionRef};
export type DesignBasis={template:VersionRef;head:VersionRef&{sourceId:string};band:VersionRef&{sourceId:string}};

function catalogVersion(ring:CatalogRing):VersionRef{
  return ring.publication??{id:ring.id,revision:ring.revision};
}
export function referenceDesignBasis(template:CatalogRing,head:CatalogRing,band:CatalogRing):DesignBasisInput{
  return {template:catalogVersion(template),head:catalogVersion(head),band:catalogVersion(band)};
}
export function fixedDesignBasis({id,revision}:VersionRef):DesignBasisInput{
  const source={id,revision};
  return {template:source,head:source,band:source};
}
