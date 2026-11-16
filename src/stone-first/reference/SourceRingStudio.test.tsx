import {beforeEach,expect,it,vi} from 'vitest';
import {fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {SourceRingStudio} from './SourceRingStudio';
import {ORIGINAL_REFERENCE} from './design';
import {draftKey} from './editor-history';
import {BEFORE_ROUTE_CHANGE} from '../../navigation';

vi.mock('../../viewer/JewelryLighting',()=>({preloadJewelryLighting:()=>{}}));
vi.mock('./part-library',()=>({createReferenceLibrary:()=>({load:()=>new Promise(()=>{}),dispose:()=>{}})}));
vi.mock('../ring02/Ring02Stage',()=>({VIEWS:[['overall','整体'],['side','侧面']]}));
vi.mock('./SourceRingStage',()=>({SourceRingStage:()=>null,SourceLoading:()=> <p>正在加载预览</p>}));
beforeEach(()=>{
  localStorage.clear();
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  Element.prototype.scrollIntoView=vi.fn();
});
const read=()=>JSON.parse(localStorage.getItem(draftKey('ring-starlight'))!);
const open=()=>render(<SourceRingStudio templateId="ring-starlight"/>);
it('revises prices with undo/redo and confirms reset without erasing the cart',()=>{
  localStorage.setItem('open-jewelry-studio:diy-demo-order:keep','sentinel');
  open();
  fireEvent.click(screen.getByRole('button',{name:'红宝石 +¥100'}));
  const edited=read();
  expect(edited.design.center).toBe('ruby');
  fireEvent.click(screen.getByRole('button',{name:'撤销'}));
  expect(read().design.center).toBe('diamond');
  fireEvent.click(screen.getByRole('button',{name:'重做'}));
  expect(read().design.center).toBe('ruby');
  expect(read().revision).not.toBe(edited.revision);
  fireEvent.click(screen.getByRole('button',{name:'恢复原款'}));
  fireEvent.click(screen.getByRole('button',{name:'保留原方案'}));
  expect(read().design.center).toBe('ruby');
  fireEvent.click(screen.getByRole('button',{name:'恢复原款'}));
  fireEvent.click(screen.getByRole('button',{name:'确认调整'}));
  expect(read().design).toEqual(ORIGINAL_REFERENCE);
  fireEvent.click(screen.getByRole('button',{name:'撤销'}));
  expect(read().design.center).toBe('ruby');
  expect(localStorage.getItem('open-jewelry-studio:diy-demo-order:keep')).toBe('sentinel');
});
it('keeps input and the template when a template change is cancelled',()=>{
  open();
  fireEvent.click(screen.getByRole('button',{name:'戒圈与铺钻'}));
  fireEvent.change(screen.getByLabelText('刻字文字'),{target:{value:'A & B'}});
  fireEvent.change(screen.getByLabelText('戒指款式'),{target:{value:'ring-floral'}});
  expect(screen.getByRole('dialog')).toHaveTextContent('含未确认的输入');
  fireEvent.click(screen.getByRole('button',{name:'保留当前方案'}));
  expect(screen.getByLabelText('刻字文字')).toHaveValue('A & B');
  expect(screen.getByLabelText('戒指款式')).toHaveValue('ring-starlight');
});
it('jumps from the summary to engraving and confirms normalization explicitly',()=>{
  open();
  fireEvent.click(screen.getByText('配置摘要'));
  fireEvent.click(screen.getByRole('button',{name:'内圈刻字'}));
  const input=screen.getByLabelText('刻字文字');
  expect(input).toHaveFocus();
  fireEvent.compositionStart(input);
  fireEvent.change(input,{target:{value:' A & B '}});
  expect(screen.getByRole('button',{name:'确认刻字'})).toBeDisabled();
  fireEvent.compositionEnd(input);
  expect(screen.getByText(/首尾空格将去除/)).toHaveTextContent('「A & B」');
  fireEvent.click(screen.getByRole('button',{name:'确认刻字'}));
  expect(read().design.engraving).toBe('A & B');
});
it('does not overwrite an invalid old draft on opening',()=>{
  const raw=JSON.stringify({design:{...ORIGINAL_REFERENCE,headId:'removed'},revision:'old'});
  localStorage.setItem(draftKey('ring-starlight'),raw);
  open();
  expect(screen.getByText(/草稿中的戒头已不在/)).toBeVisible();
  expect(localStorage.getItem(draftKey('ring-starlight'))).toBe(raw);
  expect(screen.getByRole('button',{name:'恢复原款'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'保留旧记录并新建'}));
  expect(localStorage.getItem(draftKey('ring-starlight')+':previous')).toBe(raw);
  expect(read().design).toEqual(ORIGINAL_REFERENCE);
});
it('protects unsaved text from in-app links and browser navigation',async()=>{
  open();
  fireEvent.click(screen.getByRole('button',{name:'戒圈与铺钻'}));
  fireEvent.change(screen.getByLabelText('刻字文字'),{target:{value:'unconfirmed'}});
  fireEvent.click(screen.getByRole('link',{name:'全部款式'}));
  expect(screen.getByRole('dialog')).toHaveTextContent('刻字输入尚未确认');
  fireEvent.click(screen.getByRole('button',{name:'继续编辑'}));
  const navigation=new CustomEvent(BEFORE_ROUTE_CHANGE,{cancelable:true,detail:{oldURL:location.href,newURL:location.origin+'/#/diy/cart'}});
  fireEvent(window,navigation);
  expect(navigation.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'继续编辑'}));
  expect(screen.getByLabelText('刻字文字')).toHaveValue('unconfirmed');
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
it('shows failed storage, can retry, and only reports a local save',()=>{
  const original=Storage.prototype.setItem;
  const write=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('full');});
  open();
  expect(screen.getByText('本机草稿保存失败')).toBeVisible();
  write.mockImplementation(original);
  fireEvent.click(screen.getByRole('button',{name:'重试保存'}));
  expect(screen.getByText(/本机已暂存/)).toBeVisible();
  expect(read().savedAt).toBeTruthy();
});
it('warns before removing incompatible halo settings and cancels atomically',()=>{
  localStorage.setItem(draftKey('ring-starlight'),JSON.stringify({design:{...ORIGINAL_REFERENCE,halo:'ruby'},revision:'old'}));
  open();
  fireEvent.click(screen.getByRole('button',{name:'查看全部戒头'}));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:/凝光/}));
  expect(screen.getByRole('dialog')).toHaveTextContent('新戒头没有外围配钻');
  fireEvent.click(screen.getByRole('button',{name:'保留原方案'}));
  expect(read().design.halo).toBe('ruby');
  expect(read().design.headId).toBeUndefined();
  fireEvent.click(screen.getByRole('button',{name:'查看全部戒头'}));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:/凝光/}));
  fireEvent.click(screen.getByRole('button',{name:'确认调整'}));
  expect(read().design.headId).toBe('ring-solstice');
  expect(read().design.halo).toBe('diamond');
  fireEvent.click(screen.getByRole('button',{name:'撤销'}));
  expect(read().design.halo).toBe('ruby');
  expect(read().design.headId).toBeUndefined();
});

