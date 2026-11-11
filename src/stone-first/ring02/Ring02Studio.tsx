import {useEffect,useMemo,useRef,useState} from 'react';
import {Mesh} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {STONE_APPEARANCES,STONE_APPEARANCE_IDS} from '../../viewer/stoneAppearance';
import {Ring02Stage,VIEWS,type RingView} from './Ring02Stage';
import {
  BASE_DESIGN,ENGRAVING_LIMIT,REACHES,SIZES,TEMPLATE_REVISION,engravingProblem,findNewIntersection,
  fitStones,paveSpacing,prepareTemplate,type RingDesign,type StoneSpec,type Zone,
} from './model';
import {HEADS,type Head} from './head';
import {newDraft,readDraft,writeDraft,type Draft} from './draft';
import {addDemoOrder,estimateRing02,formatYuan,hasDemoOrder,priceNote,RING02_PRICE,type DemoOrder} from './demoOrder';
import {ReviewDialog} from './ReviewDialog';
import {RING02_TEMPLATE} from './assets';
import {Ring02Loading} from './Ring02Loading';
import '../stone-first.css';
import './ring02.css';

const LABELS:Record<Zone,string>={center:'主石',halo:'外围围钻',shoulder:'戒臂配钻'};
const DESCRIPTIONS:Record<Zone,string>={
  center:'改变主石切形或大小，当前镶座会跟随适配。',
  halo:'四段围钻按石径重新排列，四颗隔断装饰钻固定。',
  shoulder:'按石径和铺钻长度重新排钻，左右戒臂同步。',
};
type History={past:RingDesign[];current:Draft;future:RingDesign[]};
type PendingChange={title:string;description:string;design:RingDesign;clearEngraving?:boolean};
const HEAD_NAMES=Object.fromEntries(HEADS.map(([id,label])=>[id,label])) as Record<Head,string>;
const SIZE_LABELS=['略小','原款','略大'];
const REACH_LABELS=['稍短','原长度','稍长'];
const gapNumber=new Intl.NumberFormat('zh-CN',{maximumFractionDigits:3});

function describeGap(layout:ReturnType<typeof paveSpacing>){
  const {minGap,maxGap}=layout;
  if(minGap===null||maxGap===null)return '—';
  const low=gapNumber.format(minGap),high=gapNumber.format(maxGap);
  return (low===high?low:low+'–'+high)+' 模型单位';
}

