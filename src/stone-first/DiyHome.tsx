import {useEffect,useState} from 'react';
import {formatYuan} from './ring02/demoOrder';
import {RING_CATALOG,type CatalogRing} from './catalog';
import {purchaseOriginal} from './purchase';
import {loadReferenceRing} from './reference/entry';
import './diy-home.css';

function warmEditor(template:CatalogRing){void loadReferenceRing(template).catch(()=>{});}
const HOME_FEATURED_IDS=['ring-starlight','ring-solstice','ring-petal','ring-rosette'];
const homeSelection=HOME_FEATURED_IDS.flatMap(id=>RING_CATALOG.filter(ring=>ring.id===id&&ring.listed));
const Arrow=()=> <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>;

export function DiyHome({section}:{section?:'collection'|'story'}){
  const [error,setError]=useState('');
  const featured=RING_CATALOG[0];
  const all=section==='collection';
  const products=all?RING_CATALOG.filter(template=>template.listed):homeSelection;
  useEffect(()=>{
    if(section!=='story')return;
    const frame=requestAnimationFrame(()=>document.getElementById('diy-'+section)?.scrollIntoView({block:'start',behavior:'instant'}));
    return ()=>cancelAnimationFrame(frame);
  },[section]);
  function purchase(template:CatalogRing){
    try{purchaseOriginal(template);window.location.hash='#/diy/cart';}
    catch{setError('购物车暂时无法保存。请允许浏览器存储后重试，或先进入定制页。');}
  }
  const purchaseError=error&&<div className="shop-wrap shop-error" role="alert">{error}<button onClick={()=>setError('')} aria-label="关闭提示">关闭</button></div>;
  return <main className="diy-home">
    {!all&&<>
    <section className="diy-hero" aria-labelledby="diy-title">
      <div className="shop-wrap diy-hero-grid">
        <div className="diy-hero-content">
          <p className="collection-label">相映系列 · 银色之作</p>
          <h1 id="diy-title">让心意，<br/>有自己的<em>形状。</em></h1>
          <p className="diy-hero-sub">从一枚喜欢的戒指开始。<br/>选一颗主石，调整每一处细节，<br/>把想说的话，留在指间。</p>
          <div className="diy-hero-ctas">
            <a className="shop-button" href={featured.editor} onMouseEnter={()=>warmEditor(featured)} onFocus={()=>warmEditor(featured)}>开始专属定制 <Arrow/></a>
            <a className="shop-button shop-button-outline" href="#/diy/collection">选购原款</a>
          </div>
          <dl className="diy-hero-notes">
            <div><dt>银色</dt><dd>纯粹的金属光泽</dd></div>
            <div><dt>随心</dt><dd>主石与镶嵌搭配</dd></div>
            <div><dt>专属</dt><dd>留一句心意刻字</dd></div>
          </dl>
        </div>
        <figure className="diy-hero-art">
          <img src={featured.campaign} alt="模特佩戴银色分段围钻戒指，手指轻靠颈侧" width={1122} height={1402} fetchPriority="high"/>
          <figcaption>AI 佩戴示意 · 款式细节以三维模型为准</figcaption>
          <div className="diy-hero-tag">
            <img src={featured.image} alt="" width="60" height="60"/>
            <div><strong>{featured.name}</strong><span>银色 · 原款搭配</span></div>
            <div className="hero-tag-price"><strong>{formatYuan(featured.price.base)}</strong><small>参考价</small></div>
            <button onClick={()=>purchase(featured)}>直接选购</button>
          </div>
        </figure>
      </div>
    </section>
    <div className="diy-service-strip"><div className="shop-wrap"><span>相言 · 为心意留形</span><p>从原款出发</p><p>三维细节预览</p><p>按心意定制</p></div></div>
    {purchaseError}
    <section className="diy-wearing shop-wrap" aria-labelledby="wearing-title">
      <div className="shop-section-heading"><div><h2 id="wearing-title">戴上属于你的<em>那一枚</em></h2><p>从花瓣的层次，到一颗主石的光。找到你喜欢的轮廓。</p></div><a className="shop-text-link" href="#/diy/collection">查看全部款式 <Arrow/></a></div>
      <div className="diy-wearing-grid">{homeSelection.map(template=><a key={template.id} className="diy-wearing-item" href={template.editor} onMouseEnter={()=>warmEditor(template)} onFocus={()=>warmEditor(template)}>
        <img src={template.campaign} alt={template.name+'近景佩戴示意'} width={1122} height={1402} loading="lazy"/>
        <div><h3>{template.name}</h3><span>定制这一款 <Arrow/></span></div>
      </a>)}</div><p className="diy-wearing-note">AI 佩戴示意 · 准确款式与结构请查看下方模型原款图</p>
    </section>
    </>}
    {all&&purchaseError}
    <section className="diy-collection shop-wrap" id="diy-collection" aria-labelledby="collection-title">
      <div className="shop-section-heading"><div><h2 id="collection-title">{all?'全部款式':<>找到你的<em>心意之选</em></>}</h2><p>保留原款的美，也为你的想法留出空间。</p></div>{all?<span className="collection-count">{products.length} 款戒指 · 银色系列</span>:<a className="shop-text-link" href="#/diy/collection">查看全部款式 <Arrow/></a>}</div>
      <div className="diy-template-grid" data-count={products.length}>
        {products.map(template=><article key={template.id} className="diy-template">
          <a href={template.editor} className="diy-template-image" onMouseEnter={()=>warmEditor(template)} onFocus={()=>warmEditor(template)} aria-label={'定制'+template.name}>
            <img src={template.image} alt={template.name+'三维模型原款图'} width={822} height={598} loading="lazy"/>
            <span className="product-badge">可专属定制</span>
          </a>
          <div className="diy-template-details">
            <span className="collection-label">{template.collection}</span>
            <h3>{template.name}</h3><p className="template-subtitle">{template.subtitle}</p>
            <p className="template-description">{template.description}</p>
            <p className="diy-reference-price"><strong>{formatYuan(template.price.base)}</strong><span>演示参考价</span></p>
            <div className="product-actions"><a className="shop-button" href={template.editor} onMouseEnter={()=>warmEditor(template)} onFocus={()=>warmEditor(template)}>开始定制 <Arrow/></a><button className="shop-button shop-button-outline" onClick={()=>purchase(template)}>选购原款</button></div>
          </div>
        </article>)}
      </div>
    </section>
    {!all&&<>
    <section className="diy-editorial" aria-labelledby="editorial-title">
      <div className="shop-wrap diy-editorial-grid">
        <figure><img src={featured.image} alt="围钻戒指的真实三维模型，展示镶座与镶钻戒臂" width={822} height={598} loading="lazy"/><figcaption>原款三维模型</figcaption></figure>
        <div><h2 id="editorial-title">细节之间，<br/><em>都是你的选择。</em></h2><p>戒头勾勒第一眼的轮廓，戒圈承接日常的陪伴。换一种主石，调整围钻或戒臂的排列，在三维预览中看见你的每一次选择。</p>
          <ul><li><span>戒头</span>围钻、四爪与包镶造型</li><li><span>宝石</span>切形、大小与色彩搭配</li><li><span>戒圈</span>铺钻长度与心意刻字</li></ul>
          <a className="shop-button shop-button-light" href={featured.editor} onMouseEnter={()=>warmEditor(featured)} onFocus={()=>warmEditor(featured)}>去试试我的想法 <Arrow/></a>
        </div>
      </div>
    </section>
    <section className="diy-story shop-wrap" id="diy-story" aria-labelledby="story-title">
      <div><span className="collection-label">关于相言</span><h2 id="story-title">有些话，<br/>留给一枚戒指来说。</h2></div>
      <div><p>相，是彼此看见；言，是心意的表达。我们希望一枚戒指，既有初见时的美，也能留下属于你的选择。</p><p>从这里的参考款式出发，可以直接选购原款，也可以进入定制页慢慢调整。每一份搭配，都能以图片和配置保留在购物车中。</p><a className="shop-text-link" href="#/diy/collection">探索款式系列 <Arrow/></a></div>
    </section>
    </>}
    <footer className="diy-footer shop-wrap"><div><b>相言</b><p>让心意，有自己的形状。</p></div><nav aria-label="页脚导航"><a href="#/diy/collection">款式系列</a><a href="#/diy/cart">购物车</a><a href="#/showroom">珠宝展台</a></nav><small>目前提供定制预览与演示购物车，价格及交期以正式确认为准。</small></footer>
  </main>;
}
