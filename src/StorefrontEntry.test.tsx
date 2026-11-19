import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {StorefrontEntry} from './StorefrontEntry';
import {RING_CATALOG} from './stone-first/catalog';
import {bandStyle,refreshCatalogBandStyles} from './stone-first/reference/parts';
import {activePriceBook} from './stone-first/pricing';

const storefront='/api/model-admin/public/storefront.json';
const index='/api/model-admin/public/index.json';
const customId='order-test-style';
const serverStyle={...RING_CATALOG[1],id:customId,bandStructure:'发布的戒圈结构',bandFinish:'抛光',name:'云端款式'};
const catalog={catalog:[serverStyle],parts:{},prices:{revision:'server-book',bases:{},components:{}}};
const order={id:'request-one',workId:'work-one',title:'客户的申请',status:'待人工核价',createdAt:'2026-11-19T12:00:00Z'};

function responses(load:()=>Promise<Response>){
  const fetchMock=vi.fn(async(input:string,options?:RequestInit)=>{
    expect(options?.method??'GET').toBe('GET');
    switch(input){
      case storefront:return load();
      case index:return Response.json([{id:customId,revision:'v2',name:serverStyle.name,image:'/cover.jpg',pricing:{base:1780,head:0,band:0,pave:0}}]);
      case '/api/model-admin/community/session':return Response.json({account:{name:'gallery-reader'}});
      case '/api/model-admin/community/works':
      case '/api/model-admin/community/mine':return Response.json([]);
      case '/api/model-admin/community/orders':return Response.json([order]);
      default:throw new Error('Unexpected URL '+input);
    }
  });
  vi.stubGlobal('fetch',fetchMock);
  return fetchMock;
}

function navigate(hash:string){
  act(()=>{
    window.history.replaceState(null,'','/'+hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

beforeEach(()=>{
  vi.stubEnv('VITE_CLOUD_MODE','1');
  vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));
});
afterEach(()=>{
  vi.unstubAllGlobals();vi.unstubAllEnvs();
  window.history.replaceState(null,'','/');
  const custom=RING_CATALOG.findIndex(item=>item.id===customId);
  if(custom!==-1)RING_CATALOG.splice(custom,1);
  refreshCatalogBandStyles();
});

it.each([['#/community','设计社区'],['#/my-designs?order=request-one','我的设计']])('opens %s while the public storefront is unavailable',async(hash,title)=>{
  const fetchMock=responses(async()=>new Response(null,{status:503}));
  window.history.replaceState(null,'','/'+hash);
  render(<StorefrontEntry/>);
  expect(await screen.findByRole('heading',{name:title})).toBeVisible();
  if(hash.includes('order='))await waitFor(()=>expect(screen.getByText('客户的申请').closest('li')).toHaveFocus());
  else await screen.findByText('社区还没有公开作品。');
  expect(fetchMock.mock.calls.some(([url])=>url===storefront||url===index)).toBe(false);
});

it('gates commerce after leaving the community and retries published prices before showing catalog actions',async()=>{
  const load=vi.fn().mockResolvedValueOnce(new Response(null,{status:503}))
    .mockResolvedValueOnce(Response.json({...catalog,prices:null}))
    .mockResolvedValueOnce(Response.json(catalog));
  const fetchMock=responses(load);
  window.history.replaceState(null,'','/#/community');
  render(<StorefrontEntry/>);
  await screen.findByRole('heading',{name:'设计社区'});
  fireEvent.click(screen.getByRole('link',{name:'款式系列'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('款式暂时无法读取');
  expect(screen.queryByRole('heading',{name:'全部款式'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'重新加载'}));
  await waitFor(()=>expect(load).toHaveBeenCalledTimes(2));
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(fetchMock.mock.calls.some(([url])=>url===index)).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'重新加载'}));
  expect(await screen.findByRole('heading',{name:'云端款式'})).toBeVisible();
  expect(activePriceBook?.revision).toBe('server-book');
  expect(bandStyle(customId)?.name).toBe('发布的戒圈结构');
  expect(load).toHaveBeenCalledTimes(3);
});

it('ignores an outstanding catalog response after navigating to an order receipt',async()=>{
  let finish!:(value:Response)=>void;
  const fetchMock=responses(()=>new Promise(resolve=>{finish=resolve;}));
  window.history.replaceState(null,'','/#/diy/collection');
  render(<StorefrontEntry/>);
  expect(await screen.findByRole('status')).toHaveTextContent('正在准备款式');
  navigate('#/my-designs?order=request-one');
  expect(await screen.findByRole('heading',{name:'我的设计'})).toBeVisible();
  await act(async()=>finish(Response.json(catalog)));
  expect(await screen.findByRole('heading',{name:'客户的申请'})).toBeVisible();
  expect(fetchMock.mock.calls.some(([url])=>url===index)).toBe(false);
  expect(RING_CATALOG.some(item=>item.id===customId)).toBe(false);
});
