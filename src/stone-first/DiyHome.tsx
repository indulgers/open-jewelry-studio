import {RING02_PRICE,formatYuan} from './ring02/demoOrder';
import {RING02_POSTER} from './ring02/assets';
import './diy-home.css';

const templates=[
  {
    name:'围钻戒指',
    image:RING02_POSTER,
    editor:'#/stonefirst/ring-02',
    referencePrice:RING02_PRICE.base,
    description:'圆形主石与四段围钻相衬，两侧戒臂镶有配钻。可自选戒头、主石和配钻。',
  },
] as const;

export function DiyHome(){
  return <main className="diy-home">
    <header className="diy-home-intro">
      <h1>定制你的戒指</h1>
      <p>从喜欢的款式开始。</p>
    </header>
    <div className="diy-template-grid">
      {templates.map(template=><article key={template.editor} className="diy-template">
        <a href={template.editor} className="diy-template-image" aria-label={'查看'+template.name}>
          <img src={template.image} alt="" width={822} height={598}/>
        </a>
        <div className="diy-template-details">
          <h2>{template.name}</h2>
          <p>{template.description}</p>
          <p className="diy-reference-price">演示参考价 <strong>{formatYuan(template.referencePrice)}</strong></p>
          <a className="shop-button" href={template.editor}>开始 DIY <span aria-hidden="true">→</span></a>
        </div>
      </article>)}
    </div>
  </main>;
}
