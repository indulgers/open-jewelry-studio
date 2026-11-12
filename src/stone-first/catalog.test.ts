import {beforeEach,expect,it} from 'vitest';
import {RING_CATALOG} from './catalog';
import {purchaseOriginal} from './purchase';
import {CART_CHANGED,demoOrders,removeDemoOrder} from './ring02/demoOrder';

beforeEach(()=>localStorage.clear());

it('adds an original product without replacing the saved design or an earlier cart item',()=>{
  const draftKey='open-jewelry-studio:'+RING_CATALOG[0].revision;
  localStorage.setItem(draftKey,'saved custom draft');
  let changes=0;
  const changed=()=>{changes++;};
  window.addEventListener(CART_CHANGED,changed);
  try{
    purchaseOriginal(RING_CATALOG[0]);
    purchaseOriginal(RING_CATALOG[0]);
    const orders=demoOrders();
    expect(orders).toHaveLength(2);
    expect(orders[0]).toMatchObject({templateRevision:RING_CATALOG[0].revision,quote:{amount:2280,currency:'CNY'}});
    expect(orders[0].revision).not.toBe(orders[1].revision);
    expect(localStorage.getItem(draftKey)).toBe('saved custom draft');
    removeDemoOrder(orders[0].revision);
    expect(demoOrders().map(order=>order.revision)).toEqual([orders[1].revision]);
    expect(changes).toBe(3);
    expect(localStorage.getItem(draftKey)).toBe('saved custom draft');
  }finally{window.removeEventListener(CART_CHANGED,changed);}
});

it('keeps each catalog product and its original quote distinct in the cart',()=>{
  for(const template of RING_CATALOG)purchaseOriginal(template);
  const orders=demoOrders();
  expect(orders).toHaveLength(RING_CATALOG.length);
  expect(new Set(orders.map(order=>order.templateRevision)).size).toBe(RING_CATALOG.length);
  for(const template of RING_CATALOG){
    expect(orders.find(order=>order.templateRevision===template.revision)?.quote.amount).toBe(template.price.base);
  }
});
