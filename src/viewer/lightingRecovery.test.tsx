import {Suspense} from 'react';
import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {useLoader} from '@react-three/fiber';
import {DataTexture} from 'three';
import {EXRLoader} from 'three/addons/loaders/EXRLoader.js';
import {REFERENCE_ASSETS} from '../assets/referenceManifest';
import {ViewerBoundary} from './ViewerBoundary';
import {clearJewelryLightingCache} from './JewelryLighting';

const urls=[REFERENCE_ASSETS.metalEnvironment,REFERENCE_ASSETS.gemEnvironment];
afterEach(()=>{useLoader.clear(EXRLoader,urls);});
function LightingProbe(){
  const textures=useLoader(EXRLoader,urls);
  return <output>{textures.length===2?'环境图已恢复':'缺少环境图'}</output>;
}
it('actually refetches failed EXRs and recovers after the user presses retry',async()=>{
  useLoader.clear(EXRLoader,urls);
  let fail=true;
  const requests:string[]=[],textures:DataTexture[]=[];
  // Only replace the network decoding boundary; React suspense cache stays real.
  vi.spyOn(EXRLoader.prototype,'load').mockImplementation((url,onLoad,_progress,onError)=>{
    requests.push(url);const texture=new DataTexture();textures.push(texture);
    queueMicrotask(()=>{if(fail)onError?.(new Error('Temporary EXR request failure'));else onLoad?.(texture,{width:1,height:1});});
    return texture;
  });
  const errors=vi.spyOn(console,'error').mockImplementation(()=>{});
  const user=userEvent.setup();
  render(<ViewerBoundary onRetry={clearJewelryLightingCache}><Suspense fallback={<p>载入中</p>}><LightingProbe/></Suspense></ViewerBoundary>);
  await screen.findByRole('button',{name:'重新加载模型'});
  fail=false;
  await user.click(screen.getByRole('button',{name:'重新加载模型'}));
  expect(await screen.findByText('环境图已恢复')).toBeInTheDocument();
  expect(requests).toEqual([urls[0],urls[1],urls[0],urls[1]]);
  textures.forEach(texture=>texture.dispose());errors.mockRestore();
});
