import {beforeEach,describe,expect,it,vi} from 'vitest';
import {RING_CATALOG} from '../catalog';
import {ORIGINAL_REFERENCE} from './design';
import {draftKey,editorHistory,initialHistory,readEditorDraft,startNewDraft} from './editor-history';
const template=RING_CATALOG[1];
beforeEach(()=>localStorage.clear());
describe('reference editor history and draft preservation',()=>{
  it('undoes and redoes a linked update atomically with distinct revisions',()=>{
    const original=initialHistory();
    const changed=editorHistory(original,{type:'change',design:{...ORIGINAL_REFERENCE,headId:'ring-solstice',halo:'diamond',engraving:'A & B'}});
    const undone=editorHistory(changed,{type:'undo'});
    expect(undone.design).toEqual(ORIGINAL_REFERENCE);
    const redone=editorHistory(undone,{type:'redo'});
    expect(redone.design).toEqual(changed.design);
    expect(new Set([original.revision,changed.revision,undone.revision,redone.revision]).size).toBe(4);
    expect(editorHistory(undone,{type:'change',design:{...ORIGINAL_REFERENCE,center:'ruby'}}).future).toEqual([]);
  });
  it('retains ten steps and does not create revisions for no-ops',()=>{
    let state=initialHistory();
    expect(editorHistory(state,{type:'undo'})).toBe(state);
    expect(editorHistory(state,{type:'change',design:ORIGINAL_REFERENCE})).toBe(state);
    for(let i=1;i<=15;i++)state=editorHistory(state,{type:'change',design:{...ORIGINAL_REFERENCE,engraving:String(i)}});
    expect(state.past).toHaveLength(10);
    for(let i=0;i<10;i++)state=editorHistory(state,{type:'undo'});
    expect(state.design.engraving).toBe('5');
    expect(state.future).toHaveLength(10);
  });
  it('loads earlier drafts and preserves unrecognizable or removed parts',()=>{
    const old={design:{...ORIGINAL_REFERENCE,engraving:'A'},revision:'old'};
    localStorage.setItem('open-jewelry-studio:'+template.revision,JSON.stringify(old));
    expect(readEditorDraft(template,localStorage).history.design).toEqual(old.design);
    const invalid=JSON.stringify({...old,design:{...old.design,headId:'deleted-model'}});
    localStorage.setItem(draftKey(template.id),invalid);
    expect(readEditorDraft(template,localStorage).issue).toContain('戒头');
    expect(localStorage.getItem(draftKey(template.id))).toBe(invalid);
    startNewDraft(template,localStorage);
    expect(localStorage.getItem(draftKey(template.id)+':previous')).toBe(invalid);
    expect(readEditorDraft(template,localStorage).history.design).toEqual(ORIGINAL_REFERENCE);
  });
  it('leaves the precision editor draft in its own storage key',()=>{
    const precision=RING_CATALOG[0];
    const raw=JSON.stringify({design:{head:'halo',metal:'white'},revision:'precision'});
    localStorage.setItem('open-jewelry-studio:'+precision.revision,raw);
    expect(readEditorDraft(precision,localStorage).issue).toBeUndefined();
    expect(localStorage.getItem('open-jewelry-studio:'+precision.revision)).toBe(raw);
  });
  it('backs up the target draft before a confirmed template switch and aborts if backup fails',()=>{
    const saved=JSON.stringify({design:{...ORIGINAL_REFERENCE,center:'ruby'},revision:'saved'});
    localStorage.setItem(draftKey(template.id),saved);
    const write=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('full','QuotaExceededError');});
    expect(()=>startNewDraft(template,localStorage)).toThrow();
    expect(localStorage.getItem(draftKey(template.id))).toBe(saved);
    write.mockRestore();
    startNewDraft(template,localStorage);
    expect(localStorage.getItem(draftKey(template.id)+':previous')).toBe(saved);
    expect(readEditorDraft(template,localStorage).history.revision).not.toBe('saved');
  });
});
