import {fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,beforeAll,expect,it,vi} from 'vitest';
import {CommunityAdmin} from '../model-admin/CommunityAdmin';
import {OrderHistory} from './OrderHistory';
import {quoteAmount,type Order} from './client';
import type {OrderQuote} from './order-quote';

const quote:OrderQuote={amountFen:98701,currency:'CNY',version:'v1',issuedAt:'2026-01-03T00:00:00Z',description:'花瓣镶座，一件，包含镶嵌工费。'};
const order:Order={id:'receipt',workId:'work',title:'花瓣戒指',status:'已报价',quote,createdAt:'2026-01-02T00:00:00Z'};
const owner={accountName:'limer',onAccountChanged:vi.fn(),onRefresh:vi.fn()};

beforeAll(()=>{
  HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  HTMLDialogElement.prototype.close=function(){this.open=false;};
});
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});

it('requires a second explicit action on the displayed quote and reloads the unpaid order',async()=>{
  const send=vi.fn(async()=>Response.json({...order,status:'已下单',orderedAt:quote.issuedAt}));
  vi.stubGlobal('fetch',send);
  const page=render(<OrderHistory {...owner} orders={[order]}/>);
  await userEvent.click(screen.getByRole('button',{name:'核对报价并下单'}));
  const dialog=within(screen.getByRole('dialog'));
  expect(dialog.getByText(quote.description)).toBeVisible();
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(dialog.getByRole('button',{name:'确认按 '+quoteAmount(quote)+' 下单'}));
  await waitFor(()=>expect(owner.onRefresh).toHaveBeenCalledTimes(1));
  expect(send).toHaveBeenCalledWith('/api/model-admin/community/orders/receipt/confirm',expect.objectContaining({
    method:'POST',body:JSON.stringify({expectedAccount:'limer',quoteVersion:'v1'}),
  }));
  page.rerender(<OrderHistory {...owner} orders={[{...order,status:'已下单',orderedAt:quote.issuedAt}]}/>);
  expect(screen.getByText('已下单 · 未支付')).toBeVisible();
  expect(screen.getByText(quote.description)).toBeVisible();
  expect(screen.queryByRole('button',{name:/下单/})).toBeNull();
});

it('keeps the reviewed amount fixed when newer terms arrive and requests a fresh review',async()=>{
  const send=vi.fn();vi.stubGlobal('fetch',send);
  const page=render(<OrderHistory {...owner} orders={[order]}/>);
  await userEvent.click(screen.getByRole('button',{name:'核对报价并下单'}));
  const revised={...quote,amountFen:95003,description:'仅含戒托。',version:'v2'};
  page.rerender(<OrderHistory {...owner} orders={[{...order,quote:revised}]}/>);
  expect(within(screen.getByRole('dialog')).getByText(quote.description)).toBeVisible();
  expect(screen.queryByRole('button',{name:/确认按/})).toBeNull();
  await userEvent.click(screen.getByRole('button',{name:'重新读取申请'}));
  expect(owner.onRefresh).toHaveBeenCalledTimes(1);
  expect(send).not.toHaveBeenCalled();
});

it('recovers from a lost response by reading the receipt before any further confirmation',async()=>{
  const send=vi.fn(async()=>{throw Error('连接中断');});vi.stubGlobal('fetch',send);
  render(<OrderHistory {...owner} orders={[order]}/>);
  await userEvent.click(screen.getByRole('button',{name:'核对报价并下单'}));
  await userEvent.click(screen.getByRole('button',{name:/确认按/}));
  expect(await screen.findByRole('alert')).toHaveTextContent('连接中断');
  expect(screen.queryByRole('button',{name:/确认按/})).toBeNull();
  await userEvent.click(screen.getByRole('button',{name:'重新读取申请'}));
  expect(owner.onRefresh).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledTimes(1);
});

it('drops the review and restores session state on an account conflict',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({code:'ACCOUNT_CHANGED',error:'账号已变更'},{status:409})));
  render(<OrderHistory {...owner} orders={[order]}/>);
  await userEvent.click(screen.getByRole('button',{name:'核对报价并下单'}));
  await userEvent.click(screen.getByRole('button',{name:/确认按/}));
  expect(owner.onAccountChanged).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(owner.onRefresh).not.toHaveBeenCalled();
});

