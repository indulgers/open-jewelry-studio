import {useEffect} from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import App from './App';

vi.mock('./viewer/JewelryStage',()=>({JewelryStage:({onCaptureReady,onCaptureProgress,captureRequest}: {
  onCaptureReady:(ready:boolean)=>void;onCaptureProgress:(message:string)=>void;captureRequest:number;
})=>{
  useEffect(()=>{onCaptureReady(false);return()=>onCaptureReady(false);},[onCaptureReady]);
  return <><button onClick={()=>onCaptureReady(true)}>测试模型就绪</button>
    <button onClick={()=>onCaptureProgress('4 张商品预览已生成，可逐张下载。')}>测试完成</button>
    <output aria-label="待处理出图请求">{captureRequest}</output></>;
}}));

beforeEach(()=>{
  vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:()=>{},removeEventListener:()=>{}}));
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
async function loaded(){render(<App/>);await screen.findByRole('button',{name:'测试模型就绪'});}
const exportButton=()=>screen.getByRole('button',{name:'生成四个角度的商品图'});

describe('product export lifecycle',()=>{
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
