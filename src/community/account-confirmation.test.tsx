import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeAll,expect,it,vi} from 'vitest';
import {SaveCommunityDesign} from './SaveCommunityDesign';
import CommunityStudio from './CommunityStudio';

beforeAll(()=>{
  HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  HTMLDialogElement.prototype.close=function(){this.open=false;};
});
afterEach(()=>vi.unstubAllGlobals());

const snapshot={title:'围钻戒指',templateId:'ring-02',revision:'r1',design:{kind:'reference'},capture:()=>'/snapshot.jpg'};
it('reuses the same private-save request after a lost response, but gives an edited title a new request',async()=>{
  const saves:Record<string,unknown>[]=[];
  vi.stubGlobal('fetch',vi.fn(async(path:string,init?:RequestInit)=>{
    if(path.endsWith('/session'))return Response.json({account:{name:'alice'}});
    saves.push(JSON.parse(String(init?.body)));
    throw Error('响应丢失');
  }));
  render(<SaveCommunityDesign {...snapshot}/>);
  fireEvent.click(screen.getByRole('button',{name:'保存设计'}));
  const save=await screen.findByRole('button',{name:'保存到我的设计'});
  fireEvent.click(save);await screen.findByRole('alert');
  fireEvent.click(save);await waitFor(()=>expect(saves).toHaveLength(2));
  expect(saves[0].expectedAccount).toBe('alice');
  expect(saves[0].requestId).toMatch(/^[a-f0-9-]{36}$/);
  expect(saves[1].requestId).toBe(saves[0].requestId);
  fireEvent.change(screen.getByLabelText('作品名称'),{target:{value:'新名称'}});
  fireEvent.click(save);await waitFor(()=>expect(saves).toHaveLength(3));
  expect(saves[2].requestId).not.toBe(saves[0].requestId);
});

it('drops the old private preview and refreshes account-owned works after a publishing identity conflict',async()=>{
  let user='alice';
  let submitted:Record<string,unknown>|undefined;
  vi.stubGlobal('fetch',vi.fn(async(path:string,init?:RequestInit)=>{
    if(path.endsWith('/session'))return Response.json({account:{name:user}});
    if(path.endsWith('/mine'))return Response.json([{id:user,title:user+'的作品',author:'消费者',image:'/work.jpg',published:false}]);
    if(path.endsWith('/orders'))return Response.json([]);
    if(path.endsWith('/publish')){
      submitted=JSON.parse(String(init?.body));user='bob';
      return Response.json({code:'ACCOUNT_CHANGED',error:'账号已变更，请重新确认。'},{status:409});
    }
    throw Error(path);
  }));
  render(<CommunityStudio mode="mine"/>);
  fireEvent.click(await screen.findByRole('button',{name:'发布作品'}));
  fireEvent.click(screen.getByRole('button',{name:'确认发布'}));
  await screen.findByRole('heading',{name:'bob的作品'});
  expect(submitted?.expectedAccount).toBe('alice');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByText('alice的作品')).not.toBeInTheDocument();
});

it('discards the captured design after a cross-tab switch and requires a new save to the displayed account',async()=>{
  let user='alice',saves=0;
  const send=vi.fn(async(path:string,init?:RequestInit)=>{
    if(path.endsWith('/session'))return Response.json({account:{name:user}});
    saves++;
    if(saves===1){
      expect(JSON.parse(String(init?.body)).expectedAccount).toBe('alice');
      user='bob';
      return Response.json({code:'ACCOUNT_CHANGED',error:'账号已变更'},{status:409});
    }
    expect(JSON.parse(String(init?.body)).expectedAccount).toBe('bob');
    return Response.json({});
  });
  vi.stubGlobal('fetch',send);
  render(<SaveCommunityDesign {...snapshot}/>);
  fireEvent.click(screen.getByRole('button',{name:'保存设计'}));
  fireEvent.click(await screen.findByRole('button',{name:'保存到我的设计'}));
  await screen.findByText(/当前账号为 bob/);
  expect(saves).toBe(1);
  expect(screen.queryByAltText('本次保存的设计预览')).toBeNull();
  expect(screen.queryByRole('button',{name:'保存到我的设计'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'返回编辑器'}));
  fireEvent.click(screen.getByRole('button',{name:'保存设计'}));
  fireEvent.click(await screen.findByRole('button',{name:'保存到我的设计'}));
  await screen.findByText('已私密保存。');
  expect(saves).toBe(2);
});
