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
