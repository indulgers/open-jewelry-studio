import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import Review,{type ReviewModel} from './ModelReview';
vi.mock('./PartPreview',()=>({default:()=> <div>三维预览</div>}));
const model:ReviewModel={id:'test',filename:'新款.obj',seatY:null,min:[-10,-8,-3],max:[10,20,3],triangleCount:100,exports:[],parts:[
 {id:1,triangles:500,min:[-10,-8,-1],max:[10,12,1],role:'band'},
 {id:2,triangles:174,min:[-3,16,-3],max:[3,20,3],role:'center'},
 {id:3,triangles:600,min:[-2,14,-1],max:[2,16,1],role:'unassigned'},
 {id:4,triangles:600,min:[-2,14,-1],max:[2,16,1],role:'unassigned'},
]};
it('supports filtering, selecting a group, applying a role and undoing it',()=>{
 render(<Review model={model} request={vi.fn()} onExport={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('部件用途筛选'),{target:{value:'unassigned'}});
 fireEvent.click(screen.getByRole('button',{name:'全选当前列表'}));
 fireEvent.click(screen.getByRole('button',{name:'应用到所选'}));
 expect(screen.getByText('全部已分配')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'撤销上次'}));
 expect(screen.getByText('待确认 2 个')).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'生成部件版本'})).toBeDisabled();
});
it('can suggest classification and anchor then submits the reviewed values',async()=>{
 const request=vi.fn().mockResolvedValueOnce({id:'new'}).mockResolvedValueOnce(model);
 render(<Review model={model} request={request} onExport={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'补齐建议分区'}));
 fireEvent.click(screen.getByRole('button',{name:'使用建议位置'}));
 expect(screen.getByLabelText('接合高度 Y')).toHaveValue(13);
 fireEvent.click(screen.getByRole('button',{name:'生成部件版本'}));
 await waitFor(()=>expect(request).toHaveBeenCalledTimes(2));
 expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({seatY:13,assignments:{1:'band',2:'center',3:'head',4:'head'}});
});
