import {purchasePublished} from './purchase';
import {templateQuote} from './pricing';
import {useEffect,useState} from 'react';
import {formatYuan} from './ring02/demoOrder';
import {RING_CATALOG} from './catalog';
import {loadReferenceRing} from './reference/entry';
import {fetchManaged,productRoute,featuredProducts,orderedProducts,type PublishedTemplate} from './reference/managed-types';
import './diy-home.css';

function warmEditor(product:PublishedTemplate){const source=RING_CATALOG.find(item=>item.id===product.catalogId);if(source)void loadReferenceRing(source).catch(()=>{});}
const Arrow=()=> <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>;

function FeaturedImage({product, purchasing, onPurchase}:{
  product:PublishedTemplate;
  purchasing:string;
  onPurchase:(product:PublishedTemplate)=>void;
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
      <button disabled={Boolean(purchasing)||!product.pricing} onClick={()=>onPurchase(product)}>
        {purchasing===product.id?'正在加入…':'直接选购'}
      </button>
    </figcaption>
  </figure>;
}

export function DiyHome({section}:{section?:'collection'|'story'}){
  const [error,setError]=useState('');
  const [purchasing,setPurchasing]=useState('');
  async function purchase(product:PublishedTemplate){
    setPurchasing(product.id);setError('');
    try{await purchasePublished(product);window.location.hash='#/diy/cart';}
    catch(error){setError(error instanceof Error?error.message:'购物车暂时无法保存，请重试。');}
    finally{setPurchasing('');}
  }
  const all=section==='collection';
  const [published,setPublished]=useState<PublishedTemplate[]>();
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    fetchManaged<PublishedTemplate[]>('index.json',controller.signal)
      .then(items=>{setPublished(orderedProducts(items));setError('');}).catch(()=>{if(!controller.signal.aborted)setError('商品暂时无法读取，请重试。');});
    return ()=>controller.abort();
  },[attempt,section]);
  const homeSelection=featuredProducts(published??[]);
  const wearingProducts=homeSelection.filter(product=>product.campaign);
  const featured=homeSelection.find(product=>product.campaign)??homeSelection[0]??published?.[0];
  const products=all?(published??[]):homeSelection;
  useEffect(()=>{
    if(section!=='story')return;
    const frame=requestAnimationFrame(()=>document.getElementById('diy-'+section)?.scrollIntoView({block:'start',behavior:'instant'}));
    return ()=>cancelAnimationFrame(frame);
  },[section,featured?.id]);
  const purchaseError=error&&<div className="shop-wrap shop-error" role="alert">{error}<button onClick={()=>setAttempt(value=>value+1)}>重试</button></div>;
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
            <a className="shop-text-link" href="#/diy/collection">选购原款</a>
          </div>
        </div>
        <FeaturedImage key={featured.id} product={featured} purchasing={purchasing} onPurchase={purchase}/>
      </div>
    </section>
    {purchaseError}
    {wearingProducts.length>0&&<section className="diy-wearing shop-wrap" aria-labelledby="wearing-title">
      <div className="shop-section-heading"><div><h2 id="wearing-title">佩戴图集</h2><p>从上手比例挑选轮廓，再进入三维工作台查看款式。</p></div><a className="shop-text-link" href="#/diy/collection">查看全部款式 <Arrow/></a></div>
      <div className="diy-wearing-grid" data-count={wearingProducts.length}>{wearingProducts.map(template=><a key={template.id} className="diy-wearing-item" href={productRoute(template)} onMouseEnter={()=>warmEditor(template)} onFocus={()=>warmEditor(template)}>
        <img src={template.campaign??template.image} alt={template.name+(template.campaign?' AI 佩戴示意':'款式参考图')} width={1122} height={1402} loading="lazy"/>
        <div><h3>{template.name}</h3><span>定制这一款 <Arrow/></span></div>
      </a>)}</div><p className="diy-wearing-note">佩戴图为 AI 示意，款式结构以三维模型为准。</p>
    </section>}
    </>}
    {(all||!featured)&&purchaseError}
    {!published&&!error&&<p className="shop-wrap" role="status">正在读取商品…</p>}
    {published&&!products.length&&<p className="shop-wrap">{all?'暂时没有上架商品。':'首页精选正在准备中。'}</p>}
    <section className="diy-collection shop-wrap" id="diy-collection" aria-labelledby="collection-title">
      <div className="shop-section-heading"><div><h2 id="collection-title">{all?'全部款式':'精选原款'}</h2><p>查看原款结构与演示参考价，或选一款开始定制。</p></div>{all?<span className="collection-count">{products.length} 款戒指 · 银色系列</span>:<a className="shop-text-link" href="#/diy/collection">查看全部款式 <Arrow/></a>}</div>
      <div className="diy-template-grid" data-count={products.length}>
        {products.map(template=><article key={template.id} className="diy-template">
          <a href={productRoute(template)} className="diy-template-image" onMouseEnter={()=>warmEditor(template)} onFocus={()=>warmEditor(template)} aria-label={'定制'+template.name}>
            <img src={template.image} alt={template.name+'三维模型原款图'} width={822} height={598} loading="lazy"/>
          </a>
          <div className="diy-template-details">
            <span className="collection-label">{template.collection??'相言定制'}</span>
            <h3>{template.name}</h3>
            <p className="template-description">{template.description}</p>
            <p className="diy-reference-price"><strong>{template.pricing?formatYuan(templateQuote(template.pricing,template.revision).amount):'待报价'}</strong><span>演示参考价</span></p>
            <div className="product-actions"><a className="shop-button" href={productRoute(template)} onMouseEnter={()=>warmEditor(template)} onFocus={()=>warmEditor(template)}>开始定制 <Arrow/></a><button className="shop-button shop-button-outline" disabled={!!purchasing||!template.pricing} onClick={()=>purchase(template)}>{purchasing===template.id?'正在加入…':'选购原款'}</button></div>
          </div>
        </article>)}

      </div>
    </section>
    {!all&&featured&&<>
    <section className="diy-editorial" aria-labelledby="editorial-title">
      <div className="shop-wrap diy-editorial-grid">
        <figure><img src={featured.image} alt={featured.name+'款式图'} width={822} height={598} loading="lazy"/><figcaption>原款三维模型</figcaption></figure>
        <div><h2 id="editorial-title">细节之间，<br/><em>都是你的选择。</em></h2><p>戒头勾勒第一眼的轮廓，戒圈承接日常的陪伴。换一种主石，调整围钻或戒臂的排列，在三维预览中看见你的每一次选择。</p>
          <ul><li><span>戒头</span>围钻、四爪与包镶造型</li><li><span>宝石</span>切形、大小与色彩搭配</li><li><span>戒圈</span>铺钻长度与心意刻字</li></ul>
          <a className="shop-button shop-button-light" href={productRoute(featured)} onMouseEnter={()=>warmEditor(featured)} onFocus={()=>warmEditor(featured)}>进入定制工作台 <Arrow/></a>
        </div>
      </div>
    </section>
    <section className="diy-story shop-wrap" id="diy-story" aria-labelledby="story-title">
      <div><span className="collection-label">关于相言</span><h2 id="story-title">有些话，<br/>留给一枚戒指来说。</h2></div>
      <div><p>相，是彼此看见；言，是心意的表达。我们希望一枚戒指，既有初见时的美，也能留下属于你的选择。</p><p>从这里的参考款式出发，可以直接选购原款，也可以进入定制页慢慢调整。每一份搭配，都能以图片和配置保留在购物车中。</p><a className="shop-text-link" href="#/diy/collection">探索款式系列 <Arrow/></a></div>
    </section>
    </>}
    <footer className="diy-footer shop-wrap"><div><b>相言</b><p>让心意，有自己的形状。</p></div><nav aria-label="页脚导航"><a href="#/diy/collection">款式系列</a><a href="#/diy/cart">购物车</a><a href="#/community">设计社区</a><a href="#/my-designs">我的设计</a><a href="#/showroom">珠宝展台</a></nav><small>目前提供定制预览与演示购物车，价格及交期以正式确认为准。</small></footer>
  </main>;
}
