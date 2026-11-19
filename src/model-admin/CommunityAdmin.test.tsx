import {render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import type {Order} from '../community/client';
import {CommunityAdmin} from './CommunityAdmin';

const quote={amountFen:10,currency:'CNY' as const,description:'单件含工费',version:'1',issuedAt:'2026-11-18'};
function receipt(id:string,status:Order['status'],amountFen?:number){
  return {id,title:'款式'+id,status,workId:'w'+id,accountId:'acct',accountName:'买家',image:'/model.jpg',createdAt:'2026-11-17',
    quote:amountFen===undefined?undefined:{...quote,amountFen}};
}
function serve(orders:()=>Order[],write?:(body:Record<string,unknown>)=>Response){
  const fetch=vi.fn(async(path:string,init:RequestInit)=>{
    if(path.endsWith('local-admin-session'))return Response.json({admin:true});
    if(path.endsWith('admin/designs'))return Response.json([]);
    if(path.endsWith('admin/orders'))return Response.json(orders());
    if(write&&init.method==='POST')return write(JSON.parse(String(init.body)));
    throw Error(path);
  });
  vi.stubGlobal('fetch',fetch);
  return fetch;
}
afterEach(()=>vi.unstubAllGlobals());

it('filters the loaded list without fetching and sums only confirmed CNY prices in whole fen',async()=>{
  const orders=[
    receipt('待核','待人工核价'),receipt('受理','已受理'),receipt('待确认','已报价',225),receipt('关闭','已关闭',99999),
    receipt('甲','已下单',10),receipt('乙','已下单',20),receipt('旧','已下单'),receipt('异常','已下单',1.5),
  ];
  const fetch=serve(()=>orders);
  render(<CommunityAdmin/>);
  const filter=await screen.findByRole('combobox',{name:'申请状态'});
  const options=within(filter);
  for(const label of ['全部（8）','待人工核价（1）','已受理（1）','已报价（1）','已下单 · 未支付（4）','已关闭（1）']){
    expect(options.getByRole('option',{name:label})).toBeInTheDocument();
  }
  expect(screen.getByText('¥0.30',{selector:'strong'})).toBeVisible();
  expect(screen.getByText(/2 笔已下单申请缺少有效报价/)).toBeVisible();
  const reads=fetch.mock.calls.length;
  await userEvent.selectOptions(filter,'已报价');
  expect(screen.getByText('款式待确认 · 买家 · 已报价')).toBeVisible();
  expect(screen.queryByText('款式甲 · 买家 · 已下单 · 未支付')).toBeNull();
  expect(screen.getByText('¥0.30',{selector:'strong'})).toBeVisible();
  await userEvent.selectOptions(filter,'待人工核价');
  expect(screen.getByText('款式待核 · 买家 · 待人工核价')).toBeVisible();
  expect(screen.queryByText('款式待确认 · 买家 · 已报价')).toBeNull();
  expect(fetch.mock.calls).toHaveLength(reads);
});

it('updates queue counts on quotes, then counts a revised amount only after a confirmed receipt is read',async()=>{
  let row=receipt('甲','已受理');
  const fetch=serve(()=>[row],body=>{
    if(body.expectedQuoteVersion==='revised'){
      row={...row,status:'已下单'};
      return Response.json({error:'订单已变更'},{status:409});
    }
    row={...row,status:'已报价',quote:{...quote,amountFen:Number(body.amountFen),version:body.expected==='已报价'?'revised':'1'}};
    return Response.json(row);
  });
  render(<CommunityAdmin/>);
  const filter=await screen.findByRole('combobox',{name:'申请状态'});
  await userEvent.selectOptions(filter,'已受理');
  await userEvent.click(screen.getByText('款式甲 · 买家 · 已受理'));
  await userEvent.click(screen.getByRole('button',{name:'填写报价'}));
  await userEvent.type(screen.getByLabelText('一件总价（人民币元）'),'3.75');
  await userEvent.type(screen.getByLabelText('款式配置与费用范围'),'单件价格');
  await userEvent.click(screen.getByRole('button',{name:'发送报价'}));
  expect(await screen.findByText('此状态下暂无申请。')).toBeVisible();
  expect(screen.getByRole('option',{name:'已报价（1）'})).toBeInTheDocument();
  expect(screen.getByText('¥0.00')).toBeVisible();
  await userEvent.selectOptions(filter,'已报价');
  await userEvent.click(screen.getByText('款式甲 · 买家 · 已报价'));
  await userEvent.click(screen.getByRole('button',{name:'修改报价'}));
  await userEvent.clear(screen.getByLabelText('一件总价（人民币元）'));
  await userEvent.type(screen.getByLabelText('一件总价（人民币元）'),'5.16');
  await userEvent.click(screen.getByRole('button',{name:'发送报价'}));
  expect(await screen.findByText('¥5.16')).toBeVisible();
  expect(screen.getByText('¥0.00')).toBeVisible();
  await userEvent.click(screen.getByRole('button',{name:'修改报价'}));
  await userEvent.click(screen.getByRole('button',{name:'发送报价'}));
  await userEvent.click(await screen.findByRole('button',{name:'重新读取申请'}));
  await screen.findByRole('option',{name:'已下单 · 未支付（1）'});
  expect(screen.getByRole('combobox',{name:'申请状态'})).toHaveValue('已报价');
  expect(screen.getByText('此状态下暂无申请。')).toBeVisible();
  expect(screen.getByText('¥5.16')).toBeVisible();
  expect(fetch.mock.calls.filter(([path])=>path.endsWith('admin/orders'))).toHaveLength(2);
});

it('shows a zero total with no orders',async()=>{
  serve(()=>[]);
  render(<CommunityAdmin/>);
  expect(await screen.findByRole('option',{name:'全部（0）'})).toBeInTheDocument();
  expect(screen.getByText('¥0.00')).toBeVisible();
  expect(screen.getByText(/消费者提交后/)).toBeVisible();
  expect(screen.queryByText(/缺少有效报价/)).toBeNull();
});
