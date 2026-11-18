// Regenerate the seven stock card pairs from their actual meshes. Requires cwebp on PATH.
import {readFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {renderPartPixels} from './model-admin/part-view-raster.mjs';
import parts from '../src/stone-first/reference/part-assets.json' with {type:'json'};

const root=new URL('../public/',import.meta.url);
const output=new URL('part-views/',root);
await mkdir(output,{recursive:true});
const size=576;
for(const [id,stock] of Object.entries(parts)){
  for(const kind of ['head','band']){
    const urls=kind==='head'?[stock.head,stock.headStones]:[stock.band,stock.pave];
    const files=await Promise.all(urls.filter(Boolean).map(url=>readFile(new URL(url.slice(1),root))));
    const rgb=await renderPartPixels(files,kind,size);
    const ppm=Buffer.concat([Buffer.from('P6\n'+size+' '+size+'\n255\n'),rgb]);
    const filename=fileURLToPath(new URL(id+'-'+kind+'.webp',output));
    const result=spawnSync('cwebp',['-quiet','-q','90','-resize','256','256','-o',filename,'--','-'],{input:ppm});
    if(result.error||result.status!==0)throw new Error(result.error?.message??result.stderr.toString());
  }
}
