import {useMemo,useState,type ChangeEvent} from 'react';
import {BoxGeometry,Group,Mesh,MeshStandardMaterial,SphereGeometry,Matrix4} from 'three';
import {OBJExporter} from 'three/addons/exporters/OBJExporter.js';
import {STLExporter} from 'three/addons/exporters/STLExporter.js';
import {STONE_APPEARANCES} from '../viewer/stoneAppearance';
import {STUDIO_PRESETS,type StudioPresetId} from '../viewer/studioPresets';
import {StoneFirstStage} from './StoneFirstStage';
import {createAssembly,metalSetting} from './geometry';
import {RECIPES,STRUCTURES,GRAMMARS,PARAMS,SETTINGS,MOUNTS,buildStoneLayout,checkDesign,constrainDesign,recipeDesign,summary,type Design,type RecipeId,type Check} from './recipe';
import './stone-first.css';

const STEPS=['戒指结构原型','造型语言','参数化组合','宝石镶嵌','设计与工艺校验'] as const;
type Key=keyof Design;
function download(name:string,content:BlobPart,kind:string){
 const blob=new Blob([content],{type:kind}),url=URL.createObjectURL(blob);
 const el=document.createElement('a');el.href=url;el.download=name;el.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportConcept(d:Design,format:'obj'|'stl'){
 const group=new Group(),assembly=createAssembly(d),sites=buildStoneLayout(d),metal=new MeshStandardMaterial({color:'#dddddd'});
 const gems=new MeshStandardMaterial({color:'#e9f3ff'});
 const meshes:Mesh[]=[];
 try{
  for(const part of assembly.parts){const m=new Mesh(part.geometry,metal);m.name=part.name;group.add(m);}
  for(const site of sites){
   const transforms=new Matrix4().makeTranslation(site.x,site.y,site.z).multiply(new Matrix4().makeRotationZ(-site.tilt));
   for(const part of metalSetting(d,site)){part.geometry.applyMatrix4(transforms);const m=new Mesh(part.geometry,metal);meshes.push(m);group.add(m);}
   // Export visualization proxy only. No boolean-cut gem seat and no CAD-certified gemstone mesh.
   const m=new Mesh(new SphereGeometry(site.diameter/2,12,8),gems);
   m.position.set(site.x,site.y,site.z);m.name=site.id+'-gem-proxy';meshes.push(m);group.add(m);
  }
  group.updateMatrixWorld(true);
  const data=format==='obj'?new OBJExporter().parse(group):new STLExporter().parse(group);
  download('ATELIER-concept.'+format,typeof data==='string'?data:new Uint8Array(data as ArrayBuffer),
   format==='obj'?'text/plain':'application/octet-stream');
 }finally{meshes.forEach(m=>m.geometry.dispose());assembly.dispose();metal.dispose();gems.dispose();}
}
function Status({checks}:{checks:Check[]}){
 return <div className="stone-checks">{checks.map((c,i)=><div key={i} className={'stone-check stone-check-'+c.severity}>
 <span className="stone-check-icon">{c.severity==='pass'?'✓':c.severity==='block'?'×':c.severity==='advice'?'!':'?'}</span>
 <div><strong>{c.title}</strong><small>{c.detail}</small></div></div>)}</div>;
}
export function StoneFirstStudio(){
 const [step,setStep]=useState(0),[design,setDesign]=useState<Design>(()=>recipeDesign('floral-pave'));
 const [quality,setQuality]=useState<'standard'|'high'>('standard');
 const [studio,setStudio]=useState<StudioPresetId>('catalog');
 const [message,setMessage]=useState('');
 const d=useMemo(()=>constrainDesign(design),[design]);
 const sites=useMemo(()=>buildStoneLayout(d),[d]),stats=useMemo(()=>summary(d,sites),[d,sites]);
 const checks=useMemo(()=>checkDesign(d,sites),[d,sites]);
 const update=<K extends Key>(key:K,value:Design[K])=>setDesign(prev=>({...prev,[key]:value}));
 const param=(key:keyof Design['parameters'],value:number)=>setDesign(prev=>({...prev,parameters:{...prev.parameters,[key]:value}}}));
 const selectRecipe=(id:RecipeId)=>{setDesign(recipeDesign(id));setMessage('已加载设计配方，五步均可继续修改。');};
 const importJson=async(e:ChangeEvent<HTMLInputElement>)=>{
  const file=e.target.files?.[0];if(!file)return;
  try{const parsed=JSON.parse(await file.text());
   if(!parsed||!RECIPES.some(r=>r.id===parsed.recipe)||!Array.isArray(Object.keys(parsed.parameters??{})))throw Error('格式不符合设计工程');
   setDesign(constrainDesign(parsed as Design));setMessage('工程已导入，请检查设置及工艺预检。');
  }catch{setMessage('导入失败：请选择由本工作台保存的 JSON 设计工程。');}
  e.target.value='';
 };
 const selected=RECIPES.find(v=>v.id===d.recipe);
 return <main className="stone-first-workspace">
  <div className="stone-first-header"><div><p className="stone-first-kicker">ATELIER / STONE FIRST</p><h1>镶嵌优先的珠宝 DIY</h1>
  <p>从完整镶嵌配方出发，让戒臂与装饰模组围绕宝石共同生成。</p></div>
  <div className="stone-first-top-actions">
    <button onClick={()=>{selectRecipe('floral-pave');setStep(0);}}>恢复默认</button>
    <button onClick={()=>download('ATELIER-design.json',JSON.stringify(d,null,2),'application/json')}>保存工程 JSON</button>
    <label className="stone-first-import">导入工程<input type="file" accept=".json,application/json" onChange={importJson}/></label>
  </div></div>
  <div className="stone-first-main">
   <section className="stone-first-preview">
    <div className="stone-first-preview-label"><div><span>LIVE PARAMETRIC ASSEMBLY</span><h2>{selected?.name}</h2></div>
     <span>{stats.total} STONES</span></div>
    <StoneFirstStage design={d} quality={quality} studio={studio}/>
    <div className="stone-first-preview-bottom">
      <div><strong>{stats.main}</strong><span>主石</span></div><div><strong>{stats.accent}</strong><span>配钻</span></div>
      <div><strong>{stats.minGapMm===null?'—':stats.minGapMm.toFixed(2)+' mm'}</strong><span>最小平面净距</span></div>
      <div><strong>{d.ringDiameter.toFixed(1)} mm</strong><span>戒圈内径（设计值）</span></div>
    </div>
    <div className="stone-first-lighting"><span>观察光线</span>{Object.values(STUDIO_PRESETS).map(p=><button key={p.id} aria-pressed={studio===p.id} onClick={()=>setStudio(p.id)}>{p.name}</button>)}
    <span>预览画质</span><button onClick={()=>setQuality(x=>x==='standard'?'high':'standard')}>{quality==='high'?'高质量':'标准'}</button></div>
    <div className="stone-first-warning">当前为真实参数联动的概念装配预览；可见镶口和爪，但尚无精确切孔、金属布尔融合或工厂验证。小钻实时预览使用实例化简化光学材质。</div>
   </section>
   <section className="stone-first-panel">
     <nav className="stone-first-steps" aria-label="五步设计流程">
      {STEPS.map((name,i)=><button key={name} aria-current={i===step?'step':undefined} onClick={()=>setStep(i)}><small>{String(i+1).padStart(2,'0')}</small><span>{name}</span></button>)}
     </nav>
     <div className="stone-first-fields">
       {step===0&&<>
        <h2>01 / 选戒指结构</h2><p>先决定镶座承力形式，再选金属与宝石占据的比例。全部五种结构均可预览。</p>
        <h3>选择专业配方</h3><div className="stone-first-recipe-grid">{RECIPES.map(r=><button key={r.id} aria-pressed={d.recipe===r.id} onClick={()=>selectRecipe(r.id)}><strong>{r.name}</strong><small>{r.description}</small></button>)}</div>
        <h3>戒指结构原型</h3><div className="stone-first-options">{STRUCTURES.map(([id,name])=><button key={id} aria-pressed={d.structure===id} onClick={()=>update('structure',id)}>{name}</button>)}</div>
        <label className="stone-first-range"><span>戒圈内径（参数标称）</span><output>{d.ringDiameter.toFixed(1)} mm</output><input type="range" min="15" max="23" step=".5" value={d.ringDiameter} onChange={e=>update('ringDiameter',Number(e.target.value))}/></label>
       </>}
       {step===1&&<>
        <h2>02 / 选造型语言</h2><p>花瓣、流线、几何重复、建筑结构使用不同的参数化金属生成方式；不是把一张图贴在戒圈上。</p>
        <div className="stone-first-grammar">{GRAMMARS.map(([id,name])=><button key={id} aria-pressed={d.grammar===id} onClick={()=>update('grammar',id)}><span>{name}</span><small>{id==='floral'?'立体叶片 / 中心镶座':id==='flow'?'连续曲线 / 结构桥接':id==='rhythm'?'周期阵列 / 结构节奏':'几何轨道 / 金属边界'}</small></button>)}</div>
       </>}
       {step===2&&<>
        <h2>03 / 参数化组合模组</h2><p>六项参数实际重建模组几何及相关石位。若布局容量不足，第四步会重新求解并给出风险提示。</p>
        {PARAMS.map(([key,name,min,max,increment])=><label className="stone-first-range" key={key}>
          <span>{name}</span><output>{key==='rotation'?d.parameters[key].toFixed(0)+'°':key==='repeat'?d.parameters[key]:d.parameters[key].toFixed(2)}</output>
          <input type="range" min={min} max={max} step={increment} value={d.parameters[key]} onChange={e=>param(key,Number(e.target.value))}/>
        </label>)}
       </>}
       {step===3&&<>
        <h2>04 / 宝石镶嵌策略</h2><p>先选构图，再生成可见的宝石、下托、镶爪与包边。系统按照真实直径和设计间隙重排，不按固定数量随意散点。</p>
        <h3>镶嵌构图</h3><div className="stone-first-options">{SETTINGS.map(([id,name])=><button key={id} aria-pressed={d.setting===id} onClick={()=>update('setting',id)}>{name}</button>)}</div>
        <h3>镶嵌工艺</h3><div className="stone-first-options">{MOUNTS.map(([id,name])=><button key={id} aria-pressed={d.mount===id} onClick={()=>update('mount',id)}>{name}</button>)}</div>
        <h3>宝石尺寸和密度</h3>
        {([['mainDiameter','主石直径',2,6,.1],['accentDiameter','配钻直径',.55,1.4,.05],['gapMm','目标腰棱净距',.1,.3,.01]] as const).map(([key,label,min,max,increment])=>
         <label className="stone-first-range" key={key}><span>{label}</span><output>{d[key].toFixed(2)} mm</output><input type="range" min={min} max={max} step={increment} value={d[key]} onChange={e=>update(key,Number(e.target.value))}/></label>)}
        <p className="stone-first-note">小钻的珠镶固定结构为可视化几何，当前没有生成真实金属切孔。所选镶法可能与某些构图不兼容，校验会提示。</p>
       </>}
       {step===4&&<>
        <h2>05 / 审美与工艺预检</h2><p>区分已计算的石位净距、构图建议与尚未执行的工业 CAD 检查，不以“无报错”冒充可生产。</p>
        <Status checks={checks}/>
        <h3>概念几何交付</h3>
        <div className="stone-first-options"><button onClick={()=>download('ATELIER-design.json',JSON.stringify(d,null,2),'application/json')}>保存可编辑工程</button>
          <button onClick={()=>exportConcept(d,'obj')}>导出 OBJ 概念装配</button><button onClick={()=>exportConcept(d,'stl')}>导出 STL 概念装配</button></div>
        <p className="stone-first-note">概念网格中的宝石为几何占位，不等于可铸造实体。正式生产需精确 CAD 镶口、厚度与切割公差验证。</p>
       </>}
     </div>
     <div className="stone-first-panel-bottom">
       <span role="status">{message||'所有步骤可直接跳转，任意参数都会作用于同一份设计。'}</span>
       <div><button disabled={step===0} onClick={()=>setStep(s=>s-1)}>上一步</button>
        <button onClick={()=>setStep(s=>Math.min(4,s+1))}>{step===4?'查看校验完成':'下一步'}</button></div>
     </div>
   </section>
  </div>
 </main>;
}
