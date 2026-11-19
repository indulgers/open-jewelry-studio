import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {DiyHome} from './DiyHome';
import userEvent from '@testing-library/user-event';
import {demoOrders,formatYuan} from './ring02/demoOrder';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  localStorage.clear();
  window.history.replaceState(null,'','/');
});

const ring = {
  id: '12345678-1234-1234-1234-123456789abc',
  revision: '87654321-4321-4321-4321-123456789abc',
  name: '花冠戒指', featured: true, image: '/flower.jpg',
};

it('lets a visitor compare the published wearing illustration and original without leaving the featured ring', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json([{
    id: 'rose', name: '玫瑰戒指', revision: 'v1', featured: true,
    campaign: '/wearing.jpg', image: '/original.jpg',
  }])));
  render(<DiyHome/>);
  await screen.findByRole('heading', {name: /让心意/});
  fireEvent.click(screen.getByRole('button', {name: '原款图'}));
  expect(screen.getByRole('img', {name: '玫瑰戒指原款图'})).toHaveAttribute('src', '/original.jpg');
  expect(screen.getByRole('button', {name: '原款图'})).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', {name: '佩戴图'}));
  expect(within(screen.getByRole('region',{name:/让心意/})).getByRole('img', {name: '玫瑰戒指 AI 佩戴示意'})).toHaveAttribute('src', '/wearing.jpg');
});

it('shows the bundled rings in local development when nothing has been published', async () => {
  vi.stubEnv('DEV',true);
  vi.stubEnv('VITE_CLOUD_MODE','');
  vi.stubGlobal('fetch', vi.fn(async () => Response.json([])));
  render(<DiyHome/>);
  await screen.findByRole('heading', {name: /让心意/});
  expect(screen.getByRole('link',{name:'开始专属定制'})).toHaveAttribute('href','#/stonefirst/ring-02');
  fireEvent.click(screen.getByRole('button',{name:'原款图'}));
  expect(screen.getByRole('img',{name:'围钻戒指原款图'})).toHaveAttribute('src','/media/diy/ring-02.jpg');
});

it('keeps the count hidden until the catalog loads and retries a failed catalog request',async()=>{
  const fetchMock=vi.fn().mockResolvedValueOnce(new Response(null,{status:503}))
    .mockResolvedValueOnce(Response.json([ring]));
  vi.stubGlobal('fetch',fetchMock);
  render(<DiyHome section="collection"/>);
  expect(screen.getByRole('heading',{level:1,name:'全部款式'})).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('正在读取款式');
  expect(screen.queryByText(/0 款戒指/)).toBeNull();
  expect(await screen.findByRole('alert')).toHaveTextContent('款式目录暂时无法读取');
  expect(screen.queryByText(/0 款戒指/)).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'重新读取款式'}));
  expect(await screen.findByText('1 款戒指')).toBeVisible();
  const card=within(screen.getByRole('article'));
  expect(card.getByText('待报价')).toBeVisible();
  expect(card.queryByText('演示参考价')).toBeNull();
  expect(card.queryByRole('button',{name:'加入演示购物车 · 花冠戒指'})).toBeNull();
  expect(card.getByRole('link',{name:'开始定制 · 花冠戒指'})).toHaveAttribute('href',expect.stringContaining(ring.id));
});

it('offers the size guide and story when the public catalog is empty, without listing local demo prices',async()=>{
  vi.stubEnv('VITE_CLOUD_MODE','1');
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json([])));
  render(<DiyHome/>);
  expect(await screen.findByText('暂时没有上架款式。')).toBeVisible();
  expect(screen.getByRole('link',{name:'查看佩戴尺寸指南'})).toHaveAttribute('href','#/diy/fit');
  expect(screen.getByRole('heading',{name:/有些话/})).toBeVisible();
  expect(screen.queryByRole('article')).toBeNull();
});

it('takes visitors to published styles when none are featured and reloads the catalog on navigation',async()=>{
  const fetchMock=vi.fn().mockResolvedValueOnce(Response.json([{...ring,featured:false}]))
    .mockResolvedValueOnce(Response.json([{...ring,name:'新发布款式'}]));
  vi.stubGlobal('fetch',fetchMock);
  const page=render(<DiyHome/>);
  expect(await screen.findByRole('link',{name:'浏览全部 1 款戒指'})).toHaveAttribute('href','#/diy/collection');
  expect(screen.getByRole('link',{name:'开始专属定制'})).toHaveAttribute('href',expect.stringContaining(ring.id));
  page.rerender(<DiyHome section="collection"/>);
  expect(await screen.findByRole('heading',{name:'新发布款式'})).toBeVisible();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('retries the selected ring quote in place and saves only one confirmed cart entry',async()=>{
  const quote={version:ring.revision,amount:1200,currency:'CNY',leadTime:'7 天'};
  const fetchMock=vi.fn().mockResolvedValueOnce(Response.json([{...ring,pricing:{base:1200,head:0,band:0,pave:0}}]))
    .mockResolvedValueOnce(new Response(null,{status:503})).mockResolvedValueOnce(Response.json(quote));
  vi.stubGlobal('fetch',fetchMock);
  render(<DiyHome/>);
  const card=within(await screen.findByRole('article'));
  fireEvent.click(card.getByRole('button',{name:'加入演示购物车 · 花冠戒指'}));
  expect(await card.findByRole('alert')).toBeVisible();
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(demoOrders()).toHaveLength(0);
  const retry=card.getByRole('button',{name:'重试加入 · 花冠戒指'});
  retry.focus();
  await userEvent.keyboard('{Enter}');
  await waitFor(()=>expect(window.location.hash).toBe('#/diy/cart'));
  expect(demoOrders()).toHaveLength(1);
  expect(demoOrders()[0].quote.amount).toBe(1200);
  expect(fetchMock.mock.calls.map(([url])=>String(url).split('/').pop())).toEqual(['index.json','quote','quote']);
});

it('displays a changed published price before the visitor can add the updated style',async()=>{
  const priced=(base:number)=>({...ring,pricing:{base,head:0,band:0,pave:0}});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json([priced(1200)]))
    .mockResolvedValueOnce(Response.json({version:ring.revision,amount:1500,currency:'CNY',leadTime:'7 天'}))
    .mockResolvedValueOnce(Response.json([priced(1500)])));
  render(<DiyHome section="collection"/>);
  fireEvent.click(await screen.findByRole('button',{name:'加入演示购物车 · 花冠戒指'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('商品价格已更新');
  fireEvent.click(screen.getByRole('button',{name:'更新款式和价格'}));
  expect(await screen.findByText(formatYuan(1500))).toBeVisible();
  expect(demoOrders()).toHaveLength(0);
});
