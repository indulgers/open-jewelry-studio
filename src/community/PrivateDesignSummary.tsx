import type {Work} from './client';
import {summarizeSavedDesign} from './saved-design-summary';

export default function PrivateDesignSummary({work}:{work:Work}){
  const rows=summarizeSavedDesign(work);
  return <details><summary>查看保存的配置</summary>
    {rows.length?<dl className="community-config">{rows.map(({label,value},index)=>
      <div key={index}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>:<p>这个历史版本缺少可识别的配置，预览图仍可查看。</p>}
    {work.basis?<dl className="community-config">{([['template','模板'],['head','戒头'],['band','戒圈']] as const).map(([key,label])=>
      <div key={key}><dt>{label}版本</dt><dd>{work.basis![key].id} · {work.basis![key].revision}</dd></div>)}</dl>:<p>历史版本未记录。</p>}
  </details>;
}
