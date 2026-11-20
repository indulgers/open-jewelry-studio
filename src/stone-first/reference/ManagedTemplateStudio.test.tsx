import {act,fireEvent,render,screen} from '@testing-library/react';
import {createRef} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {ManagedTemplateStudio} from './ManagedTemplateStudio';
import type {ManagedTemplate} from './managed-types';
import type {SourceFrame} from './SourceRingStage';

const renderState=vi.hoisted(()=>({report:undefined as (()=>void)|undefined}));
vi.mock('./part-library',()=>({createReferenceLibrary:()=>({load:async()=>({stock:{},band:{stones:[]}}),dispose(){}})}));
vi.mock('./pave',()=>({applyReferencePave:(stock:object)=>stock}));
vi.mock('./SourceRingStage',()=>({
  SourceLoading:()=>null,
  SourceRingStage:({ring,design,captureRef,onCaptureReady}:SourceFrame&{
    captureRef:{current:((mode?:string)=>string)|null};onCaptureReady:(frame:SourceFrame)=>void;
  })=>{
    renderState.report=()=>{captureRef.current=mode=>'data:image/jpeg;base64,'+mode+design.ringSizeUS;onCaptureReady({ring,design});};
    return <div>三维画布</div>;
  },
}));
const template:ManagedTemplate={
  id:'released-ring',catalogId:'catalog-ring',revision:'version-2',name:'高托试制款',headName:'拱形镶座',bandName:'光面戒圈',
  headId:'ring-floral',bandId:'ring-solstice',library:{},publishedAt:'2026-11-18',
};
afterEach(()=>vi.unstubAllGlobals());

it('saves the exact rendered release and sizes and waits for a new frame after a size change',async()=>{
  const bodies:object[]=[];
  vi.stubGlobal('fetch',vi.fn(async(path:string,init?:RequestInit)=>{
    if(path.endsWith('/session'))return Response.json({account:{name:'viewer'}});
    bodies.push(JSON.parse(String(init?.body)));return Response.json({});
  }));
  const dialogMethods=HTMLDialogElement.prototype;
  if(!dialogMethods.showModal)dialogMethods.showModal=function(){this.open=true};
  if(!dialogMethods.close)dialogMethods.close=function(){this.open=false};
  render(<ManagedTemplateStudio template={template}/>);
  await screen.findByText('三维画布');
  const button=screen.getByRole('button',{name:'保存设计'});
  expect(button).toBeDisabled();
  act(()=>renderState.report?.());
  expect(button).toBeEnabled();
  fireEvent.change(screen.getByRole('combobox',{name:'本款圈号（美码）'}),{target:{value:'7'}});
  expect(button).toBeDisabled();
  act(()=>renderState.report?.());
  fireEvent.click(button);
  fireEvent.click(await screen.findByRole('button',{name:'保存到我的设计'}));
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({templateId:'catalog-ring',basis:{template:{id:'released-ring',revision:'version-2'}},image:'data:image/jpeg;base64,inspection7',
    design:{headId:'ring-floral',bandId:'ring-solstice',ringSizeUS:7},details:expect.arrayContaining([{label:'戒头',value:'拱形镶座'}])});
});

it('keeps account save outside the admin preview even for an already published template',async()=>{
  render(<ManagedTemplateStudio template={template} thumbnailRef={createRef()}/>);
  await screen.findByText('三维画布');
  expect(screen.queryByRole('button',{name:'保存设计'})).toBeNull();
});

it.each([404,409,200])('offers the current catalog instead of retrying a superseded price (%i)',async status=>{
  const priced={...template,pricing:{base:100,head:0,band:0,pave:0}};
  vi.stubGlobal('fetch',vi.fn(async(path:string)=>path.endsWith('/quote')
    ?Response.json({amount:120,version:priced.revision,currency:'CNY',leadTime:'待确认'},{status})
    :Response.json({account:null})));
  render(<ManagedTemplateStudio template={priced}/>);
  await screen.findByText('三维画布');
  act(()=>renderState.report?.());
  fireEvent.click(screen.getByRole('button',{name:'加入购物车'}));
  expect(await screen.findByRole('link',{name:'查看当前在售款式'})).toHaveAttribute('href','#/diy/collection');
  expect(screen.queryByRole('button',{name:'重试'})).toBeNull();
  expect(screen.queryByRole('button',{name:'加入购物车'})).toBeNull();
  expect(Object.keys(localStorage).some(key=>key.includes('diy-demo-order'))).toBe(false);
});

it('allows a transient quote error to retry from the same editor',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(path:string)=>path.endsWith('/quote')?new Response(null,{status:503}):Response.json({account:null})));
  render(<ManagedTemplateStudio template={{...template,pricing:{base:100,head:0,band:0,pave:0}}}/>);
  await screen.findByText('三维画布');
  act(()=>renderState.report?.());
  fireEvent.click(screen.getByRole('button',{name:'加入购物车'}));
  expect(await screen.findByRole('button',{name:'重试'})).toBeEnabled();
  expect(screen.queryByRole('link',{name:'查看当前在售款式'})).toBeNull();
});
