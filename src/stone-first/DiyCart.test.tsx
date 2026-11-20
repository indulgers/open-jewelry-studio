import {act,render,screen,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {DiyCart} from './DiyCart';
import {addDemoOrder,formatYuan,type DemoOrder} from './ring02/demoOrder';
import {BASE_DESIGN,TEMPLATE_REVISION} from './ring02/model';

afterEach(()=>{localStorage.clear();vi.unstubAllEnvs();});
it('excludes pending legacy designs and totals only the confirmed CNY snapshots',async()=>{
  vi.stubEnv('PROD',false);
  vi.stubEnv('VITE_CLOUD_MODE','');
  const order:DemoOrder={
    revision:'confirmed',templateRevision:TEMPLATE_REVISION,confirmedAt:'2026-11-13T12:00:00Z',
    design:BASE_DESIGN,details:[],stones:[],quote:{amount:1789.33,version:'published-1',currency:'CNY',leadTime:'7 天'},
  };
  addDemoOrder({...order,revision:'legacy',name:'待确认款',design:{...BASE_DESIGN,center:{...BASE_DESIGN.center,appearance:'ruby'}}});
  render(<DiyCart/>);
  const summary=await screen.findByRole('complementary',{name:'方案小计'});
  expect(summary).toHaveTextContent('待重新确认1 件');
  expect(summary).toHaveTextContent('参考合计待确认');
  expect(within(screen.getByRole('article')).getByText('1 件')).toBeVisible();
  expect(screen.queryByText(formatYuan(order.quote.amount))).toBeNull();
  expect(screen.queryByText(/示例交期/)).toBeNull();
  act(()=>{addDemoOrder({...order,details:[{label:'金属外观',value:'玫瑰金色 · 哑面'}],managed:{id:'11111111-1111-1111-1111-111111111111',revision:'22222222-2222-2222-2222-222222222222',name:'已发布款'}});});
  expect(summary).toHaveTextContent('已计价方案1 件');
  expect(screen.getByText('玫瑰金色 · 哑面 · 1 件')).toBeVisible();
  expect(within(summary).getByText(formatYuan(order.quote.amount))).toBeVisible();
  expect(screen.getByRole('img',{name:'已发布款原款参考图'})).toHaveAttribute('src','/models/managed/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/cover.jpg');
});
