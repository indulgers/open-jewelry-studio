import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {cloudStore} from './cloud-store.ts';
export async function migrateProducts(store){
const root='studio/v1/';
async function read(key){const r=await store.get(root+key);return r&&await r.json();}
async function write(key,value){return store.put(root+key,JSON.stringify(value),'application/json',{etag:null});}
const [catalog,library,prices]=await Promise.all([read('stock/catalog.json'),read('stock/library.json'),read('pricing.json')]);
const featured=['ring-starlight','ring-solstice','ring-petal','ring-rosette'];
for(const ring of catalog){
 const hash=createHash('sha256').update('catalog-product:'+ring.id).digest('hex').slice(0,32);
 const id=[hash.slice(0,8),hash.slice(8,12),hash.slice(12,16),hash.slice(16,20),hash.slice(20)].join('-');
 if(await read('published/'+id+'.json')){console.log('Already managed',ring.id);continue;}
 const source=library.find(item=>item.id===ring.id);
 const fees=prices?.components[ring.id]??{head:0,band:0,pave:0};
 let draft=await read('drafts/'+id+'.json');
 if(!draft){
  const basePrice=prices?.bases[ring.id]??ring.price.base;
  draft={id,revision:randomUUID(),updatedAt:new Date().toISOString(),name:ring.name,head:ring.id,headStones:ring.id,band:ring.id,pave:source.assets.pave?ring.id:'',
   basePrice,pricing:{base:basePrice,head:fees.head,band:fees.band,pave:source.assets.pave?fees.pave:0},
   description:ring.description,cover:ring.image,campaign:ring.campaign,collection:ring.collection,catalogId:ring.id,featured:featured.includes(ring.id),order:featured.includes(ring.id)?(featured.indexOf(ring.id)+1)*10:100+catalog.indexOf(ring)};
  if(!await write('drafts/'+id+'.json',draft))throw new Error('Concurrent draft change');
 }
 const base='/api/model-admin/public/'+id+'/'+draft.revision+'/';
 const release='releases/'+id+'/'+draft.revision+'/';
 const cover=await store.get(root+'assets/'+ring.image.slice(1));
 if(!cover)throw new Error('Missing cover '+ring.id);
 await store.put(root+release+'cover.jpg',await cover.arrayBuffer(),'image/jpeg',{etag:null});
 const template={...draft,headName:ring.name,bandName:ring.name,headId:ring.id,bandId:ring.id,library:{[ring.id]:source.assets},publishedAt:new Date().toISOString(),files:['cover.jpg']};
 await write(release+'template.json',template);
 const current={id,revision:draft.revision,name:draft.name,headName:ring.name,bandName:ring.name,pricing:draft.pricing,description:draft.description,order:draft.order,featured:draft.featured,catalogId:ring.id,campaign:draft.campaign,collection:draft.collection,url:base+'template.json',image:base+'cover.jpg'};
 if(!await write('published/'+id+'.json',{current,revisions:[draft.revision],hidden:false,stateRevision:randomUUID()}))throw new Error('Concurrent publication change');
 console.log('Managed original',ring.id,id);
}

}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const store=cloudStore();
 if(!store)throw new Error('R2 is not configured');
 await migrateProducts(store);
}
