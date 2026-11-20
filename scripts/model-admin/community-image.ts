import {RequestError} from './templates.ts';
const invalid=():never=>{throw new RequestError(422,'请选择有效的 JPEG 图片，尺寸不超过 1600 像素。');};

// Browser uploads are re-encoded as single-scan baseline JPEG. Keep only
// image tables, frame, scan and entropy data. Discard EXIF, ICC and comments.
export function previewJpeg(value:unknown):Uint8Array<ArrayBuffer>{
  const encoded=typeof value==='string'&&/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)?.[1];
  if(!encoded||encoded.length>1400000)return invalid();
  const data=Buffer.from(encoded,'base64');
  if(data.length<12||data.length>1024*1024||data.readUInt16BE(0)!==0xffd8)return invalid();
  let offset=2,frame=false;
  const keep=[data.subarray(0,2)];
  while(offset+4<=data.length){
    if(data[offset]!==0xff)return invalid();
    const marker=data[offset+1],length=data.readUInt16BE(offset+2),end=offset+2+length;
    if(length<2||end>data.length)return invalid();
    if(marker===0xc0){
      if(frame||length<11||data[offset+4]!==8)return invalid();
      const height=data.readUInt16BE(offset+5),width=data.readUInt16BE(offset+7);
      if(!height||!width||height>1600||width>1600)return invalid();
      frame=true;
    }
    if([0xc0,0xdb,0xc4,0xdd,0xda].includes(marker))keep.push(data.subarray(offset,end));
    else if(!(marker>=0xe0&&marker<=0xef)&&marker!==0xfe)return invalid();
    if(marker===0xda){
      if(!frame||end+2>=data.length)return invalid();
      for(let pos=end;pos<data.length-1;pos++){
        if(data[pos]!==0xff)continue;
        const next=data[pos+1];
        if(next===0xff)continue;
        if(next===0||next>=0xd0&&next<=0xd7){pos++;continue;}
        if(next!==0xd9||pos!==data.length-2)return invalid();
        keep.push(data.subarray(end,pos+2));return new Uint8Array(Buffer.concat(keep));
      }
      return invalid();
    }
    offset=end;
  }
  return invalid();
}
