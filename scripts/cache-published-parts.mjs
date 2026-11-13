import {mkdir,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const origin=process.argv[2]??'https://open-jewelry-studio.vercel.app';
const output=process.argv[3];if(!output)throw new Error('Usage: node scripts/cache-published-parts.mjs ORIGIN OUTPUT_DIRECTORY');const products=await fetch(origin+'/api/model-admin/public/index.json').then(r=>r.json());
await mkdir(output,{recursive:true});const parts={},catalog=[];
for(const p of products){
 const t=await fetch(origin+p.url).then(r=>r.json());
 for(const [id,source] of Object.entries(t.library)){
  if(parts[id])continue;
  const local={...source};
  await Promise.all(['head','band','headStones','pave','adapter'].map(async kind=>{
   if(!source[kind])return;const path=source[kind];const file=createHash('sha256').update(path).digest('hex').slice(0,16)+'.glb';
   const response=await fetch(origin+path);if(!response.ok)throw Error(path+' '+response.status);
   await writeFile(output+'/' +file,Buffer.from(await response.arrayBuffer()));local[kind]=file;
  }));parts[id]=local;
 }
 catalog.push({id:p.id,name:p.name,head:t.headId,band:t.bandId});console.log(p.name);
}
await writeFile(output+'/library.json',JSON.stringify(parts,null,2));await writeFile(output+'/catalog.json',JSON.stringify(catalog,null,2));
