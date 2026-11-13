import {expect,it} from 'vitest';
import {suggestAssignments,suggestSeat,similarParts,reviewIssues,type Part} from './review-assist';
const part=(id:number,role:Part['role'],min:number[],max:number[],triangles=500):Part=>({id,role,min,max,triangles});
const band=part(1,'band',[-10,-8,-1],[10,12,1]);
const head=part(2,'head',[-3,14,-3],[3,18,3]);
const unknown=part(3,'unassigned',[-2,14,-1],[2,16,1]);
const bridge=part(4,'unassigned',[-2,11,-1],[2,14,1]);
it('only fills unresolved pieces above the band, preserving manual roles and uncertain junctions',()=>{
 const current={1:'band',2:'head',3:'unassigned',4:'unassigned',5:'exclude'} as const;
 expect(suggestAssignments([band,head,unknown,bridge,{...unknown,id:5}],current)).toEqual({...current,3:'head'});
 expect(suggestAssignments([unknown],{3:'unassigned'})).toEqual({3:'unassigned'});
});
it('suggests an anchor from known geometry and explains overlaps without treating it as certification',()=>{
 expect(suggestSeat([band,head],{1:'band',2:'head'},null)?.value).toBe(13);
 expect(suggestSeat([band,head],{1:'band',2:'head'},14.2)?.value).toBe(14.2);
 expect(suggestSeat([band,{...head,min:[-3,10,-3]}],{1:'band',2:'head'},null)?.reason).toContain('重叠');
 expect(suggestSeat([band],{1:'band'},null)).toBeNull();
});
it('groups similar meshes without swallowing larger stones or different geometry',()=>{
 expect(similarParts([unknown,{...unknown,id:6,triangles:508},{...unknown,id:7,max:[6,16,1]},{...unknown,id:8,triangles:174}],unknown)).toEqual([3,6]);
});
it('blocks empty anchors, unresolved roles and multiple center stones before export',()=>{
 expect(reviewIssues([band,head,unknown],{1:'band',2:'head',3:'center'},'13',-8,18)).toEqual([]);
 expect(reviewIssues([band,head,unknown],{1:'band',2:'center',3:'center'},'',-8,18)).toEqual(['未指定戒头金属','需要恰好一颗主石','请设置有效接合高度']);
 expect(reviewIssues([band,head,unknown],{1:'band',2:'head',3:'unassigned'},'13',-8,18)).toContain('1 个部件待确认');
});