it('keeps unconfirmed text if the target draft cannot be backed up',()=>{
  open();
  fireEvent.click(screen.getByRole('button',{name:'戒圈与铺钻'}));
  fireEvent.change(screen.getByLabelText('刻字文字'),{target:{value:'Keep me'}});
  fireEvent.change(screen.getByLabelText('戒指款式'),{target:{value:'ring-floral'}});
  const original=Storage.prototype.setItem;
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,key:string,value:string){
    if(key.includes('ring-floral'))throw new Error('无法备份目标草稿');
    return original.call(this,key,value);
  });
  fireEvent.click(screen.getByRole('button',{name:'确认新建草稿'}));
  expect(screen.getByLabelText('刻字文字')).toHaveValue('Keep me');
  expect(screen.getByLabelText('戒指款式')).toHaveValue('ring-starlight');
  expect(screen.getByText('无法备份目标草稿')).toBeVisible();
});
it('keeps unconfirmed engraving when applying a linked head change',()=>{
  localStorage.setItem(draftKey('ring-starlight'),JSON.stringify({design:{...ORIGINAL_REFERENCE,halo:'ruby'},revision:'old'}));
  open();
  fireEvent.click(screen.getByRole('button',{name:'戒圈与铺钻'}));
  fireEvent.change(screen.getByLabelText('刻字文字'),{target:{value:'Keep me'}});
  fireEvent.click(screen.getByRole('button',{name:'戒头'}));
  fireEvent.click(screen.getByRole('button',{name:'查看全部戒头'}));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:/凝光/}));
  fireEvent.click(screen.getByRole('button',{name:'确认调整'}));
  fireEvent.click(screen.getByRole('button',{name:'戒圈与铺钻'}));
  expect(screen.getByLabelText('刻字文字')).toHaveValue('Keep me');
});

it('follows the published workflow without changing the selected design',async()=>{
 const {RING_CATALOG}=await import('../catalog');const template=RING_CATALOG.find(item=>item.id==='ring-starlight')!;
 const previous=template.workflow;template.workflow={firstStep:'shank',requireSizeNote:false};
 try{
   open();
   expect(screen.getByRole('button',{name:'戒圈与铺钻'})).toHaveAttribute('aria-pressed','true');
   expect(screen.getByLabelText('你的尺寸与制作要求')).toBeInTheDocument();
   fireEvent.click(screen.getByRole('button',{name:'下一步 · 配置戒头'}));
   expect(screen.getByRole('button',{name:'戒头'})).toHaveAttribute('aria-pressed','true');
   expect(read().design).toEqual(ORIGINAL_REFERENCE);
 }finally{template.workflow=previous;}
});
