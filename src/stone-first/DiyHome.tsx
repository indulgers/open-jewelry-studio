import {purchaseOriginal,purchasePublished} from './purchase';
import {templateQuote} from './pricing';
import {useEffect,useState,type ReactNode} from 'react';
import {formatYuan} from './ring02/demoOrder';
import {RING_CATALOG} from './catalog';
import {loadReferenceRing} from './reference/entry';
import {fetchManaged,productRoute,featuredProducts,orderedProducts,type PublishedTemplate} from './reference/managed-types';
import './diy-home.css';

type StorefrontProduct=PublishedTemplate&{demo?:typeof RING_CATALOG[number]};
const localDemoProducts:StorefrontProduct[]=RING_CATALOG.filter(ring=>ring.listed).map((ring,order)=>({
    id:ring.id,catalogId:ring.id,revision:ring.revision,name:ring.name,
    image:ring.image,campaign:ring.campaign,collection:ring.collection,description:ring.description,
    url:ring.editor,headName:ring.headLabel??ring.name,bandName:ring.bandLabel??ring.name,order,featured:order<5,pricing:{base:ring.price.base,head:0,band:0,pave:0},
    demo:ring,
  }));

function warmEditor(product:PublishedTemplate){const source=RING_CATALOG.find(item=>item.id===product.catalogId);if(source)void loadReferenceRing(source).catch(()=>{});}
const Arrow=()=> <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>;

function FeaturedImage({product, purchaseAction}:{
  product:PublishedTemplate;
  purchaseAction:ReactNode;
}){
  const [view,setView]=useState<'wearing'|'original'>('wearing');
  const wearing=view==='wearing' && Boolean(product.campaign);
  return <figure className="diy-hero-art">
    <div className="hero-photo" data-view={wearing?'wearing':'original'}>
      <img src={wearing?product.campaign:product.image}
        alt={product.name+(wearing?' AI 佩戴示意':'原款图')}
        width={1122} height={1402} fetchPriority="high"/>
      {product.campaign&&<div className="hero-photo-switch" role="group" aria-label="图片视图">
        <button aria-pressed={wearing} onClick={()=>setView('wearing')}>佩戴图</button>
        <button aria-pressed={!wearing} onClick={()=>setView('original')}>原款图</button>
      </div>}
    </div>
    <figcaption className="diy-hero-tag">
      <div className="hero-product-info"><strong>{product.name}</strong>
        <span>{wearing?'AI 佩戴示意，细节以三维模型为准':'原款参考图'}</span></div>
      <div className="hero-tag-price"><strong>{product.pricing?formatYuan(templateQuote(product.pricing,product.revision).amount):'待报价'}</strong>
        {product.pricing&&<small>演示参考价</small>}</div>
      {purchaseAction}
    </figcaption>
  </figure>;
}

type CatalogState = {status:'loading'|'error'} | {status:'ready'; products:StorefrontProduct[]};
type PurchaseAction = {id:string; position:'feature'|'card'; error?:string};

