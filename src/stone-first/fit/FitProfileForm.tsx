import {useState} from 'react';
import {readFitProfile,saveFitProfile,type FitProfile} from './profile';
import {RING_SIZES} from './sizing';

export function RingSizeOptions(){
  return <><option value="">待测量</option>{RING_SIZES.map(size=>
    <option key={size.us} value={size.us}>US {size.us}　/　{size.circumference} mm</option>)}</>;
}

export function FitProfileForm({onSaved}:{onSaved?:(profile:FitProfile)=>void}){
  const [values,setValues]=useState<FitProfile>(readFitProfile);
  const [notice,setNotice]=useState('');
  const [failed,setFailed]=useState(false);
  function change(key:keyof FitProfile,value:string){
    setValues({...values,[key]:value===''?undefined:Number(value)});
    setNotice('');
  }
  function save(clear=false){
    const next=clear?{}:values;
    try{
      saveFitProfile(next);
      if(clear)setValues({});
      setFailed(false);setNotice(clear?'已清除本机佩戴资料。':'已保存至此浏览器。');
      onSaved?.(next);
    }catch{setFailed(true);setNotice('浏览器未能保存，请检查本机储存权限。');}
  }
  return <form className="fit-profile" onSubmit={event=>{event.preventDefault();save();}}>
    <p>三项均可留空。新设计会预填常用圈号，身高和体重只保存在此浏览器。</p>
    <div className="fit-fields">
      <label>身高（cm）<input type="number" inputMode="decimal" min=".1" step=".1" value={values.heightCm??''} onChange={e=>change('heightCm',e.target.value)}/></label>
      <label>体重（kg）<input type="number" inputMode="decimal" min=".1" step=".1" value={values.weightKg??''} onChange={e=>change('weightKg',e.target.value)}/></label>
      <label>常用圈号（美码）<select value={values.ringSizeUS??''} onChange={e=>change('ringSizeUS',e.target.value)}><RingSizeOptions/></select></label>
    </div>
    <div className="fit-actions"><button className="shop-button" type="submit">保存佩戴资料</button>
      <button type="button" className="fit-link" onClick={()=>save(true)}>清除本机资料</button></div>
    <p role={failed?'alert':'status'}>{notice}</p>
  </form>;
}
