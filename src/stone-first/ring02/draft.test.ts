import {beforeEach,expect,it} from 'vitest';
import {BASE_DESIGN,TEMPLATE_REVISION} from './model';
import {readDraft,writeDraft} from './draft';

beforeEach(()=>localStorage.clear());

it('migrates old metal finishes without reusing a possible cart revision',()=>{
  const revision='a'.repeat(32);
  const {engraving,...older}=BASE_DESIGN;
  localStorage.setItem('open-jewelry-studio:'+TEMPLATE_REVISION,JSON.stringify({
    design:{...older,metal:'rose',reach:1.05},revision,
  }));
  const draft=readDraft();
  expect(draft.design).toMatchObject({metal:'white',reach:1.05,engraving:''});
  expect(draft.revision).not.toBe(revision);
  expect(draft.revision).toMatch(/^[0-9a-f]{32}$/);
  writeDraft(draft);
  expect(readDraft()).toEqual(draft);
});

it('restores confirmed engraving exactly on refresh',()=>{
  const draft=readDraft();
  draft.design={...draft.design,engraving:'A & B - 2026',engravingStyle:{font:'italic',align:'center'}};
  writeDraft(draft);
  expect(readDraft()).toEqual(draft);
});

it('rejects unsupported or unconfirmed engraving in saved configurations',()=>{
  const draft=readDraft();
  for(const engraving of ['<script>','A'.repeat(17),' A ','A\nB']){
    writeDraft({...draft,design:{...draft.design,engraving}});
    expect(readDraft().design.engraving).toBe('');
  }
});

it('gives repacked old designs a new revision and keeps original layouts on the old revision',()=>{
  const key='open-jewelry-studio:'+TEMPLATE_REVISION;
  const revision='c'.repeat(32);
  localStorage.setItem(key,JSON.stringify({design:BASE_DESIGN,revision}));
  expect(readDraft().revision).toBe(revision);

  const design={...BASE_DESIGN,reach:1.05};
  localStorage.setItem(key,JSON.stringify({design,revision}));
  const draft=readDraft();
  expect(draft.design).toEqual(design);
  expect(draft.revision).not.toBe(revision);
  writeDraft(draft);
  expect(readDraft()).toEqual(draft);
});

it('keeps saved draft measurements and new profile defaults within a verified identity',()=>{
  const alice='member:alice',bob='member:bob';
  const guestDraft=readDraft('guest');
  writeDraft({...guestDraft,design:{...guestDraft.design,ringSizeUS:5}},'guest');
  const personal=readDraft(alice);
  expect(personal.design.ringSizeUS).toBeUndefined();
  writeDraft({...personal,design:{...personal.design,ringSizeUS:8.25}},alice);
  expect(readDraft(bob).design.ringSizeUS).toBeUndefined();
  expect(readDraft(null).design.ringSizeUS).toBeUndefined();
  expect(()=>writeDraft(personal,null)).toThrow();
  expect(readDraft('guest').design.ringSizeUS).toBe(5);
  expect(readDraft(alice).design.ringSizeUS).toBe(8.25);
});
