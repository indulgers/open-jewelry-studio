import {deflateSync} from 'node:zlib';
import type {ManagedTemplate} from '../../src/stone-first/reference/managed-types.ts';
import stockAssets from '../../src/stone-first/reference/part-assets.json' with {type:'json'};

import type {PartViews} from '../../src/stone-first/catalog.ts';
const size=256;
const crcTable=Uint32Array.from({length:256},(_,byte)=>{
  let value=byte;
  for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);
  return value;
});
function pngCrc(bytes:Uint8Array){
  let crc=0xffffffff;
  for(const byte of bytes)crc=(crc>>>8)^crcTable[(crc^byte)&0xff];
  return (crc^0xffffffff)>>>0;
}

function png(rgb:Buffer){
  function chunk(type:string,data:Buffer){
    const result=Buffer.alloc(data.length+12);
    result.writeUInt32BE(data.length);
    result.write(type,4,'ascii');
    data.copy(result,8);
    result.writeUInt32BE(pngCrc(result.subarray(4,-4)),result.length-4);
    return result;
  }
  const header=Buffer.alloc(13);
  header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=2;
  const stride=size*3,rows=Buffer.alloc(size*(stride+1));
  for(let y=0;y<size;y++)rgb.copy(rows,y*(stride+1)+1,y*stride,(y+1)*stride);
  return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}

export const partViewNames={head:'head-top.png',band:'band-side.png'} as const;
type Role=keyof typeof partViewNames;

export function partViewInputs(template:ManagedTemplate,base:string,role:Role){
  const id=role==='head'?template.headId:template.bandId;
  const part=template.library[id];
  if(!part||Object.hasOwn(stockAssets,id))return;
  const urls=role==='head'?[part.head,part.headStones]:[part.band,...(part.pave?[part.pave]:[])];
  if(urls.some(url=>!url||!url.startsWith(base)))return;
  const names=urls.map(url=>url.slice(base.length));
  if(names.every(name=>/^ring(?:-(?:head|pave|adapter))?-[a-f0-9]{12}\.glb$/.test(name)))return names;
}

export async function renderPartView(bytes:Uint8Array[],role:Role){
  const {renderPartPixels}=await import('./part-view-raster.mjs');
  return png(await renderPartPixels(bytes,role,size));
}

// Assets have already been copied into the immutable release. Read only those files.
export async function publishPartViews(template:ManagedTemplate,base:string,read:(name:string)=>Promise<Uint8Array>,save:(name:string,data:Buffer<ArrayBuffer>)=>Promise<void>){
  const views:PartViews={};
  for(const role of ['head','band'] as const){
    const inputs=partViewInputs(template,base,role);
    if(!inputs)continue;
    const bytes=await Promise.all(inputs.map(read));
    let image:Buffer<ArrayBuffer>;
    try{image=await renderPartView(bytes,role);}
    catch(error){
      console.warn('无法生成发布部件图',template.id,role,error instanceof Error?error.message:'无法读取几何');
      continue;
    }
    const name=partViewNames[role];
    await save(name,image);
    views[role]=base+name;
  }
  return views;
}
