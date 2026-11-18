import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import CommunityStudio from './CommunityStudio';

afterEach(()=>vi.unstubAllGlobals());

it('submits the displayed work and shows the persisted request number', async()=>{
  const work={id:'work-one',title:'花冠侧影',image:'/test.jpg',author:'相言工作室',published:true};
  const calls:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{
    const path=input.split('/community/')[1];
    calls.push((init?.method??'GET')+' '+path);
    if(path==='works')return Response.json([work]);
    if(path==='session')return Response.json({account:{name:'demo_buyer'}});
    if(path==='works/work-one/orders'){
      expect(JSON.parse(String(init?.body))).toEqual({expectedAccount:'demo_buyer'});
      return Response.json({id:'request-one',title:work.title,status:'待人工核价'});
    }
    throw Error(path);
  }));
  render(<CommunityStudio mode="community"/>);
  await userEvent.click(await screen.findByRole('button',{name:'申请同款'}));
  expect(await screen.findByText(/request-one/)).toBeInTheDocument();
  await waitFor(()=>expect(calls).toContain('POST works/work-one/orders'));
});

it('reads the owner’s saved Chinese configuration independently of the current catalog',async()=>{
  HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  HTMLDialogElement.prototype.close=function(){this.open=false;};
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
