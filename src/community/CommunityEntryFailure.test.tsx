import {render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {StorefrontEntry} from '../StorefrontEntry';

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
