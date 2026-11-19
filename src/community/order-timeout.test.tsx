import {act,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,beforeAll,expect,it,vi} from 'vitest';
import {OrderHistory} from './OrderHistory';
import {WorkRequestDialog} from './WorkRequestDialog';
import type {Order,Work} from './client';

const account={name:'local_buyer'};
const work:Work={id:'work-one',title:'月桂',author:'相言',image:'/work.jpg',published:true,createdAt:'2026-10-01'};
const quoted:Order={id:'ticket',title:work.title,workId:work.id,status:'已报价',createdAt:work.createdAt,
  quote:{version:'v1',description:'镶嵌工费及银托',issuedAt:work.createdAt,currency:'CNY',amountFen:188000}};
const noAction=()=>{};
const requestProps={work,account,onLogin:noAction,onClose:noAction,onAccountChanged:noAction,onWithdrawn:noAction};
beforeAll(()=>{
  HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  HTMLDialogElement.prototype.close=function(){this.open=false;};
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

it('unlocks a timed-out request, retries the same work once and ignores its late response',async()=>{
  vi.useFakeTimers();
  let respond!:(response:Response)=>void;
  const send=vi.fn<(url:string,init:RequestInit)=>Promise<Response>>()
    .mockImplementationOnce(()=>new Promise(resolve=>{respond=resolve;}))
    .mockResolvedValueOnce(Response.json(quoted));
  vi.stubGlobal('fetch',send);
  render(<WorkRequestDialog {...requestProps}/>);
  fireEvent.click(screen.getByRole('button',{name:'确认提交申请'}));
  const signal=send.mock.calls[0][1].signal!;
  expect(signal.aborted).toBe(false);
  act(()=>{vi.advanceTimersByTime(15_000);});
  expect(signal.aborted).toBe(true);
  expect(screen.getByRole('alert')).toHaveTextContent('尚未确认工作室是否收到申请');
  expect(screen.getByRole('button',{name:'取消'})).toBeEnabled();
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'重试提交'}));});
  const receipt=within(screen.getByRole('dialog',{name:'同款申请回执'}));
  expect(receipt.getByText('ticket')).toBeVisible();
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls.map(([url,init])=>[url,init.body])).toEqual(Array(2).fill([
    '/api/model-admin/community/works/work-one/orders',JSON.stringify({expectedAccount:account.name}),
  ]));
  await act(async()=>{respond(Response.json({...quoted,id:'late-result'}));});
  act(()=>{vi.advanceTimersByTime(30_000);});
  expect(receipt.getByText('ticket')).toBeVisible();
  expect(screen.queryByRole('alert')).toBeNull();
});

it('looks up the authoritative order after a stalled confirmation without sending another confirmation',()=>{
  vi.useFakeTimers();
  const send=vi.fn((_url:string,_init:RequestInit)=>new Promise<Response>(()=>{}));
  const refresh=vi.fn();
  vi.stubGlobal('fetch',send);
  const props={accountName:account.name,onAccountChanged:noAction,onRefresh:refresh};
  const page=render(<OrderHistory {...props} orders={[quoted]}/>);
  fireEvent.click(screen.getByRole('button',{name:'核对报价并下单'}));
  fireEvent.click(screen.getByRole('button',{name:/确认按/}));
  act(()=>{vi.advanceTimersByTime(15_000);});
  expect(send.mock.calls[0][1].signal?.aborted).toBe(true);
  expect(screen.getByRole('alert')).toHaveTextContent('尚未确认下单结果');
  fireEvent.click(screen.getByRole('button',{name:'重新读取申请'}));
  expect(refresh).toHaveBeenCalledOnce();
  page.rerender(<OrderHistory {...props} orders={[{...quoted,status:'已下单'}]}/>);
  expect(screen.getByText('已下单 · 未支付')).toBeVisible();
  expect(screen.queryByRole('button',{name:'核对报价并下单'})).toBeNull();
  expect(send).toHaveBeenCalledOnce();
});

it('aborts and releases the request deadline on unmount',()=>{
  vi.useFakeTimers();
  const send=vi.fn((_url:string,_init:RequestInit)=>new Promise<Response>(()=>{}));
  vi.stubGlobal('fetch',send);
  const page=render(<WorkRequestDialog {...requestProps}/>);
  fireEvent.click(screen.getByRole('button',{name:'确认提交申请'}));
  page.unmount();
  expect(send.mock.calls[0][1].signal?.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