it('accepts and prices a request in integer fen, revises the terms, then closes the displayed version',async()=>{
  const writes:Array<{path:string;body:Record<string,unknown>}>=[];
  const base={...order,quote:undefined,status:'待人工核价',accountName:'limer',accountId:'buyer',image:'/work.jpg'};
  let current:Order={...order,status:'待人工核价',quote:undefined};
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{
    const path=url.split('/community/')[1];
    if(path==='local-admin-session')return Response.json({admin:true});
    if(path==='admin/designs')return Response.json([]);
    if(path==='admin/orders')return Response.json([base]);
    const body=JSON.parse(String(init.body));
    writes.push({path,body});
    current=path.endsWith('/quote')?{...current,status:'已报价',quote:{...quote,amountFen:body.amountFen,description:body.description,version:'v'+writes.length}}:{...current,status:body.status};
    return Response.json(current);
  }));
  render(<CommunityAdmin/>);
  await userEvent.click(await screen.findByText('花瓣戒指 · limer · 待人工核价'));
  await userEvent.click(screen.getByRole('button',{name:'受理申请'}));
  await userEvent.click(await screen.findByRole('button',{name:'填写报价'}));
  const input=screen.getByLabelText('一件总价（人民币元）');
  const terms=screen.getByLabelText('款式配置与费用范围');
  fireEvent.change(terms,{target:{value:quote.description}});
  for(const value of ['0','-2','0.001','1000000.01','1e3']){
    fireEvent.change(input,{target:{value}});
    fireEvent.click(screen.getByRole('button',{name:'发送报价'}));
    expect(screen.getByRole('alert')).toHaveTextContent('最多两位小数');
  }
  expect(writes).toHaveLength(1);
  fireEvent.change(input,{target:{value:'1000000.00'}});
  fireEvent.click(screen.getByRole('button',{name:'发送报价'}));
  await userEvent.click(await screen.findByRole('button',{name:'修改报价'}));
  expect(screen.getByLabelText('款式配置与费用范围')).toHaveValue(quote.description);
  expect(screen.getByLabelText('一件总价（人民币元）')).toHaveValue('1000000.00');
  fireEvent.change(screen.getByLabelText('一件总价（人民币元）'),{target:{value:'0.29'}});
  fireEvent.click(screen.getByRole('button',{name:'发送报价'}));
  await userEvent.click(await screen.findByRole('button',{name:'关闭申请'}));
  await userEvent.click(screen.getByRole('button',{name:'确认关闭申请'}));
  expect(await screen.findByText('花瓣戒指 · limer · 已关闭')).toBeVisible();
  expect(writes).toEqual([
    {path:'admin/orders/buyer/receipt/status',body:{expected:'待人工核价',status:'已受理'}},
    {path:'admin/orders/buyer/receipt/quote',body:{expected:'已受理',expectedQuoteVersion:null,amountFen:100000000,description:quote.description}},
    {path:'admin/orders/buyer/receipt/quote',body:{expected:'已报价',expectedQuoteVersion:'v2',amountFen:29,description:quote.description}},
    {path:'admin/orders/buyer/receipt/status',body:{expected:'已报价',expectedQuoteVersion:'v3',status:'已关闭'}},
  ]);
  expect(screen.queryByRole('button',{name:'修改报价'})).toBeNull();
});

it('re-reads an admin conflict and leaves a concurrently confirmed order read-only',async()=>{
  let reads=0,writes=0;
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
    const path=url.split('/community/')[1];
    if(path==='local-admin-session')return Response.json({admin:true});
    if(path==='admin/designs')return Response.json([]);
    if(path==='admin/orders'){
      reads++;
      return Response.json([{...order,status:reads===1?'已报价':'已下单',image:'/work.jpg',accountName:'limer',accountId:'buyer'}]);
    }
    writes++;
    return Response.json({error:'申请或报价已更新，请刷新后重新查看。'},{status:409});
  }));
  render(<CommunityAdmin/>);
  await userEvent.click(await screen.findByText('花瓣戒指 · limer · 已报价'));
  await userEvent.click(screen.getByRole('button',{name:'修改报价'}));
  await userEvent.click(screen.getByRole('button',{name:'发送报价'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('申请或报价已更新');
  expect(screen.getByRole('button',{name:'发送报价'})).toBeDisabled();
  await userEvent.click(screen.getByRole('button',{name:'重新读取申请'}));
  await userEvent.click(await screen.findByText('花瓣戒指 · limer · 已下单 · 未支付'));
  expect(screen.queryByRole('button',{name:/修改报价|关闭申请/})).toBeNull();
  expect(writes).toBe(1);
});
