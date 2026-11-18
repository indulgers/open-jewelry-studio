import {useState} from 'react';
import {ENGRAVING_LIMIT,engravingProblem} from '../ring02/engraving';
import {ENGRAVING_FONTS,engravingFont,engravingStyleLabel,type EngravingStyle} from './style';
import './engraving.css';
export function EngravingEditor({id,text,style,disabled,dirty,onText,onStyle,onConfirm,onCancel,onView}:{
  id:string;text:string;style:EngravingStyle;disabled?:boolean;dirty:boolean;onText:(value:string)=>void;
  onStyle:(style:EngravingStyle)=>void;onConfirm:()=>void;onCancel:()=>void;onView:()=>void;
}){
  const [composing,setComposing]=useState(false);
  const error=composing?'':engravingProblem(text.trim());
  return <fieldset disabled={disabled} className="ring02-engraving engraving-editor"><legend>内圈刻字 <span>选填</span></legend>
    <figure className="engraving-card"><figcaption>内圈刻字预览</figcaption>
      <blockquote style={{fontFamily:engravingFont(style.font),fontStyle:style.font==='italic'?'italic':'normal',textAlign:'center'}}>{text.trim()&&!error?text.trim():'刻字预览'}</blockquote>
      <small>{engravingStyleLabel(style)}</small><button type="button" className="shop-text-link" onClick={onView}>查看内圈效果 ↗</button>
    </figure>
    <div className="engraving-label"><label htmlFor={id}>刻字文字</label><span>{Array.from(text).length} / {ENGRAVING_LIMIT}</span></div>
    <input id={id} value={text} autoComplete="off" spellCheck={false} placeholder="例如 相伴四季" aria-invalid={!!error} aria-describedby={id+'-help '+id+'-error'} onCompositionStart={()=>setComposing(true)} onCompositionEnd={()=>setComposing(false)} onChange={event=>onText(event.target.value)}/>
    <div className="engraving-suggestions" aria-label="刻字示例">{['相伴四季','A & L','2026.11.16'].map(value=><button key={value} type="button" onClick={()=>onText(value)}>{value}</button>)}</div>
    <div role="group" aria-label="刻字字形" className="engraving-options">{Object.entries(ENGRAVING_FONTS).map(([key,label])=><button key={key} type="button" aria-pressed={style.font===key} onClick={()=>onStyle({...style,font:key as EngravingStyle['font']})}>{label}</button>)}</div>
    <p id={id+'-help'}>最多 {ENGRAVING_LIMIT} 个字符，支持中文、英文字母、数字、空格和 . &amp; -。字形与内圈位置为效果预览，实际字体、字高和可刻范围待工艺确认。</p>
    <p id={id+'-error'} role="alert">{error}</p>
    <div className="ring02-engraving-actions"><button type="button" disabled={!dirty} onClick={onCancel}>取消修改</button><button type="button" disabled={!dirty||!!error||composing} onClick={onConfirm}>确认刻字</button></div>
  </fieldset>;
}
