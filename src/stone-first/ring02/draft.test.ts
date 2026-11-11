import {beforeEach,expect,it} from 'vitest';
import {BASE_DESIGN,TEMPLATE_REVISION} from './model';
import {readDraft,writeDraft} from './draft';

beforeEach(()=>localStorage.clear());

it('continues an older draft and keeps the same revision across refreshes after saving',()=>{
  localStorage.setItem('open-jewelry-studio:'+TEMPLATE_REVISION,JSON.stringify({...BASE_DESIGN,metal:'rose'}));
  const draft=readDraft();
  expect(draft.design.metal).toBe('rose');
  expect(draft.revision).toMatch(/^[0-9a-f]{32}$/);
  writeDraft(draft);
  expect(readDraft()).toEqual(draft);
});
