import {preload} from 'react-dom';
import type {CatalogRing} from '../catalog';
import {STUDIO_ENVIRONMENT} from '../../viewer/studioEnvironment';
export function loadReferenceRing(template:CatalogRing){
  preload(template.image,{as:'image'});
  for(const href of [template.model,STUDIO_ENVIRONMENT.url])preload(href,{as:'fetch',crossOrigin:'anonymous'});
  return import('./SourceRingStudio');
}