export function DiyHome({section}:{section?:'collection'|'story'}){
  const [action,setAction]=useState<PurchaseAction>();
  const [catalog,setCatalog]=useState<CatalogState>({status:'loading'});
  const [attempt,setAttempt]=useState(0);
  const all=section==='collection';

  useEffect(()=>{
    const controller=new AbortController();
    setCatalog({status:'loading'});
    setAction(current=>current?.error?undefined:current);
    fetchManaged<PublishedTemplate[]>('index.json',controller.signal)
      .then(items=>{
        if(controller.signal.aborted)return;
        const useLocalDemo=!items.length&&import.meta.env.DEV&&!import.meta.env.VITE_CLOUD_MODE;
        setCatalog({status:'ready',products:orderedProducts(useLocalDemo?localDemoProducts:items)});
      })
      .catch(()=>{if(!controller.signal.aborted)setCatalog({status:'error'});});
    return ()=>controller.abort();
  },[attempt,section]);

  async function purchase(product:StorefrontProduct,position:PurchaseAction['position']){
    const startedAt=window.location.hash;
    const pending={id:product.id,position};
    setAction(pending);
    try{
      if(product.demo)purchaseOriginal(product.demo);
      else await purchasePublished(product);
      if(window.location.hash===startedAt)window.location.hash='#/diy/cart';
      setAction(undefined);
    }
    catch(error){
      const message=error instanceof Error&&error.message?error.message:'购物车暂时无法保存，请重试。';
      setAction(window.location.hash===startedAt?{...pending,error:message}:undefined);
    }
  }

  function purchaseAction(product:StorefrontProduct,position:PurchaseAction['position']){
    if(!product.pricing)return null;
    const active=action?.id===product.id&&action.position===position;
    const busy=Boolean(action&&!action.error);
    let label='加入演示购物车';
    if(active)label=busy?'正在加入…':'重试加入';
    return <>
      <button className={position==='card'?'shop-button shop-button-outline':undefined} disabled={busy} aria-label={label+' · '+product.name}
        onClick={()=>purchase(product,position)}>{label}</button>
      {active&&action?.error&&<div className="shop-purchase-error" role="alert">{action.error}
        <button className="shop-text-link" onClick={()=>setAttempt(value=>value+1)}>更新款式和价格</button>
      </div>}
    </>;
  }

  const published=catalog.status==='ready'?catalog.products:[];
  const homeSelection=featuredProducts(published);
  const wearingProducts=homeSelection.filter(product=>product.campaign);
  const featured=homeSelection.find(product=>product.campaign)??homeSelection[0]??published[0];
  const products=all?published:homeSelection;
  useEffect(()=>{
    if(section!=='story')return;
    const frame=requestAnimationFrame(()=>document.getElementById('diy-'+section)?.scrollIntoView({block:'start',behavior:'instant'}));
    return ()=>cancelAnimationFrame(frame);
  },[section,featured?.id]);
  const CollectionHeading=all||!featured?'h1':'h2';
  return <main className="diy-home">
    {!all&&featured&&<>
    <section className="diy-hero" aria-labelledby="diy-title">
      <div className="shop-wrap diy-hero-grid">
        <div className="diy-hero-content">
          {featured.collection&&<p className="collection-label">{featured.collection}</p>}
          <h1 id="diy-title">让心意，<br/>有自己的形状。</h1>
          <p className="diy-hero-sub">从一枚喜欢的戒指开始。在三维工作台里试搭戒头与戒圈，查看每一处镶嵌细节。</p>
          <div className="diy-hero-ctas">
            <a className="shop-button" href={productRoute(featured)} onMouseEnter={()=>warmEditor(featured)} onFocus={()=>warmEditor(featured)}>开始专属定制 <Arrow/></a>
            <a className="shop-text-link" href="#/diy/collection">浏览原款</a>
          </div>
        </div>
        <FeaturedImage key={featured.id} product={featured} purchaseAction={purchaseAction(featured,'feature')}/>
      </div>
    </section>
    {wearingProducts.length>0&&<section className="diy-wearing shop-wrap" aria-labelledby="wearing-title">
      <div className="shop-section-heading"><div><h2 id="wearing-title">佩戴图集</h2><p>从上手比例挑选轮廓，再进入三维工作台查看款式。</p></div><a className="shop-text-link" href="#/diy/collection">查看全部款式 <Arrow/></a></div>
      <div className="diy-wearing-grid" data-count={wearingProducts.length}>{wearingProducts.map(template=><a key={template.id} className="diy-wearing-item" href={productRoute(template)} onMouseEnter={()=>warmEditor(template)} onFocus={()=>warmEditor(template)}>
        <img src={template.campaign??template.image} alt={template.name+(template.campaign?' AI 佩戴示意':'款式参考图')} width={1122} height={1402} loading="lazy"/>
        <div><h3>{template.name}</h3><span>定制这一款 <Arrow/></span></div>
      </a>)}</div><p className="diy-wearing-note">佩戴图为 AI 示意，款式结构以三维模型为准。</p>
    </section>}
    </>}
    <section className="diy-collection shop-wrap" id="diy-collection" aria-labelledby="collection-title">
      <div className="shop-section-heading"><div><CollectionHeading id="collection-title">{all?'全部款式':'精选原款'}</CollectionHeading>
        {products.length>0&&<p>查看原款结构与演示参考价，或选一款开始定制。</p>}</div>
        {products.length>0&&(all?<span className="collection-count">{products.length} 款戒指</span>:<a className="shop-text-link" href="#/diy/collection">查看全部款式 <Arrow/></a>)}
      </div>
      {catalog.status==='loading'&&<p className="shop-catalog-state" role="status">正在读取款式…</p>}
      {catalog.status==='error'&&<div className="shop-catalog-state">
        <p role="alert">款式目录暂时无法读取。</p>
        <button className="shop-button shop-button-outline" onClick={()=>setAttempt(value=>value+1)}>重新读取款式</button>
      </div>}
      {catalog.status==='ready'&&!products.length&&<div className="shop-catalog-state">
        <p>{published.length?'首页精选正在准备中。':'暂时没有上架款式。'}</p>
        {published.length?<a className="shop-text-link" href="#/diy/collection">浏览全部 {published.length} 款戒指 <Arrow/></a>
          :<a className="shop-text-link" href="#/diy/fit">查看佩戴尺寸指南 <Arrow/></a>}
      </div>}
      {products.length>0&&<div className="diy-template-grid" data-count={products.length}>
        {products.map(template=><article key={template.id} className="diy-template" aria-labelledby={'card-title-'+template.id}>
          <a href={productRoute(template)} className="diy-template-image" onMouseEnter={()=>warmEditor(template)} onFocus={()=>warmEditor(template)} aria-label={'定制'+template.name}>
            <img src={template.image} alt={template.name+'三维模型原款图'} width={822} height={598} loading="lazy"/>
          </a>
          <div className="diy-template-details">
            <span className="collection-label">{template.collection??'相言定制'}</span>
            <h3 id={'card-title-'+template.id}>{template.name}</h3>
            <p className="template-description">{template.description}</p>
            <p className="diy-reference-price"><strong>{template.pricing?formatYuan(templateQuote(template.pricing,template.revision).amount):'待报价'}</strong>{template.pricing&&<span>演示参考价</span>}</p>
            <div className="product-actions"><a className="shop-button" aria-label={'开始定制 · '+template.name} href={productRoute(template)} onMouseEnter={()=>warmEditor(template)} onFocus={()=>warmEditor(template)}>开始定制 <Arrow/></a>{purchaseAction(template,'card')}</div>
          </div>
        </article>)}
      </div>}
    </section>
    {!all&&featured&&<section className="diy-editorial" aria-labelledby="editorial-title">
      <div className="shop-wrap diy-editorial-grid">
        <figure><img src={featured.image} alt={featured.name+'款式图'} width={822} height={598} loading="lazy"/><figcaption>原款三维模型</figcaption></figure>
        <div><h2 id="editorial-title">细节之间，<br/><em>都是你的选择。</em></h2><p>戒头勾勒第一眼的轮廓，戒圈承接日常的陪伴。换一种主石，调整围钻或戒臂的排列，在三维预览中看见你的每一次选择。</p>
          <ul><li><span>戒头</span>围钻、四爪与包镶造型</li><li><span>宝石</span>切形、大小与色彩搭配</li><li><span>戒圈</span>铺钻长度与心意刻字</li></ul>
          <a className="shop-button shop-button-light" href={productRoute(featured)} onMouseEnter={()=>warmEditor(featured)} onFocus={()=>warmEditor(featured)}>进入定制工作台 <Arrow/></a>
        </div>
      </div>
    </section>}
    {!all&&<section className="diy-story shop-wrap" id="diy-story" aria-labelledby="story-title">
      <div><span className="collection-label">关于相言</span><h2 id="story-title">有些话，<br/>留给一枚戒指来说。</h2></div>
      <div><p>相，是彼此看见；言，是心意的表达。我们希望一枚戒指，既有初见时的美，也能留下属于你的选择。</p><p>挑一枚原款，试试不同的戒头与戒圈。已标参考价的原款可加入演示购物车。需要工作室核价的搭配，可登录后把预览图和配置保存到「我的设计」。</p><a className="shop-text-link" href="#/diy/collection">探索款式系列 <Arrow/></a></div>
    </section>}
    <footer className="diy-footer shop-wrap"><div><b>相言</b><p>让心意，有自己的形状。</p></div><nav aria-label="页脚导航"><a href="#/diy/collection">款式系列</a><a href="#/diy/cart">购物车</a><a href="#/community">设计社区</a><a href="#/my-designs">我的设计</a><a href="#/showroom">珠宝展台</a></nav><small>目前提供定制预览与演示购物车，价格及交期以正式确认为准。</small></footer>
  </main>;
}
