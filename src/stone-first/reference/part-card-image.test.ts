import {expect,it} from 'vitest';
import {createElement} from 'react';
import {fireEvent,render} from '@testing-library/react';
import {PartCard} from './PartLibrary';
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

it('selects the two independently published views for uploaded components',()=>{
  const ring={...RING_CATALOG[0],id:'uploaded-design',headSourceId:'version:head',bandSourceId:'version:band',
    partViews:{head:'/api/model-admin/public/one/rev/head-top.png',band:'/api/model-admin/public/one/rev/band-side.png'}};
  expect(partCardImage(ring,'head')).toBe(ring.partViews.head);
  expect(partCardImage(ring,'band')).toBe(ring.partViews.band);
});


it('labels historical whole-ring covers and shows an empty state when an image fails',()=>{
  const item={id:'older-ring',name:'旧款',image:RING_CATALOG[0].image};
  const {container,getByText,queryByText}=render(createElement(PartCard,{item,selected:false,onSelect:()=>{}}));
  expect(getByText('款式参考图')).toBeTruthy();
  fireEvent.error(container.querySelector('img')!);
  expect(getByText('暂无部件图')).toBeTruthy();
  expect(queryByText('款式参考图')).toBeNull();
});
