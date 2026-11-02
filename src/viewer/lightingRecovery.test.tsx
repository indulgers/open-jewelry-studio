import {Suspense} from 'react';
import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {useLoader} from '@react-three/fiber';
import {DataTexture} from 'three';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {STUDIO_ENVIRONMENT} from './studioEnvironment';
import {ViewerBoundary} from './ViewerBoundary';
import {clearJewelryLightingCache} from './JewelryLighting';

const url=STUDIO_ENVIRONMENT.url;
afterEach(()=>{useLoader.clear(HDRLoader,url);vi.restoreAllMocks();});
function LightingProbe(){
  const texture=useLoader(HDRLoader,url);
  return <output>{texture.isDataTexture?'环境图已恢复':'缺少环境图'}</output>;
}
it('refetches the shared studio after a failed HDR request and retry',async()=>{
  useLoader.clear(HDRLoader,url);
  let fail=true;
  const requests:string[]=[],textures:DataTexture[]=[];
  // Only replace the network decoding boundary; React suspense cache stays real.
  vi.spyOn(HDRLoader.prototype,'load').mockImplementation((url,onLoad,_progress,onError)=>{
    requests.push(url);const texture=new DataTexture();textures.push(texture);
    queueMicrotask(()=>{if(fail)onError?.(new Error('Temporary HDR request failure'));else onLoad?.(texture,{width:1,height:1});});
    return texture;
  });
  const errors=vi.spyOn(console,'error').mockImplementation(()=>{});
  const user=userEvent.setup();
  render(<ViewerBoundary onRetry={clearJewelryLightingCache}><Suspense fallback={<p>载入中</p>}><LightingProbe/></Suspense></ViewerBoundary>);
  await screen.findByRole('button',{name:'重新加载模型'});
  fail=false;
  await user.click(screen.getByRole('button',{name:'重新加载模型'}));
  expect(await screen.findByText('环境图已恢复')).toBeInTheDocument();
  expect(requests).toEqual([url,url]);
  textures.forEach(texture=>texture.dispose());errors.mockRestore();
});
