import {useEffect,useState} from 'react';
import {RING_CATALOG} from './catalog';
import {CART_CHANGED,demoOrders,formatYuan,removeDemoOrder} from './ring02/demoOrder';
import {bandStyle,HALO_COMBINATION_ROUTE,headName} from './reference/parts';
import {parseReferenceDesign,referenceParts} from './reference/design';
import './diy-home.css';
import './diy-cart.css';

function CartImage({thumbnail,image,name}:{thumbnail?:string;image?:string;name:string}){
  const [failed,setFailed]=useState<string>();
  const preview=failed===thumbnail?undefined:thumbnail;
  return <figure className="diy-cart-image">
    {preview||image?<img src={preview??image} alt={preview?name+'已确认方案':name+'原款参考图'} width="320" height="320" onError={preview?()=>setFailed(preview):undefined}/>:<span>图片暂不可用</span>}
    {!preview&&image&&<figcaption>款式参考图</figcaption>}
  </figure>;
}

export function DiyCart(){
  const [orders,setOrders]=useState<ReturnType<typeof demoOrders>|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    function refresh(){
      try{setOrders(demoOrders());setError('');}
      catch{setError('无法读取当前浏览器的购物车。请允许浏览器存储后刷新重试。');}
    }
    refresh();
    window.addEventListener('storage',refresh);
    window.addEventListener(CART_CHANGED,refresh);
    return ()=>{window.removeEventListener('storage',refresh);window.removeEventListener(CART_CHANGED,refresh);};
  },[]);
  function remove(revision:string){
    try{removeDemoOrder(revision);}
    catch{setError('暂时无法移除该方案，请稍后重试。');}
  }
  const total=orders?.reduce((sum,order)=>sum+order.quote.amount,0)??0;
  return <main className="diy-home diy-cart-page shop-wrap">
    <header className="diy-home-intro">
      <a className="shop-text-link" href="#/diy/collection">返回款式系列</a>
      <h1>你的购物车{orders&&<span>{orders.length} 件心意之选</span>}</h1>
      <p>把喜欢的留下，再慢慢确认每个细节。</p>
    </header>
    {error&&<p className="cart-error" role="alert">{error}</p>}
    {!orders&&!error&&<p role="status">正在读取购物车…</p>}
    {orders?.length===0?<div className="diy-cart-empty">
      <svg viewBox="0 0 64 64" width="58" height="58" aria-hidden="true"><path d="M14 22h36l-3 32H17l-3-32Zm10 0v-6a8 8 0 0 1 16 0v6"/></svg>
      <h2>下一枚心动，还在等你。</h2><p>挑一款原作，或亲手完成属于你的搭配。</p><a className="shop-button" href="#/diy/collection">探索款式系列</a>
    </div>:!!orders?.length&&<div className="cart-layout">
      <div className="diy-cart">
        {orders.map(order=>{
          const template=RING_CATALOG.find(item=>item.revision===order.templateRevision);
          const design=parseReferenceDesign(order.design);
          const parts=template&&design?referenceParts(template,design):null;
          const mixed=parts&&(parts.head.id!==template?.id||parts.band.id!==template?.id);
          const name=mixed?headName(parts.head.name)+' × '+bandStyle(parts.band.id).name:template?.name??'戒指定制方案';
          const editor=design&&template?.kind==='parametric'?HALO_COMBINATION_ROUTE:template?.editor;
          return <article key={order.revision} className="diy-cart-order">
            <CartImage thumbnail={order.thumbnail} image={mixed?undefined:template?.image} name={name}/>
            <div className="cart-order-info">
              <div className="cart-order-top"><div><span className="collection-label">{template?.collection??'专属定制'}</span><h2>{name}</h2><p>银色 · 1 件</p></div><button className="cart-remove" aria-label={'移除'+name} onClick={()=>remove(order.revision)}>移除</button></div>
              <p className="cart-order-price"><strong>{formatYuan(order.quote.amount)}</strong><span>参考价</span></p>
              <details className="cart-details"><summary>查看款式与配置</summary><dl>{order.details.map(detail=><div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl><p>确认于 <time dateTime={order.confirmedAt}>{new Date(order.confirmedAt).toLocaleString('zh-CN')}</time></p></details>
              {editor&&<a className="cart-customize" href={editor}>定制此款</a>}
              <p className="cart-delivery">示例交期 {order.quote.leadTime} · 工艺与圈号待确认</p>
            </div>
          </article>;
        })}
      </div>
      <aside className="cart-summary" aria-labelledby="cart-summary-title">
        <h2 id="cart-summary-title">心意清单</h2>
        <dl><div><dt>已选方案</dt><dd>{orders.length} 件</dd></div><div className="cart-total"><dt>参考合计</dt><dd>{formatYuan(total)}</dd></div></dl>
        <p>方案已保留在本机。当前为演示购物车，暂不收款，实物价格与制作信息待正式确认。</p>
        <a className="shop-button" href="#/diy/collection">继续挑选</a>
        <a className="shop-text-link" href="#/diy/collection">选择款式定制</a>
      </aside>
    </div>}
  </main>;
}
