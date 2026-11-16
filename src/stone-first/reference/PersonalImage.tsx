import {useEffect,useState} from 'react';
import {consumerRequest,guestToken} from '../consumer-api';
import {imagePosition,type PersonalImage as ImageData} from './personalization';

export function PersonalImagePreview({image}:{image:ImageData}){
  const [url,setUrl]=useState(''),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();let objectUrl='';
    setUrl('');setError('');
    Promise.resolve().then(()=>fetch('/api/model-admin/consumer/images/'+image.id,{signal:controller.signal,headers:{Authorization:'Bearer '+guestToken()}}))
      .then(async response=>{if(!response.ok)throw new Error('图片暂未加载，请核对恢复码或重试。');const blob=await response.blob();if(!controller.signal.aborted){objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}})
      .catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:'图片加载失败。');});
    return ()=>{controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[image.id,attempt]);
  return <figure className="personal-image-preview">{url?<img src={url} alt={image.name+'参考图'}/>:error?<p role="alert">{error}<button onClick={()=>setAttempt(value=>value+1)}>重试图片</button></p>:<p role="status">正在读取图片…</p>}<figcaption>{image.name} · 期望位置 {imagePosition(image.position)}，实际尺寸及工艺待确认</figcaption></figure>;
}
async function upload(file:File){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('请选择 10 MB 以内的 JPG、PNG 或 WebP 图片。暂不支持 SVG。');
  const image=await createImageBitmap(file);
  try{
    const scale=Math.min(1,1600/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
    const context=canvas.getContext('2d');if(!context)throw new Error('浏览器无法处理图片，请换张图片重试。');
    context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/jpeg',.86);
    if(data.length>1400*1024)throw new Error('图片处理后仍过大，请压缩后重试。');
    return await consumerRequest<{id:string}>('images',{image:data});
  }finally{image.close();}
}
export function PersonalImageField({value,disabled,onChange,onBusy}:{value?:ImageData;disabled:boolean;onChange:(image:ImageData|undefined)=>void;onBusy:(busy:boolean)=>void}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  return <fieldset id="source-image" tabIndex={-1} disabled={disabled||busy} className="personal-image-field"><legend>图片个性化 <span>选填</span></legend>
    <p>上传刻纹或图案参考，工艺人员会确认可制作的位置与尺寸。</p>
    <label>上传参考图片<input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled||busy} onChange={async event=>{
      const file=event.target.files?.[0];event.target.value='';if(!file)return;
      setBusy(true);onBusy(true);setError('');
      try{const result=await upload(file);onChange({id:result.id,name:file.name.slice(0,120),position:value?.position??'inner-band'});}catch(error){setError(error instanceof Error?error.message:'上传失败，原图片仍保留，请重新选择重试。');}finally{setBusy(false);onBusy(false);}
    }}/></label>
    {busy&&<p role="status">正在处理并上传…</p>}{error&&<p role="alert">{error}</p>}
    {value&&<><PersonalImagePreview image={value}/><label>期望位置<select value={value.position} onChange={event=>onChange({...value,position:event.target.value as ImageData['position']})}><option value="inner-band">内圈（待复核）</option><option value="outer-band">外侧戒臂（待复核）</option></select></label><button onClick={()=>onChange(undefined)}>移除参考图片</button></>}
    <p>只作个性化参考，不会把图片直接当作可生产的刻纹文件。</p>
  </fieldset>;
}
