import {useState} from 'react';
import {RING_SIZES,sizeChartUrl} from './sizing';

function FingerDrawing(){
  return <svg className="fit-figure" viewBox="0 0 260 110" role="img" aria-label="手指根部围一圈软尺，在相交处读取周长">
    <g fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 36 Q55 35 90 32 L182 23 Q222 17 231 36 Q238 62 206 66 L99 77 Q58 83 16 87"/>
      <path d="M124 29 Q152 42 131 73 L116 76 Q136 52 109 31 Z" fill="var(--page,white)"/>
      <path d="M114 36 l8 2 M119 42 l4 1 M121 50 l7 1 M120 56 l4 1 M119 63 l6 1"/>
      <path d="M119 70 Q99 87 70 91 l-3 -10 q26 -5 44 -18" fill="var(--page,white)"/>
    </g></svg>;
}

export function RingGuide(){
  return <section className="fit-guide" aria-label="手指测量">
    <h3>量手指周长</h3><FingerDrawing/>
    <ol><li>把软尺绕在预计佩戴的位置，贴肤一圈，读取相交处的毫米数。</li>
      <li>再量一次，确认戒圈能过指节。两次结果跨档、指节较宽或卡在两档间时，先留作待测量，制作前用量圈复核。</li></ol>
    <p>表中为美码对应的参考内周。成品公差由工艺人员确认。</p>
    <details><summary>圈号对照表</summary><table><thead><tr><th>美码 US</th><th>内周（mm）</th></tr></thead>
      <tbody>{RING_SIZES.map(size=><tr key={size.us}><td>{size.us}</td><td>{size.circumference}</td></tr>)}</tbody></table>
      <a href={sizeChartUrl} target="_blank" rel="noreferrer">Helzberg 尺寸表</a></details>
  </section>;
}

export function NecklaceGuide(){
  const [base,setBase]=useState('40'),[extension,setExtension]=useState('5');
  const min=Number(base),extra=Number(extension);
  const valid=base!==''&&extension!==''&&min>0&&extra>=0&&Number.isFinite(min+extra);
  return <section className="fit-guide" aria-label="项链测量">
    <h3>量项链长度</h3>
    <svg className="fit-figure" viewBox="0 0 260 110" role="img" aria-label="颈前弧线表示主链与加长后的佩戴位置">
      <g fill="none" stroke="currentColor" strokeWidth="2"><path d="M106 10 Q110 34 96 45 Q73 57 36 63 M154 10 Q150 34 164 45 Q187 57 224 63" opacity=".6"/>
      <path d="M98 43 Q130 101 162 43"/><path d="M94 47 Q130 123 166 47" strokeDasharray="4 4"/></g>
    </svg>
    <p>用细绳在颈前摆出想要的垂落位置，取下拉直测量全长。量已有项链时包含搭扣，延长链单独量。</p>
    <div className="fit-fields fit-lengths">
      <label>主链含扣（cm）<input type="number" min=".1" step=".1" value={base} onChange={e=>setBase(e.target.value)}/></label>
      <label>延长链（cm）<input type="number" min="0" step=".1" value={extension} onChange={e=>setExtension(e.target.value)}/></label>
    </div>
    <p aria-live="polite">{valid?'示例可调长度　'+min+(extra?'–'+Number((min+extra).toFixed(2)):'')+' cm':'请填写正数主链长度和零或正数延长链长度。'}</p>
  </section>;
}
