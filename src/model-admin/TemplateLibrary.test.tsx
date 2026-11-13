import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import TemplateLibrary from './TemplateLibrary';
vi.mock('../stone-first/reference/ManagedTemplateStudio',()=>({ManagedTemplateStudio:()=> <div>已打开草稿预览</div>}));
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
