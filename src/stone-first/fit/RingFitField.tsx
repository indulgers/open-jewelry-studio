import {useFitScope} from './FitSession';
import {useState} from 'react';
import {FitProfileForm,RingSizeOptions} from './FitProfileForm';
import {RingGuide} from './FitGuide';
import {readFitProfile} from './profile';
import './fit.css';

export function RingFitField({value,onChange,disabled=false}:{value?:number;onChange:(size?:number)=>void;disabled?:boolean}){
  const scope=useFitScope();
  const [profile,setProfile]=useState(()=>readFitProfile(scope));
  return <fieldset className="fit-editor" disabled={disabled}>
    <legend>佩戴尺寸</legend>
    <label>本款圈号（美码）<select value={value??''} onChange={e=>onChange(e.target.value?Number(e.target.value):undefined)}><RingSizeOptions/></select></label>
    {profile.ringSizeUS!==undefined&&profile.ringSizeUS!==value&&
      <button type="button" className="fit-link" onClick={()=>onChange(profile.ringSizeUS)}>采用常用圈号 US {profile.ringSizeUS}</button>}
    <details><summary>如何测量圈号</summary><RingGuide/></details>
    {scope!==null&&<details><summary>编辑我的佩戴资料</summary><FitProfileForm onSaved={setProfile}/>
      <a href="#/diy/fit" className="fit-link">查看项链测量指南</a></details>}
  </fieldset>;
}
