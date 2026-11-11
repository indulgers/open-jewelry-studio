import {formatYuan} from './ring02/demoOrder';
import {RING02_TEMPLATE} from './ring02/assets';
import './diy-home.css';

const templates=[RING02_TEMPLATE].filter(template=>template.listed);

export function DiyHome(){
  return <main className="diy-home">
    <section className="diy-hero" aria-labelledby="diy-title">
      <figure className="diy-hero-art">
        <img src="/media/diy/xiangyan-ring-editorial.jpg" alt="" width={1536} height={1024} fetchPriority="high"/>
        <figcaption>品牌形象图</figcaption>
      </figure>
      <div className="diy-hero-content">
        <h1 id="diy-title">定制你的戒指</h1>
        <p>从戒头到戒圈，亲手搭配。</p>
        <button className="diy-hero-action" onClick={()=>{
          const collection=document.getElementById('diy-collection');
          collection?.focus({preventScroll:true});
          collection?.scrollIntoView({block:'start',behavior:'instant'});
        }}>浏览款式
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 5v14m-5-5 5 5 5-5"/></svg>
        </button>
      </div>
    </section>
    <section className="diy-collection" aria-labelledby="diy-collection">
      <h2 id="diy-collection" tabIndex={-1}>戒指定制款式</h2>
      {templates.length===0&&<p>当前没有可定制的款式。</p>}
      <div className="diy-template-grid">
        {templates.map(template=><article key={template.editor} className="diy-template">
          <a href={template.editor} className="diy-template-image" aria-label={'查看'+template.name}>
            <img src={template.image} alt="银色围钻戒指，四段围钻与镶钻戒臂" width={822} height={598}/>
          </a>
          <div className="diy-template-details">
            <h3>{template.name}</h3>
            <p>{template.description}</p>
            <p className="diy-reference-price"><strong>{formatYuan(template.price.base)}</strong> 演示参考价</p>
            <a className="shop-button" href={template.editor}>开始定制
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>
            </a>
          </div>
        </article>)}
      </div>
    </section>
    <footer className="diy-footer"><a href="#/showroom">探索珠宝展台 <span aria-hidden="true">↗</span></a></footer>
  </main>;
}