function Editor({template}:{template:ReturnType<typeof prepareTemplate>}){
  const [initial]=useState(()=>{
    const saved=readDraft();
    const conflict=findNewIntersection(template,fitStones(template,saved.design));
    return {draft:conflict?newDraft(BASE_DESIGN):saved,conflict};
  });
  const [history,setHistory]=useState<History>({past:[],current:initial.draft,future:[]});
  const [part,setPart]=useState<'head'|'shank'>('head');
  const [headZone,setHeadZone]=useState<'center'|'halo'>('center');
  const [view,setView]=useState<RingView>('overall');
  const [viewReset,setViewReset]=useState(0);
  const [compare,setCompare]=useState(false);
  const [message,setMessage]=useState(initial.conflict?'旧草稿的宝石发生碰撞。当前展示原款，原草稿保留至下一次修改。':'');
  const [saveFailed,setSaveFailed]=useState(false);
  const [pending,setPending]=useState<PendingChange|null>(null);
  const [review,setReview]=useState<DemoOrder|null>(null);
  const captureThumbnail=useRef<(()=>string|undefined)|null>(null);
  const [cartNotice,setCartNotice]=useState('');
  const [orderError,setOrderError]=useState(false);
  const [engravingInput,setEngravingInput]=useState<string|null>(null);
  const [engravingError,setEngravingError]=useState('');
  const [composing,setComposing]=useState(false);
  const {current:draft,past,future}=history;
  const current=draft.design;
  const engraving=engravingInput??current.engraving;
  const engravingDirty=engraving!==current.engraving;
  const engravingPreview=engraving.trim();
  const engravingSample=engravingPreview&&!engravingProblem(engravingPreview)?engravingPreview:'刻字预览';
  const zone=part==='shank'?'shoulder':current.head==='halo'?headZone:'center';
  const visible=compare?BASE_DESIGN:current;
  const fitted=useMemo(()=>fitStones(template,current),[template,current]);
  const original=useMemo(()=>fitStones(template,BASE_DESIGN),[template]);
  const stones=compare?original:fitted;
  const quote=estimateRing02(current);
  const added=hasDemoOrder(draft.revision);
  const pave=useMemo(()=>({
    halo:paveSpacing(fitted,'halo'),shoulder:paveSpacing(fitted,'shoulder'),
  }),[fitted]);
  const previewLayout=zone==='center'?null:compare?paveSpacing(original,zone):pave[zone];
  const stoneDescription=(id:Zone)=>{
    const {cut,size,appearance}=current[id];
    return [cut==='round'?'圆形':'椭圆形',STONE_APPEARANCES[appearance].name,SIZE_LABELS[SIZES.indexOf(size)]].join(' · ');
  };
  const details=[
    {label:'戒头',value:HEAD_NAMES[current.head],field:'head'},
    {label:'主石',value:stoneDescription('center'),field:'center'},
    ...(current.head==='halo'?[{label:'外围围钻',value:stoneDescription('halo')+' · '+pave.halo.count+' 颗 + 4 颗固定装饰钻 · 间距 '+describeGap(pave.halo),field:'halo'}]:[]),
    {label:'戒臂配钻',value:stoneDescription('shoulder')+' · '+pave.shoulder.count+' 颗 · '+REACH_LABELS[REACHES.indexOf(current.reach)]+' · 间距 '+describeGap(pave.shoulder),field:'shoulder'},
    {label:'内圈刻字',value:current.engraving||'未添加',field:'engraving'},
  ];

  useEffect(()=>{
    if(initial.conflict&&draft.revision===initial.draft.revision)return;
    try{writeDraft(draft);setSaveFailed(false);}
    catch{setSaveFailed(true);}
  },[draft,initial]);

  function apply(next:RingDesign){
    if(JSON.stringify(next)===JSON.stringify(current))return;
    const nextStones=fitStones(template,next);
    const collision=findNewIntersection(template,nextStones);
    if(collision){
      const names=collision.split(' / ').map(name=>{
        const stone=nextStones.find(stone=>stone.name===name);
        return stone?LABELS[stone.zone]:name;
      });
      setMessage(names[0]===names[1]?names[0]+'内部发生碰撞。请选较小的规格或调整铺设范围。':names.join('和')+'发生碰撞。请选较小的规格。');
      return;
    }
    setMessage('');
    setCartNotice('');
    if(next.engraving!==current.engraving){
      setEngravingInput(null);
      setEngravingError('');
    }
    setHistory({past:[...past,current].slice(-10),current:newDraft(next),future:[]});
  }

  function update<K extends keyof StoneSpec>(key:K,value:StoneSpec[K]){
    apply({...current,[zone]:{...current[zone],[key]:value}});
  }

  function undo(){
    if(past.at(-1)?.engraving!==current.engraving){
      setEngravingInput(null);
      setEngravingError('');
    }
    setHistory({past:past.slice(0,-1),current:newDraft(past[past.length-1]),future:[current,...future]});
    setMessage('');
    setCartNotice('');
  }

  function redo(){
    if(future[0].engraving!==current.engraving){
      setEngravingInput(null);
      setEngravingError('');
    }
    setHistory({past:[...past,current],current:newDraft(future[0]),future:future.slice(1)});
    setMessage('');
    setCartNotice('');
  }

  function selectHead(head:Head){
    const design={...current,head};
    if(current.head==='halo'&&head!=='halo'){
      setPending({title:'改为'+HEAD_NAMES[head],description:'外围围钻和隔断装饰钻将从当前方案移除。原围钻选项会保留，切回原款围钻时恢复。',design});
      return;
    }
    apply(design);
  }

  function resetPart(){
    if(part==='head'){
      setPending({
        title:'重置戒头',description:'戒头造型、主石和围钻将恢复为原款。可以撤销这次修改。',
        design:{...current,head:BASE_DESIGN.head,center:BASE_DESIGN.center,halo:BASE_DESIGN.halo},
      });
    }else{
      setPending({
        title:'重置戒圈',clearEngraving:true,description:'戒臂配钻、铺钻长度和刻字将恢复为原款。可以撤销这次修改。',
        design:{...current,shoulder:BASE_DESIGN.shoulder,reach:BASE_DESIGN.reach,engraving:BASE_DESIGN.engraving},
      });
    }
  }

  function jumpTo(field:string){
    setPart(field==='shoulder'||field==='engraving'?'shank':'head');
    if(field==='center'||field==='halo')setHeadZone(field);
    requestAnimationFrame(()=>document.getElementById('ring02-field-'+field)?.focus());
  }

  function confirmEngraving(){
    const text=engraving.trim();
    const problem=engravingProblem(text);
    setEngravingError(problem);
    if(problem)return;
    apply({...current,engraving:text});
    setEngravingInput(null);
    document.getElementById('ring02-field-engraving')?.focus({preventScroll:true});
  }

  function openReview(){
    if(engravingDirty){
      setEngravingError('请先确认或取消刻字修改。');
      jumpTo('engraving');
      return;
    }
    setOrderError(false);
    setReview({
      templateRevision:TEMPLATE_REVISION,revision:draft.revision,design:current,quote,
      confirmedAt:'',
      pave:{units:'model',...(current.head==='halo'?{halo:pave.halo}:{}),shoulder:pave.shoulder},
      details:[...details.map(({label,value})=>({label,value})),{label:'金属外观',value:'银色'},{label:'实物圈号',value:'待工艺确认'}],
      stones:fitted.map(stone=>({
        id:stone.name,zone:stone.zone,appearance:stone.appearance,placement:stone.matrix.toArray(),
      })),
    });
  }

  function confirmOrder(){
    if(!review||review.revision!==draft.revision||compare)return;
    let thumbnail:string|undefined;
    try{thumbnail=captureThumbnail.current?.();}
    catch{thumbnail=undefined;}
    try{
      const created=addDemoOrder({...review,thumbnail,confirmedAt:new Date().toISOString()});
      setReview(null);
      setCartNotice(created?'已加入演示购物车。':'此方案已在演示购物车。');
    }catch{setOrderError(true);}
  }

  const spec=current[zone];
  const headName=HEAD_NAMES[visible.head];
  return <><div className="stone-first-main ring02-main">
    <section className="stone-first-preview" aria-label="戒指预览">
      <div className="ring02-preview-bar">
        <div><strong>{compare?'原款':headName}</strong><span>{stones.length} 颗宝石</span></div>
        <button aria-pressed={compare} onClick={()=>setCompare(!compare)}>对比原款</button>
      </div>
      <Ring02Stage template={template} design={visible} stones={stones} view={view} reset={viewReset} captureRef={captureThumbnail}/>
      <div className="stone-first-camera-views" role="group" aria-label="戒指观察视角">
        {VIEWS.map(([id,name])=><button key={id} aria-pressed={view===id} onClick={()=>{setView(id);setViewReset(token=>token+1);}}>{name}</button>)}
      </div>
    </section>
    <section className="stone-first-panel" aria-label="戒指配置">
      <header className="ring02-product">
        <h1>{RING02_TEMPLATE.name}</h1>
        <p>银色金属外观</p>
      </header>
      <div className="ring02-zones" role="group" aria-label="选择戒指部件">
        <button aria-pressed={part==='head'} onClick={()=>setPart('head')}><span aria-hidden="true">01</span> 戒头</button>
        <button aria-pressed={part==='shank'} onClick={()=>setPart('shank')}><span aria-hidden="true">02</span> 戒圈</button>
      </div>
      <div className="stone-first-fields ring02-fields">
        {part==='head'&&<>
          <fieldset disabled={compare} id="ring02-field-head" tabIndex={-1}>
            <legend>戒头造型</legend>
            <div className="ring02-heads">
              {HEADS.map(([id,label])=><button key={id} aria-pressed={current.head===id} onClick={()=>selectHead(id)}>
                <HeadIcon head={id}/><strong>{label}</strong>{RING02_PRICE.head[id]!==0&&<small>{priceNote(RING02_PRICE.head[id]).trim()}</small>}
              </button>)}
            </div>
          </fieldset>
          <div className="ring02-head-zones stone-first-options" role="group" aria-label="戒头镶嵌区域">
            <button aria-pressed={zone==='center'} onClick={()=>setHeadZone('center')}>主石</button>
            {current.head==='halo'&&<button aria-pressed={zone==='halo'} onClick={()=>setHeadZone('halo')}>外围围钻</button>}
          </div>
        </>}
        <h2 className={part==='head'?'sr-only':undefined} id={'ring02-field-'+zone} tabIndex={-1}>{LABELS[zone]}</h2>
        <p className="ring02-zone-description">{DESCRIPTIONS[zone]}</p>
        <fieldset disabled={compare}>
          <legend>切形</legend>
          <div className="stone-first-options">
            {([['round','圆形'],['oval','椭圆形']] as const).map(([id,name])=>
              <button key={id} aria-pressed={spec.cut===id} onClick={()=>update('cut',id)}>{name}</button>)}
          </div>
        </fieldset>
        <fieldset disabled={compare}>
          <legend>{zone==='center'?'尺寸':'配钻石径'}</legend>
          <div className="stone-first-options">{SIZES.map((size,i)=>
            <button key={size} aria-pressed={spec.size===size} onClick={()=>update('size',size)}>{SIZE_LABELS[i]}{size>1?priceNote(zone==='center'?RING02_PRICE.centerLarge:RING02_PRICE.accentLarge):''}</button>)}</div>
        </fieldset>
        <fieldset disabled={compare}>
          <legend>宝石</legend>
          <div className="stone-first-options ring02-gems">{STONE_APPEARANCE_IDS.map(id=>
            <button key={id} aria-pressed={spec.appearance===id} onClick={()=>update('appearance',id)}><i className={'ring02-swatch swatch-'+id} aria-hidden="true"/>
              {STONE_APPEARANCES[id].name}{zone!=='center'&&id!=='diamond'?priceNote(RING02_PRICE.coloredAccent):''}</button>)}</div>
        </fieldset>
        {zone==='shoulder'&&<fieldset disabled={compare}>
          <legend>铺钻长度</legend>
          <div className="stone-first-options">{REACHES.map((reach,i)=>
            <button key={reach} aria-pressed={current.reach===reach} onClick={()=>apply({...current,reach})}>{REACH_LABELS[i]}{reach>1?priceNote(RING02_PRICE.longShoulder):''}</button>)}</div>
        </fieldset>}
        <div className="ring02-layout-note" role={previewLayout?'status':undefined} aria-label={previewLayout?(compare?'原款排钻结果':'排钻结果'):undefined}>
          {previewLayout?<dl>
            <div><dt>配钻数量</dt><dd>{zone==='halo'?previewLayout.count+' 颗 + 4 颗固定装饰钻':previewLayout.count+' 颗（左右各 '+previewLayout.count/2+' 颗）'}</dd></div>
            <div><dt>相邻石边间距</dt><dd>{describeGap(previewLayout)}</dd></div>
          </dl>:<p>尺寸以原款为参照。</p>}
        </div>
        {part==='shank'&&<fieldset disabled={compare} className="ring02-engraving">
          <legend>内圈刻字 <span>选填</span></legend>
          <label htmlFor="ring02-field-engraving" className="sr-only">刻字文字</label>
          <input id="ring02-field-engraving" type="text" value={engraving} autoComplete="off" spellCheck={false}
            placeholder="例如  A & B"
            aria-describedby={engravingError?'ring02-engraving-help ring02-engraving-error':'ring02-engraving-help'}
            onChange={event=>{setEngravingInput(event.target.value);setEngravingError('');}}
            onCompositionStart={()=>setComposing(true)} onCompositionEnd={()=>setComposing(false)}/>
          <p id="ring02-engraving-help">单行，最多 {ENGRAVING_LIMIT} 个字符。支持英文字母、数字、空格和 . &amp; -</p>
          <figure className="ring02-engraving-sample">
            <blockquote>{engravingSample}</blockquote><figcaption>内圈位置示意 · 字体与工艺待确认</figcaption>
          </figure>
          <p id="ring02-engraving-error" role="alert">{engravingError}</p>
          <div className="ring02-engraving-actions">
            <button type="button" disabled={!engravingDirty} onClick={()=>{setEngravingInput(null);setEngravingError('');}}>取消修改</button>
            <button type="button" disabled={!engravingDirty||composing} onClick={confirmEngraving}>确认刻字</button>
          </div>
        </fieldset>}
      </div>
      <details className="ring02-summary">
        <summary>配置摘要</summary>
        <ul>{details.map(detail=><li key={detail.field}>
          <button disabled={compare} onClick={()=>jumpTo(detail.field)}><strong>{detail.label}</strong><span>{detail.value}</span></button>
        </li>)}</ul>
      </details>
      <div className="ring02-actions">
        <button disabled={!past.length||compare} onClick={undo}>撤销</button>
        <button disabled={!future.length||compare} onClick={redo}>重做</button>
        <button disabled={compare} onClick={resetPart}>{part==='head'?'重置戒头':'重置戒圈'}</button>
        <button disabled={compare} onClick={()=>setPending({
          title:'恢复整枚',clearEngraving:true,description:'戒头、主配石、铺钻长度和刻字将恢复为原款。可以撤销这次修改。',design:BASE_DESIGN,
        })}>恢复原款</button>
      </div>
      <p className="ring02-status ring02-editor-feedback" role="status">{message||(compare?'正在对比原款。再次点击可继续编辑和核对。':'')}</p>
      {saveFailed&&<p className="ring02-status" role="alert">浏览器未能保存草稿。请保留此页面以继续当前修改。</p>}
      {!saveFailed&&(!initial.conflict||draft.revision!==initial.draft.revision)&&<p className="ring02-status">{engravingDirty?'已确认的配置保留在本机':'草稿已保留在本机'}</p>}
    </section>
  </div>
  <section className="ring02-purchase" aria-label="估价与演示加购">
    <div>
      <p>参考估价 <strong>{formatYuan(quote.amount)}</strong></p>
      <small>示例交期 {quote.leadTime} · 待工艺确认</small>
    </div>
    {added&&!engravingDirty?<a className="shop-button" href="#/diy/cart">查看演示购物车</a>:
      !RING02_TEMPLATE.listed?<span>该款式已停售</span>:
      part==='head'?<button className="shop-button" onClick={()=>jumpTo('shoulder')}>下一步 · 配置戒圈</button>:
      <button className="shop-button" disabled={compare} onClick={openReview}>查看方案</button>}
    <p className="ring02-cart-notice" role="status">{cartNotice}</p>
  </section>
  {pending&&<ReviewDialog title={pending.title} onClose={()=>setPending(null)}>
    <p>{pending.description}</p>
    <div className="ring02-dialog-actions">
      <button autoFocus onClick={()=>setPending(null)}>保留原方案</button>
      <button className="shop-button" onClick={()=>{apply(pending.design);if(pending.clearEngraving){setEngravingInput(null);setEngravingError('');}setPending(null);}}>确认更改</button>
    </div>
  </ReviewDialog>}
  {review&&<ReviewDialog title="核对当前方案" onClose={()=>setReview(null)}>
    <dl>{review.details.map(detail=><div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>
    <p><strong>{formatYuan(review.quote.amount)}</strong> · 示例交期 {review.quote.leadTime}</p>
    <p>金额与交期为示例。实物尺寸与工艺确认后才能购买。</p>
    {orderError&&<p role="alert">浏览器未能保存演示购物车，请重试。</p>}
    <div className="ring02-dialog-actions">
      <button autoFocus onClick={()=>setReview(null)}>返回修改</button>
      <button className="shop-button" onClick={confirmOrder}>确认并加入演示购物车</button>
    </div>
  </ReviewDialog>}
  </>;
}

function HeadIcon({head}:{head:Head}){
  return <svg viewBox="0 0 44 44" width="40" height="40" fill="none" stroke="currentColor" aria-hidden="true">
    <circle cx="22" cy="22" r="10"/>
    <path d="m22 12 10 10-10 10-10-10 10-10Z" opacity=".55"/>
    {head==='halo'&&<><circle cx="22" cy="22" r="16"/><path d="m10 10 4 4m16 16 4 4m0-24-4 4M14 30l-4 4"/></>}
    {head==='four-prong'&&[[14,14],[30,14],[14,30],[30,30]].map(([x,y])=><circle key={x+'-'+y} cx={x} cy={y} r="2.2" fill="currentColor"/>)}
    {head==='bezel'&&<circle cx="22" cy="22" r="13" strokeWidth="2.7"/>}
  </svg>;
}

function disposeTemplate(template:ReturnType<typeof prepareTemplate>){
  template.metal.forEach(part=>part.geometry.dispose());
  template.stones.forEach(stone=>stone.geometry.dispose());
  template.oval.dispose();
}

export function Ring02Studio(){
  const [template,setTemplate]=useState<ReturnType<typeof prepareTemplate>>();
  const [error,setError]=useState(false);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    let owned:ReturnType<typeof prepareTemplate>|undefined;
    const fetchAsset=async(url:string)=>{
      const response=await fetch(url,{signal:controller.signal});
      if(!response.ok)throw new Error('找不到戒指模板资源');
      return response;
    };
    const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const source=fetchAsset(RING02_TEMPLATE.model).then(response=>response.arrayBuffer());
    const oval=fetchAsset(RING02_TEMPLATE.oval).then(response=>response.arrayBuffer());
    Promise.all([source,oval]).then(async([modelBytes,ovalBytes])=>{
      if(controller.signal.aborted)return;
      const {scene}=await loader.parseAsync(ovalBytes,'');
      try{
        if(controller.signal.aborted)return;
        const model=await loader.parseAsync(modelBytes,'');
        owned=prepareTemplate(model.scene,scene);
        if(controller.signal.aborted){
          disposeTemplate(owned);
          owned=undefined;
        }else{
          setTemplate(owned);
        }
      }finally{
        scene.traverse(object=>{
          if(!(object instanceof Mesh))return;
          object.geometry.dispose();
          const materials=Array.isArray(object.material)?object.material:[object.material];
          materials.forEach(material=>material.dispose());
        });
      }
    }).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return ()=>{
      controller.abort();
      if(owned)disposeTemplate(owned);
    };
  },[attempt]);
  return <main className="stone-first-workspace ring02-workspace">
    <nav className="ring02-breadcrumb" aria-label="所在页面">
      <a href="#/diy">全部款式</a><span aria-hidden="true">/</span><span aria-current="page">{RING02_TEMPLATE.name}</span>
    </nav>
    {template?<Editor template={template}/>:<Ring02Loading retry={error?()=>{setError(false);setAttempt(count=>count+1);}:undefined}/>}
  </main>;
}
