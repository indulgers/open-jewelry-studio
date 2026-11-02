import {useEffect} from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import App from './App';
import type {ProductImage} from './assets/productMedia';

vi.mock('./viewer/JewelryStage',()=>({JewelryStage:({onCaptureReady,onCaptureProgress,onImages,captureRequest}: {
  onCaptureReady:(ready:boolean)=>void;onCaptureProgress:(message:string)=>void;onImages:(images:ProductImage[])=>void;captureRequest:number;
})=>{
  useEffect(()=>{onCaptureReady(false);return()=>onCaptureReady(false);},[onCaptureReady]);
  return <><button onClick={()=>onCaptureReady(true)}>测试模型就绪</button>
    <button onClick={()=>{onImages([{view:'overall',label:'整体',url:'/current.jpg'}]);onCaptureProgress('4 张商品预览已生成，可逐张下载。');}}>测试完成</button>
    <output aria-label="待处理出图请求">{captureRequest}</output></>;
}}));

beforeEach(()=>{
  window.history.replaceState(null,'','/');
  vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:()=>{},removeEventListener:()=>{}}));
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
async function loaded(){render(<App/>);await screen.findByRole('button',{name:'测试模型就绪'});}
const exportButton=()=>screen.getByRole('button',{name:'生成四个角度的商品图'});

describe('product export lifecycle',()=>{
  it('opens the matching catalog immediately and renders other finishes before showing their gallery',async()=>{
    await loaded();fireEvent.click(screen.getByRole('button',{name:'商品图片'}));
    expect(screen.getByRole('img',{name:'当前配置 · 整体'})).toHaveAttribute('src','/media/sample/overall.jpg');
    fireEvent.click(screen.getByRole('radio',{name:'玫瑰金色'}));
    fireEvent.click(await screen.findByText('测试模型就绪'));
    fireEvent.click(screen.getByRole('button',{name:'商品图片'}));
    expect(screen.queryByRole('img',{name:'当前配置 · 整体'})).toBeNull();
    expect(screen.getByLabelText('待处理出图请求')).toHaveTextContent('1');
    fireEvent.click(screen.getByText('测试完成'));
    expect(screen.getByRole('img',{name:'当前配置 · 整体'})).toHaveAttribute('src','/current.jpg');
  });
  it('waits for a usable renderer and clears a consumed request before remounting 3D',async()=>{
    await loaded();expect(exportButton()).toBeDisabled();
    fireEvent.click(screen.getByText('测试模型就绪'));expect(exportButton()).toBeEnabled();
    fireEvent.click(exportButton());expect(screen.getByLabelText('待处理出图请求')).toHaveTextContent('1');
    fireEvent.click(screen.getByText('测试完成'));
    fireEvent.click(screen.getByRole('button',{name:'商品图片'}));
    fireEvent.click(screen.getByRole('button',{name:'实时 3D'}));
    expect(await screen.findByLabelText('待处理出图请求')).toHaveTextContent('0');
    fireEvent.click(screen.getByText('测试模型就绪'));fireEvent.click(exportButton());
    expect(screen.getByLabelText('待处理出图请求')).toHaveTextContent('1');
  });
  it('unlocks controls if the renderer stops producing frames',async()=>{
    await loaded();fireEvent.click(screen.getByText('测试模型就绪'));vi.useFakeTimers();
    fireEvent.click(exportButton());
    expect(screen.getByRole('button',{name:'商品图片'})).toBeDisabled();
    act(()=>vi.advanceTimersByTime(60000));
    expect(screen.getByText('生成超时，请等待预览恢复后重试。')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'商品图片'})).toBeEnabled();
    expect(screen.getByLabelText('待处理出图请求')).toHaveTextContent('0');
  });
});

describe('shared studio navigation',()=>{
  it('loads the module editor on demand and retains its frame across tabs',async()=>{
    await loaded();
    expect(screen.queryByTitle('FORME 模组 DIY 设计工作台')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab',{name:'模组 DIY'}));
    const frame=screen.getByTitle('FORME 模组 DIY 设计工作台');
    expect(frame).toHaveAttribute('src','/forme/index.html?embedded=1');
    expect(window.location.hash).toBe('#/modules');
    expect(screen.queryByText('测试模型就绪')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab',{name:'珠宝展台'}));
    await screen.findByRole('button',{name:'测试模型就绪'});
    fireEvent.click(screen.getByRole('tab',{name:'模组 DIY'}));
    expect(screen.getByTitle('FORME 模组 DIY 设计工作台')).toBe(frame);
  });
  it('opens shared designs in the module tab and supports browser navigation',async()=>{
    window.history.replaceState(null,'','/#/modules?design=example');
    render(<App/>);
    expect(screen.getByRole('tab',{name:'模组 DIY'})).toHaveAttribute('aria-selected','true');
    expect(screen.getByTitle('FORME 模组 DIY 设计工作台')).toHaveAttribute('src','/forme/index.html?embedded=1#design=example');
    act(()=>{window.history.replaceState(null,'','/#/showroom');window.dispatchEvent(new HashChangeEvent('hashchange'));});
    expect(screen.getByRole('tab',{name:'珠宝展台'})).toHaveAttribute('aria-selected','true');
    fireEvent.keyDown(screen.getByRole('tab',{name:'珠宝展台'}),{key:'ArrowRight'});
    expect(screen.getByRole('tab',{name:'模组 DIY'})).toHaveFocus();
  });
});
