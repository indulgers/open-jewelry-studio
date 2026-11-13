import {beforeEach,describe,expect,it,vi} from 'vitest';
import {BASE_DESIGN,TEMPLATE_REVISION} from './model';
import {addDemoOrder,demoOrders,estimateRing02,type DemoOrder} from './demoOrder';

const publication=vi.hoisted(()=>({listed:true}));
vi.mock('./assets',async importOriginal=>{
  const actual=await importOriginal<typeof import('./assets')>();
  return {...actual,RING02_TEMPLATE:{...actual.RING02_TEMPLATE,get listed(){return publication.listed;}}};
});
beforeEach(()=>{
  localStorage.clear();
  publication.listed=true;
});

describe('Ring 02 demo order',()=>{
  it('prices the current selected options and drops hidden halo charges',()=>{
    const changed={...BASE_DESIGN,center:{...BASE_DESIGN.center,size:1.06 as const},halo:{...BASE_DESIGN.halo,appearance:'ruby' as const}};
    expect(estimateRing02(changed).amount).toBe(2580);
    expect(estimateRing02({...changed,head:'four-prong'}).amount).toBe(2280);
  });
  it('keeps the first confirmation for a revision and allows another revision',()=>{
    const design={...BASE_DESIGN,center:{...BASE_DESIGN.center}};
    const first:DemoOrder={
      templateRevision:TEMPLATE_REVISION,revision:'61398483-7ab5-47b9-9bdf-392e17b85b70',confirmedAt:'2026-11-10T12:00:00.000Z',
      design,quote:estimateRing02(design),details:[{label:'主石',value:'圆形白钻'}],
      stones:[{id:'center-1',zone:'center',appearance:'diamond',placement:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}],
    };
    expect(addDemoOrder(first)).toBe(true);
    design.center.appearance='ruby';
    expect(addDemoOrder({...first,quote:estimateRing02(design)})).toBe(false);
    expect(addDemoOrder({...first,revision:'a4e7fa93-650c-460f-a9d2-2a90d8519684',quote:estimateRing02(design)})).toBe(true);
    publication.listed=false;
    expect(()=>addDemoOrder({...first,revision:'unlisted'})).toThrow('当前款式已停售');
    const orders=demoOrders();
    expect(orders).toHaveLength(2);
    expect(orders.find(order=>order.revision===first.revision)).toMatchObject({quote:{amount:2280},design:{center:{appearance:'diamond'}},stones:first.stones});
  });
  it('preserves a snapshot, ignores invalid stored image URLs and saves the order if only the snapshot exceeds the quota',()=>{
    const thumbnail='data:image/jpeg;base64,/9j/2Q==';
    const order:DemoOrder={
      templateRevision:TEMPLATE_REVISION,revision:'snapshot',confirmedAt:'2026-11-10T12:00:00.000Z',
      design:BASE_DESIGN,quote:estimateRing02(BASE_DESIGN),details:[],stones:[],thumbnail,
    };
    expect(addDemoOrder(order)).toBe(true);
    expect(demoOrders()[0].thumbnail).toBe(thumbnail);
    const key='open-jewelry-studio:diy-demo-order:snapshot';
    localStorage.setItem(key,JSON.stringify({...order,thumbnail:'https://example.com/remote.jpg'}));
    expect(demoOrders()[0].thumbnail).toBeUndefined();

    const storage=vi.spyOn(Storage.prototype,'setItem').mockImplementationOnce(()=>{
      throw new DOMException('Cart quota exceeded','QuotaExceededError');
    });
    try{
      expect(addDemoOrder({...order,revision:'quota'})).toBe(true);
      expect(demoOrders().find(item=>item.revision==='quota')).toMatchObject({thumbnail:undefined,quote:order.quote});
    }finally{storage.mockRestore();}
  });
  it('preserves a managed product price snapshot with cents and identity',()=>{
    const id='61398483-7ab5-47b9-9bdf-392e17b85b70';
    const order:DemoOrder={templateRevision:id,revision:'managed-price-test',confirmedAt:'2026-11-12T12:00:00.000Z',
      managed:{id,revision:id,name:'星环商品'},design:BASE_DESIGN,quote:{amount:2030.3,currency:'CNY',version:id,leadTime:'7–10 个工作日'},details:[],stones:[]};
    addDemoOrder(order);
    expect(demoOrders()[0]).toMatchObject({managed:order.managed,quote:order.quote});
    expect(()=>addDemoOrder({...order,revision:'invalid',managed:{id:'invalid',revision:id,name:'无效'}})).toThrow('当前款式已停售');
  });

});
