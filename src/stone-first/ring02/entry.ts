import {preload} from 'react-dom';
import {STUDIO_ENVIRONMENT} from '../../viewer/studioEnvironment';
import {RING02_TEMPLATE} from './assets';

export function loadRing02(){
  preload(RING02_TEMPLATE.image,{as:'image'});
  for(const href of [RING02_TEMPLATE.model,RING02_TEMPLATE.oval,STUDIO_ENVIRONMENT.url]){
    preload(href,{as:'fetch',crossOrigin:'anonymous'});
  }
  return import('./Ring02Studio');
}
