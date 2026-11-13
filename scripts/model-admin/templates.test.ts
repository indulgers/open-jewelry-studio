// @vitest-environment node
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {expect,test} from 'vitest';
import {createTemplateLibrary} from './templates';

test('publishes a reviewed part selection as an immutable consumer revision',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'template-library-test-'));
  try{
    const storage=join(directory,'storage');
    const publicDir=join(directory,'public');
    await mkdir(storage);
    const library=createTemplateLibrary(storage,publicDir);
    const [head,band]=library.stock;
    for(const source of [head,band]){
      for(const path of [source.assets.head,source.assets.headStones,source.assets.band,source.assets.pave,source.assets.adapter]){
        if(!path)continue;
        const file=join(publicDir,path.slice(1));
        await mkdir(dirname(file),{recursive:true});
        await writeFile(file,'test asset');
      }
    }
    const selection={name:'测试模板',head:head.id,headStones:head.id,band:band.id,pave:band.assets.pave?band.id:''};
    await expect(library.save({...selection,headStones:band.id})).rejects.toMatchObject({status:422});
    const draft=await library.save(selection);
    expect((await library.list()).published).toEqual([]);
    const preview=await library.preview(draft.id,draft.revision);
    expect(preview.library[head.id].head).toBe(head.assets.head);
    expect(preview.library[band.id].band).toBe(band.assets.band);
    const release=await library.publish(draft.id,draft.revision,Buffer.from('test image'));
    expect((await library.list()).published).toEqual([release]);
    expect(await readFile(join(publicDir,release.image.slice(1)),'utf8')).toBe('test image');
    const next=await library.save({...draft,name:'新草稿',expectedRevision:draft.revision});
    expect(next.revision).not.toBe(draft.revision);
    await expect(library.preview(draft.id,draft.revision)).rejects.toMatchObject({status:409});
    await expect(library.save({...draft,expectedRevision:draft.revision})).rejects.toMatchObject({status:409});
    expect(JSON.parse(await readFile(join(publicDir,release.url.slice(1)),'utf8')).name).toBe('测试模板');
  }finally{await rm(directory,{recursive:true,force:true});}
});
