import {act,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {StorefrontEntry} from '../StorefrontEntry';

vi.mock('./CommunityStudio',()=>{throw new Error('Chunk unavailable');});
vi.mock('./CommunityEntry',()=>{throw new Error('Chunk unavailable');});
afterEach(()=>{
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  window.history.replaceState(null,'','/');
});

it('offers a full page reload on a receipt deep link when the community bundle cannot be loaded',async()=>{
  vi.stubEnv('VITE_CLOUD_MODE','1');
  const fetch=vi.fn();
  vi.stubGlobal('fetch',fetch);
  window.history.replaceState(null,'','/#/my-designs?order=abc');
  render(<StorefrontEntry/>,{onCaughtError:()=>{}});
  expect(await screen.findByRole('alert')).toHaveTextContent('作品页面暂时无法打开');
  expect(screen.getByRole('button',{name:'重新载入页面'})).toBeVisible();
  expect(fetch).not.toHaveBeenCalled();
});

it('offers recovery when community navigation fails after the storefront opens',async()=>{
  vi.stubEnv('VITE_CLOUD_MODE','');
  vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json([])));
  window.history.replaceState(null,'','/#/diy/collection');
  render(<StorefrontEntry/>,{onCaughtError:()=>{}});
  await screen.findByRole('article',{name:'围钻戒指'});
  await act(async()=>{
    window.history.replaceState(null,'','/#/my-designs?order=abc');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  expect(await screen.findByRole('alert')).toHaveTextContent('作品页面暂时无法打开');
  expect(screen.getByRole('button',{name:'重新载入页面'})).toBeVisible();
});
