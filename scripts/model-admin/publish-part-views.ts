import {crc32,deflateSync} from 'node:zlib';
import type {ManagedTemplate} from '../../src/stone-first/reference/managed-types.ts';
import stockAssets from '../../src/stone-first/reference/part-assets.json' with {type:'json'};
import {renderPartPixels} from './part-view-raster.mjs';

import type {PartViews} from '../../src/stone-first/catalog.ts';
const size=256;

function png(rgb:Buffer){
  function chunk(type:string,data:Buffer){
    const result=Buffer.alloc(data.length+12);
    result.writeUInt32BE(data.length);
    result.write(type,4,'ascii');
    data.copy(result,8);
    result.writeUInt32BE(crc32(result.subarray(4,-4)),result.length-4);
    return result;
  }
  const header=Buffer.alloc(13);
  header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=2;
  const stride=size*3,rows=Buffer.alloc(size*(stride+1));
  for(let y=0;y<size;y++)rgb.copy(rows,y*(stride+1)+1,y*stride,(y+1)*stride);
  return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}

// Assets have already been copied into the immutable release. Read only those files.
export async function publishPartViews(template:ManagedTemplate,base:string,read:(name:string)=>Promise<Uint8Array>,save:(name:string,data:Buffer<ArrayBuffer>)=>Promise<void>){
  const views:PartViews={};
  for(const role of ['head','band'] as const){
    const sourceId=role==='head'?template.headId:template.bandId;
    if(Object.hasOwn(stockAssets,sourceId))continue;
    const part=template.library[sourceId];
    if(!part)continue;
    const urls=role==='head'?[part.head,part.headStones]:[part.band,...(part.pave?[part.pave]:[])];
    if(urls.some(url=>!url||!url.startsWith(base)))continue;
    const names=urls.map(url=>url.slice(base.length));
    if(names.some(name=>!/^ring(?:-(?:head|pave|adapter))?-[a-f0-9]{12}\.glb$/.test(name)))continue;
    const bytes=await Promise.all(names.map(read));
    let rgb:Buffer;
    try{rgb=await renderPartPixels(bytes,role,size);}
    catch(error){
      console.warn('无法生成发布部件图',template.id,role,error instanceof Error?error.message:'无法读取几何');
      continue;
    }
    const name=role==='head'?'head-top.png':'band-side.png';
    await save(name,png(rgb));
    views[role]=base+name;
  }
  return views;
}
