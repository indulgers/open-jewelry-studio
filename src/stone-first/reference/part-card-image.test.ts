import {expect,it} from 'vitest';
import {RING_CATALOG} from '../catalog';
import {partCardImage} from './part-card-image';

it.each(RING_CATALOG)('serves independent head and band images of $id', ring=>{
  expect(partCardImage(ring,'head')).toContain(ring.id+'-head.webp');
  expect(partCardImage(ring,'band')).toContain(ring.id+'-band.webp');
});

it('uses the actual published preview for a custom combination',()=>{
  const ring={...RING_CATALOG[0],id:'published-custom',image:'/custom-revision.jpg'};
  expect(partCardImage(ring,'head')).toBe('/custom-revision.jpg');
  expect(partCardImage(ring,'band')).toBe('/custom-revision.jpg');
});

it('resolves each released slot separately, including a stock head paired with an uploaded band',()=>{
  const ring={...RING_CATALOG[0],image:'/release/preview.jpg',headSourceId:'release:head',bandSourceId:'release:band'};
  const sources={
    'release:head':{sourceId:'ring-floral',head:'/public/h.glb',band:'/public/b.glb'},
    'release:band':{sourceId:'uploaded-part',head:'/public/h.glb',band:'/public/b.glb'},
  };
  expect(partCardImage(ring,'head',sources)).toContain('ring-floral-head.webp');
  expect(partCardImage(ring,'band',sources)).toBe('/release/preview.jpg');
});
