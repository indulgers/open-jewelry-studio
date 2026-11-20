import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeAll, expect, it, vi} from 'vitest';
import CommunityStudio from './CommunityStudio';

beforeAll(()=>{
  HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  HTMLDialogElement.prototype.close=function(){this.open=false;};
});
afterEach(()=>{vi.unstubAllGlobals();history.replaceState(null,'','/');});

const work={id:'work-one',title:'花冠侧影',image:'/test.jpg',author:'相言工作室',published:true};
const buyer={name:'demo_buyer'};
const request={id:'request-one',workId:work.id,title:work.title,status:'待人工核价',createdAt:'2026-11-19T12:00:00Z'};

function mockCommunity(guest:boolean,responses:(()=>Response)[]=[]){
  let active=guest?null:buyer;
  const calls:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{
    const path=input.split('/community/')[1];
    calls.push((init?.method??'GET')+' '+path);
    if(path==='works')return Response.json([work]);
    if(path==='session')return Response.json({account:active});
    if(path==='login'){active=buyer;return Response.json({account:buyer});}
    if(path==='works/'+work.id+'/orders'){
      expect(JSON.parse(String(init?.body))).toEqual({expectedAccount:buyer.name});
      return responses.shift()?.()??Response.json(request);
    }
    if(path==='orders')return Response.json([request]);
    if(path==='mine')return Response.json([]);
    throw Error(path);
  }));
  return ()=>calls.filter(call=>call==='POST works/work-one/orders').length;
}

it('retains the work selected in preview through guest login and waits for explicit confirmation',async()=>{
  const submits=mockCommunity(true);
  render(<CommunityStudio mode="community"/>);
  await userEvent.click(await screen.findByRole('button',{name:'预览花冠侧影'}));
  await userEvent.click(within(screen.getByRole('dialog',{name:work.title})).getByRole('button',{name:'申请同款'}));
  const login=within(screen.getByRole('dialog',{name:'登录后申请同款'}));
  await userEvent.type(login.getByLabelText('账号名'),buyer.name);
  await userEvent.type(login.getByLabelText('密码'),'example-password');
  await userEvent.click(login.getByRole('button',{name:'登录'}));
  const confirm=within(await screen.findByRole('dialog',{name:'确认同款申请'}));
  expect(confirm.getByText(work.title)).toBeVisible();
  expect(confirm.getByText(buyer.name)).toBeVisible();
  expect(confirm.getByText(/无需付款/)).toBeVisible();
  expect(submits()).toBe(0);
  await userEvent.click(confirm.getByRole('button',{name:'确认提交申请'}));
  const receipt=within(await screen.findByRole('dialog',{name:'同款申请回执'}));
  expect(receipt.getByText(request.id)).toBeVisible();
  expect(receipt.getByText(request.status)).toBeVisible();
  expect(receipt.getByRole('link',{name:'查看这笔申请'})).toHaveAttribute('href','#/my-designs?order=request-one');
  expect(submits()).toBe(1);
});

it.each(['已关闭','已下单'])('reopens the existing receipt with its current %s status',async(status)=>{
  mockCommunity(false,[()=>Response.json({...request,status})]);
  render(<CommunityStudio mode="community"/>);
  await userEvent.click(await screen.findByRole('button',{name:'申请同款'}));
  await userEvent.click(screen.getByRole('button',{name:'确认提交申请'}));
  const receipt=within(await screen.findByRole('dialog',{name:'同款申请回执'}));
  expect(receipt.getByText(status)).toBeVisible();
  expect(receipt.getByRole('link',{name:'查看这笔申请'})).toHaveAttribute('href','#/my-designs?order='+request.id);
});

it('allows cancellation and lets the same account retry a failed request in place',async()=>{
  const submits=mockCommunity(false,[()=>Response.json({error:'工作室暂时无法处理，请重试。'},{status:503})]);
  render(<CommunityStudio mode="community"/>);
  await userEvent.click(await screen.findByRole('button',{name:'申请同款'}));
  await userEvent.click(screen.getByRole('button',{name:'取消'}));
  expect(submits()).toBe(0);
  await userEvent.click(screen.getByRole('button',{name:'申请同款'}));
  await userEvent.click(screen.getByRole('button',{name:'确认提交申请'}));
  const confirm=within(screen.getByRole('dialog',{name:'确认同款申请'}));
  expect(await confirm.findByRole('alert')).toHaveTextContent('工作室暂时无法处理');
  expect(confirm.getByText(work.title)).toBeVisible();
  await userEvent.click(confirm.getByRole('button',{name:'重试提交'}));
  expect(await screen.findByRole('dialog',{name:'同款申请回执'})).toBeVisible();
  expect(submits()).toBe(2);
});

it.each([
  [404,{},'这件作品已撤回，可选择其他公开作品。'],
  [409,{code:'ACCOUNT_CHANGED'},'账号已变更，请核对当前账号后重新操作。'],
])('releases an obsolete confirmation after HTTP %s',async(status,body,notice)=>{
  const submits=mockCommunity(false,[()=>Response.json(body,{status})]);
  render(<CommunityStudio mode="community"/>);
  await userEvent.click(await screen.findByRole('button',{name:'申请同款'}));
  await userEvent.click(screen.getByRole('button',{name:'确认提交申请'}));
  expect(await screen.findByText(notice)).toBeVisible();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(submits()).toBe(1);
});

it('takes the account holder to the specific receipt from a tracking link',async()=>{
  mockCommunity(false);
  history.replaceState(null,'','#/my-designs?order=request-one');
  render(<CommunityStudio mode="mine"/>);
  await screen.findByText(request.status);
  await waitFor(()=>expect(document.activeElement?.id).toBe('community-order-'+request.id));
});

it('reads the owner’s saved Chinese configuration independently of the current catalog',async()=>{
  const work={id:'past',title:'试制戒指',image:'/past.jpg',author:'消费者',published:false,design:{kind:'reference'},
    details:[{label:'戒头',value:'原始花瓣镶座'}]};
  vi.stubGlobal('fetch',vi.fn(async(path:string)=>{
    if(path.endsWith('/session'))return Response.json({account:{name:'designer'}});
    if(path.endsWith('/mine'))return Response.json([work]);
    return Response.json([]);
  }));
  render(<CommunityStudio mode="mine"/>);
  await userEvent.click(await screen.findByRole('button',{name:'预览试制戒指'}));
  await userEvent.click(await screen.findByText('查看保存的配置'));
  expect(screen.getByText('原始花瓣镶座')).toBeVisible();
  expect(screen.getByText('历史版本未记录。')).toBeVisible();
  expect(screen.queryByText(/"kind"/)).toBeNull();
});

it('mounts account inputs only after the initial session check finishes',async()=>{
  history.replaceState(null,'','/#/my-designs?auth=register');
  let finish!:(response:Response)=>void;
  vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;})));
  const {container}=render(<CommunityStudio mode="mine"/>);
  expect(screen.getByRole('status')).toHaveTextContent('正在打开账号页面');
  expect(container.querySelector('input')).toBeNull();
  finish(Response.json({account:null}));
  expect(await screen.findByRole('button',{name:'注册账号'})).toBeVisible();
  expect(screen.getByLabelText('账号名')).toBeEnabled();
});
