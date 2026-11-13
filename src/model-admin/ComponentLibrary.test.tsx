import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import ComponentLibrary from './ComponentLibrary';
import type {LibrarySource} from '../stone-first/reference/managed-types';
vi.mock('./AssetPreview',()=>({default:()=>null}));
afterEach(()=>vi.restoreAllMocks());
const source={id:'upload',name:'戒指6.obj',revision:'version123',stock:false,assets:{head:'/head.glb'}} as LibrarySource;
const prices={revision:'initial',components:{},bases:{}};
it('confirms removal of the whole uploaded version and offers restoring removed versions',async()=>{
 const onArchive=vi.fn(async()=>{});vi.spyOn(window,'confirm').mockReturnValue(true);
 const {rerender}=render(<ComponentLibrary sources={[source]} prices={prices} onSave={vi.fn()} onArchive={onArchive}/>);
 fireEvent.click(screen.getByRole('button',{name:'移出部件库'}));
 await waitFor(()=>expect(onArchive).toHaveBeenCalledWith(source,true));
 expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('整套部件'));
 rerender(<ComponentLibrary sources={[{...source,archived:true}]} prices={prices} onSave={vi.fn()} onArchive={onArchive}/>);
 expect(screen.queryByText('戒指6.obj')).toBeNull();
 fireEvent.change(screen.getByLabelText('部件状态'),{target:{value:'removed'}});
 fireEvent.click(screen.getByRole('button',{name:'恢复版本'}));
 await waitFor(()=>expect(onArchive).toHaveBeenLastCalledWith({...source,archived:true},false));
});

it('names a source without renaming the original file and hands the entire kit to products',async()=>{
 const onRename=vi.fn(async()=>{}),onUse=vi.fn();
 render(<ComponentLibrary sources={[source]} prices={prices} onSave={vi.fn()} onRename={onRename} onUse={onUse}/>);
 fireEvent.click(screen.getByRole('button',{name:'命名'}));
 fireEvent.change(screen.getByLabelText('整套名称'),{target:{value:'花冠'}});
 fireEvent.change(screen.getByLabelText('戒头名称'),{target:{value:'花冠装饰钻戒头'}});
 fireEvent.click(screen.getByRole('button',{name:'保存名称'}));
 await waitFor(()=>expect(onRename).toHaveBeenCalledWith(source,'花冠',{head:'花冠装饰钻戒头'}));
 await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 fireEvent.click(screen.getByRole('button',{name:'用于商品'}));
 expect(onUse).toHaveBeenCalledWith(source.id);
});
