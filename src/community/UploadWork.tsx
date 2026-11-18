import {useEffect,useRef,useState} from 'react';
import {communityRequest,errorText} from './client';

export async function imageForUpload(file:File){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024)
    throw new Error('请选择 12 MB 以内的 JPG、PNG 或 WebP。');
  const image=new Image();
  const url=URL.createObjectURL(file);
  try{
    image.src=url;await image.decode();
    const scale=Math.min(1,1200/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.width*scale));
    canvas.height=Math.max(1,Math.round(image.height*scale));
    const context=canvas.getContext('2d');
    if(!context)throw new Error('浏览器无法读取图片。');
    context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(image,0,0,canvas.width,canvas.height);
    const jpeg=canvas.toDataURL('image/jpeg',.8);
    if(!jpeg.startsWith('data:image/jpeg;')||jpeg.length>1_350_000)throw new Error('图片过大，请缩小后再试。');
    return jpeg;
  }finally{URL.revokeObjectURL(url);}
}
export function UploadWork({onSaved}:{onSaved:()=>void}){
  const [title,setTitle]=useState(''),[image,setImage]=useState(''),[error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const sequence=useRef(0);
  useEffect(()=>()=>{sequence.current++;},[]);
  return <form className="community-form community-upload" onSubmit={async event=>{
    event.preventDefault();if(!image||!title.trim()||busy)return;
    setBusy(true);setError('');
    try{await communityRequest('designs',{title:title.trim(),image});onSaved();}
    catch(cause){setError(errorText(cause));}finally{setBusy(false);}
  }}>
    <label>作品名称<input value={title} onChange={event=>setTitle(event.target.value)} required maxLength={60}/></label>
    <label>预览图<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async event=>{
      const file=event.target.files?.[0],id=++sequence.current;setImage('');setError('');
      if(!file)return;
      try{const result=await imageForUpload(file);if(sequence.current===id)setImage(result);}
      catch(cause){if(sequence.current===id)setError(errorText(cause));}
    }}/></label>
    {image&&<img className="community-dialog-preview" alt="待保存的作品图片" src={image}/>}
    {error&&<p role="alert">{error}</p>}
    <button className="shop-button" disabled={!image||!title.trim()||busy}>{busy?'正在保存…':'私密保存作品'}</button>
  </form>;
}
