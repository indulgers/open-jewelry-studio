import {fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {useEffect} from 'react';
import {expect,it,vi} from 'vitest';
import TemplateLibrary from './TemplateLibrary';
vi.mock('../stone-first/reference/ManagedTemplateStudio',()=>({ManagedTemplateStudio:({onReady,thumbnailRef}:{
 onReady:(frame:unknown)=>void;thumbnailRef:{current:()=>string};
})=>{
 useEffect(()=>{thumbnailRef.current=()=> 'data:image/jpeg;base64,test';onReady({});},[onReady,thumbnailRef]);
 return <div>已打开草稿预览</div>;
}}));
it('carries a complete kit into an existing product while preserving merchandising and requires publishing separately',async()=>{
 const source={id:'new-kit',revision:'kit-revision',name:'花冠新版',stock:false,assets:{head:'/h',band:'/b',headStones:'/s',pave:'/p'}};
 const draft={id:'product',revision:'old',updatedAt:'2026-11-12T00:00:00Z',name:'花冠戒指',head:'old-kit',headStones:'old-kit',band:'old-kit',pave:'',basePrice:2480,featured:true,order:40,description:'原介绍',cover:'old-cover'};
 const request=vi.fn(async(path:string,init?:RequestInit)=>{
  if(path==='/library')return {sources:[source],drafts:[draft],published:[],cloud:true};
  if(path==='/templates')return {...JSON.parse(init!.body as string),revision:'new'};
  return {id:'product',revision:'new',name:'花冠戒指'};
 });
 render(<TemplateLibrary request={request as any} tab="templates" initialSourceId="new-kit"/>);
 await screen.findByLabelText('商品目标');
 fireEvent.change(screen.getByLabelText('商品目标'),{target:{value:'product'}});
 expect(screen.getByLabelText('款式名称')).toHaveValue('花冠戒指');
 expect(screen.getByLabelText('模板基础价（元）')).toHaveValue(2480);
 expect(screen.getByLabelText('选为首页精选（最多 5 款）')).toBeChecked();
 fireEvent.click(screen.getByRole('button',{name:'保存草稿并预览'}));
 await screen.findByText('已打开草稿预览');
 const saved=JSON.parse(request.mock.calls.find(([path])=>path==='/templates')![1]!.body as string);
 expect(saved).toMatchObject({id:'product',expectedRevision:'old',head:'new-kit',band:'new-kit',headStones:'new-kit',pave:'new-kit',basePrice:2480,featured:true,order:40,cover:'',review:{status:'pending'}});
 expect(request.mock.calls.some(([path])=>path.includes('publish'))).toBe(false);
});

it('retries saving a draft without submitting it again when only the preview failed',async()=>{
 const source={id:'kit',revision:'kit',name:'测试戒指',stock:true,assets:{head:'/h',band:'/b',headStones:'/s'}};
 let saves=0;
 let previews=0;
 const request=vi.fn(async(path:string,init?:RequestInit)=>{
  if(path==='/library')return {sources:[source],drafts:[],published:[],cloud:true};
  if(path==='/templates'){
   if(++saves===1)throw new Error('保存连接中断');
   return {...JSON.parse(init!.body as string),id:'product',revision:'revision',componentMetadata:{head:'kit',band:'kit'},pricing:{base:2280,head:0,band:0,pave:0}};
  }
  if(++previews===1)throw new Error('预览连接中断');
  return {id:'product',revision:'revision',name:'测试戒指'};
 });
 render(<TemplateLibrary request={request as any} tab="templates" initialSourceId="kit"/>);
 await screen.findByLabelText('商品目标');
 fireEvent.change(screen.getByLabelText('模板基础价（元）'),{target:{value:'2280'}});
 fireEvent.click(screen.getByRole('button',{name:'保存草稿并预览'}));
 await screen.findByText('保存连接中断');
 fireEvent.click(screen.getByRole('button',{name:'重试'}));
 await screen.findByText('预览连接中断');
 fireEvent.click(screen.getByRole('button',{name:'重试'}));
 await screen.findByText('已打开草稿预览');
 expect(saves).toBe(2);
 expect(previews).toBe(2);
});

it('keeps publication errors in confirmation and retries a failed library refresh without publishing again',async()=>{
 const source={id:'kit',revision:'kit',name:'测试戒指',stock:true,assets:{head:'/h',band:'/b',headStones:'/s'}};
 const draft={id:'product',revision:'edition2',name:source.name,head:source.id,headStones:source.id,band:source.id,pave:'',updatedAt:'2026-11-15',componentMetadata:{head:'kit',band:'kit'}};
 const release={id:draft.id,revision:'edition1',name:draft.name,image:'/image.jpg'};
 let reads=0;
 let publications=0;
 const request=vi.fn(async(path:string)=>{
  if(path==='/library'){
   if(++reads===2)throw new Error('列表连接中断');
   return {sources:[source],drafts:[draft],published:[reads>2?{...release,revision:draft.revision}:release],cloud:true};
  }
  if(path.endsWith('/publish')){
   if(++publications===1)throw new Error('发布连接中断');
   return {...release,revision:draft.revision};
  }
  return draft;
 });
 render(<TemplateLibrary request={request as any} tab="templates"/>);
 fireEvent.click(await screen.findByRole('button',{name:/测试戒指/}));
 fireEvent.click(screen.getByRole('button',{name:'在编辑器预览'}));
 const publishButton=await screen.findByRole('button',{name:'发布新版本'});
 await waitFor(()=>expect(publishButton).toBeEnabled());
 fireEvent.click(publishButton);
 const confirmation=screen.getByRole('region',{name:'确认发布测试戒指'});
 fireEvent.click(within(confirmation).getByRole('button',{name:'确认发布'}));
 await within(confirmation).findByText('发布连接中断');
 fireEvent.click(within(confirmation).getByRole('button',{name:'重试'}));
 await screen.findByText('列表连接中断');
 fireEvent.click(screen.getByRole('button',{name:'重试'}));
 await screen.findByText('版本已发布');
 expect(publications).toBe(2);
 expect(screen.getByRole('button',{name:'发布新版本'})).toBeDisabled();
});
