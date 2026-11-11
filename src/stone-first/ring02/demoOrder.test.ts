import {beforeEach,describe,expect,it} from 'vitest';
import {BASE_DESIGN,TEMPLATE_REVISION} from './model';
import {addDemoOrder,demoOrders,estimateRing02,type DemoOrder} from './demoOrder';

beforeEach(()=>localStorage.clear());

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
    const orders=demoOrders();
    expect(orders).toHaveLength(2);
    expect(orders.find(order=>order.revision===first.revision)).toMatchObject({quote:{amount:2280},design:{center:{appearance:'diamond'}},stones:first.stones});
  });
});
