import {ATELIER_GEMS} from '../../assets/atelierManifest';
import {CARATS,GEM_SAMPLES,ORIGINAL_STYLING,PLATING,SURFACES,caratLabel,gemSample,type ReferenceStyling} from './styling';
import './reference-styling.css';

const families=[...new Set(GEM_SAMPLES.map(stone=>stone.family))];
type Props={section:'center'|'metal';value?:ReferenceStyling;disabled:boolean;onChange:(value:ReferenceStyling)=>void};
export function ReferenceStylingFields({section,value=ORIGINAL_STYLING,disabled,onChange}:Props){
  const update=(patch:Partial<ReferenceStyling>)=>onChange({...value,...patch});
  if(section==='metal')return <fieldset className="reference-styling" disabled={disabled}>
    <legend>电镀与表面</legend>
    <div className="stone-first-options" role="group" aria-label="电镀颜色">
      {(Object.keys(PLATING) as (keyof typeof PLATING)[]).map(plating=><button key={plating} type="button" aria-pressed={value.plating===plating} onClick={()=>update({plating})}>
        <i aria-hidden="true" className={'metal-sample metal-sample-'+plating}/>{PLATING[plating]}</button>)}
    </div>
    <div className="stone-first-options" role="group" aria-label="表面处理">
      {(Object.keys(SURFACES) as (keyof typeof SURFACES)[]).map(surface=><button key={surface} type="button" aria-pressed={value.surface===surface} onClick={()=>update({surface})}>{SURFACES[surface]}</button>)}
    </div>
  </fieldset>;
  const sample=gemSample(value.gem);
  const variants=GEM_SAMPLES.filter(stone=>stone.family===sample.family);
  const cutIndex=ATELIER_GEMS.findIndex(shape=>shape.id===value.cut);
  return <fieldset className="reference-styling" disabled={disabled}>
    <legend>主石设计</legend>
    <div className="stone-select-row">
      <label>宝石类别<select value={sample.family} onChange={event=>{
        const first=GEM_SAMPLES.find(stone=>stone.family===event.target.value);
        if(first)update({gem:first.id});
      }}>{families.map(family=><option key={family}>{family}</option>)}</select></label>
      <label>主石切形<select value={value.cut} onChange={event=>update({cut:event.target.value as ReferenceStyling['cut']})}>
        <option value="original">原款切形</option>{ATELIER_GEMS.map(shape=><option key={shape.id} value={shape.id}>{shape.name}</option>)}
      </select></label>
      {cutIndex>=0&&<span className="reference-cut-sample" aria-hidden="true" style={{backgroundPositionX:100*cutIndex/(ATELIER_GEMS.length-1)+'%'}}/>}
    </div>
    {variants.length>1&&<div className="stone-first-options" role="group" aria-label="宝石颜色">
      {variants.map(stone=><button type="button" key={stone.id} aria-pressed={value.gem===stone.id} onClick={()=>update({gem:stone.id})}>
        <i aria-hidden="true" className="gem-sample" style={{backgroundColor:stone.swatch}}/>{stone.name}</button>)}
    </div>}
    {value.gem==='natural'&&<p>当前使用无色样石示意，品种和颜色待选实石。</p>}
    <div className="reference-carat"><span>目标克拉</span><div className="stone-first-options" role="group" aria-label="主石克拉">
      {(['original',...CARATS] as const).map(carat=><button type="button" key={carat} aria-pressed={value.carat===carat} onClick={()=>update({carat})}>{caratLabel(carat)}</button>)}
    </div></div>
    {value.carat!=='original'&&<p>以原款宽度作为 1 ct 的显示基准，3+ ct 按 3 ct 示意。实石重量、尺寸与爪位需复核。</p>}
  </fieldset>;
}
