import {afterEach,expect,it,vi} from 'vitest';
import {purchasePublished} from './purchase';
import {demoOrders} from './ring02/demoOrder';
import type {PublishedTemplate} from './reference/managed-types';
const product={id:'11111111-1111-1111-1111-111111111111',revision:'22222222-2222-2222-2222-222222222222',name:'星环',pricing:{base:2300,head:120,band:80,pave:180}} as PublishedTemplate;
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();});
it('adds the published product with its confirmed price and cover identity',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({amount:2680,currency:'CNY',version:product.revision,leadTime:'待确认'})));
  await purchasePublished(product);
  expect(demoOrders()[0]).toMatchObject({quote:{amount:2680},managed:{id:product.id,revision:product.revision,name:'星环'}});
});
it('does not add a product whose live price has changed',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({amount:2700,version:product.revision})));
  await expect(purchasePublished(product)).rejects.toThrow('价格已更新');
  expect(demoOrders()).toHaveLength(0);
});
