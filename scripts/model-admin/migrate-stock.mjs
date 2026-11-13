import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {cloudStore} from './cloud-store.ts';
import {RING_CATALOG} from '../../src/stone-first/catalog.ts';
const project=fileURLToPath(new URL('../../',import.meta.url));
const store=cloudStore();
if(!store)throw new Error('R2 is not configured');
const partAssets=JSON.parse(await readFile(join(project,'src/stone-first/reference/part-assets.json'),'utf8'));
const inventory={};
async function upload(key,bytes,type){
  const md5='"'+createHash('md5').update(bytes).digest('hex')+'"';
  const existing=await store.get(key,'HEAD');
  if(existing?.headers.get('etag')===md5)return;
  if(!await store.put(key,bytes,type,{etag:existing?.headers.get('etag')??null}))throw new Error('Concurrent change at '+key);
  const check=await store.get(key,'HEAD');
  if(check?.headers.get('etag')!==md5)throw new Error('Upload verification failed at '+key);
}
async function files(dir){
 const entries=await readdir(join(project,'public',dir),{withFileTypes:true});
 return (await Promise.all(entries.map(item=>item.isDirectory()?files(dir+'/'+item.name):dir+'/'+item.name))).flat();
}
const paths=(await Promise.all(['models','media'].map(files))).flat().filter(path=>!/^models\/(webgi|reference|managed)\//.test(path)&&!path.startsWith('media/sample/'));
for(let index=0;index<paths.length;index+=4){
 await Promise.all(paths.slice(index,index+4).map(async path=>{
  const bytes=await readFile(join(project,'public',path));
  const type=path.endsWith('.glb')?'model/gltf-binary':path.endsWith('.jpg')?'image/jpeg':path.endsWith('.png')?'image/png':path.endsWith('.json')?'application/json':'application/octet-stream';
  await upload('studio/v1/assets/'+path,bytes,type);inventory[path]=createHash('sha256').update(bytes).digest('hex');
 }));
 console.log('Verified assets',Math.min(index+4,paths.length),'/',paths.length);
}
for(const ring of RING_CATALOG){
 for(const filename of ['source.obj',...(ring.id==='ring-02'?[]:['source.json'])]){
  await upload('studio/v1/stock/sources/'+ring.id+'/'+filename,await readFile(join(project,'assets/source',ring.id,filename)),filename.endsWith('.json')?'application/json':'application/octet-stream');
 }
}
const library=RING_CATALOG.map(ring=>({id:ring.id,name:ring.name,revision:ring.revision,stock:true,assets:partAssets[ring.id],model:ring.model,source:'/api/model-admin/stock/'+ring.id,editor:ring.editor}));
for(const [name,value] of Object.entries({assets:inventory,library,catalog:RING_CATALOG})){
 await upload('studio/v1/stock/'+name+'.json',Buffer.from(JSON.stringify(value)),'application/json');
}
console.log(JSON.stringify({assets:paths.length,stockModels:library.length,verified:true}));
