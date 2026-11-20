import {ShopState} from '../components/ShopState';
import {sumMoney} from './pricing';
import {managedAssetUrl,templateRoute} from './reference/managed-types';
import {useEffect,useState} from 'react';
import {RING_CATALOG} from './catalog';
import {CART_CHANGED,demoOrders,formatYuan,removeDemoOrder} from './ring02/demoOrder';
import {RING02_PRECISION_ROUTE} from './ring02/assets';
import {bandStyle,headName} from './reference/parts';
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
  const pricedOrders=orders?.filter(order=>!order.requiresWhiteConfirmation)??[];
  const pendingOrders=orders?.filter(order=>order.requiresWhiteConfirmation)??[];
  const total=pricedOrders.length?sumMoney(pricedOrders.map(order=>order.quote.amount)):null;
  function renderOrder(order:NonNullable<typeof orders>[number]){
    const template=RING_CATALOG.find(item=>item.revision===order.templateRevision);
    const design=parseReferenceDesign(order.design);
    const parts=template&&design?referenceParts(template,design):null;
    const mixed=parts&&(parts.head.id!==template?.id||parts.band.id!==template?.id);
    const name=order.name??order.managed?.name??(mixed?headName(parts.head.name)+' × '+bandStyle(parts.band.id).name:template?.name??'戒指定制方案');
    const metal=order.details.find(detail=>detail.label==='金属外观')?.value.trim();
    const editor=order.managed?templateRoute(order.managed.id,order.managed.revision):template?.kind==='parametric'&&order.pave?.units==='model'?RING02_PRECISION_ROUTE:template?.editor;
    return <article key={order.revision} className="diy-cart-order">
      <CartImage thumbnail={order.requiresWhiteConfirmation?undefined:order.thumbnail} image={order.managed?managedAssetUrl(order.managed.id+'/'+order.managed.revision+'/cover.jpg'):mixed?undefined:template?.image} name={name}/>
      <div className="cart-order-info">
        <div className="cart-order-top"><div><span className="collection-label">{template?.collection??'专属定制'}</span><h2>{name}</h2><p>{metal&&metal+' · '}1 件</p></div><button className="cart-remove" aria-label={'移除'+name} onClick={()=>remove(order.revision)}>移除</button></div>
        {!order.requiresWhiteConfirmation&&<p className="cart-order-price"><strong>{formatYuan(order.quote.amount)}</strong><span>保存时参考价</span></p>}
        {order.requiresWhiteConfirmation&&<p role="status">此旧方案使用早期宝石参数，请打开编辑器重新选择宝石并确认方案。暂不计入合计。</p>}
        <details hidden={order.requiresWhiteConfirmation} className="cart-details"><summary>查看款式与配置</summary><dl>{order.details.map(detail=><div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl><p>确认于 <time dateTime={order.confirmedAt}>{new Date(order.confirmedAt).toLocaleString('zh-CN')}</time></p></details>
        {editor&&<a className="cart-customize" href={editor}>定制此款</a>}
        {!order.requiresWhiteConfirmation&&<p className="cart-delivery">示例交期 {order.quote.leadTime} · 工艺与圈号待确认</p>}
      </div>
    </article>;
  }
  return <main className="diy-home diy-cart-page shop-wrap">
    <header className="diy-home-intro">
      <a className="shop-text-link" href="#/diy/collection">返回款式系列</a>
      <h1>你的购物车{orders&&<span>{orders.length} 件心意之选</span>}</h1>
      <p>查看已保存的款式、配置和价格。</p>
    </header>
    {error&&<p className="cart-error" role="alert">{error}</p>}
    {!orders&&!error&&<ShopState kind="loading" title="正在读取购物车…"/>}
    {orders?.length===0?<ShopState title="购物车里还没有款式" detail="从款式系列挑选原款，或在三维工作台完成搭配。">
      <a className="shop-button" href="#/diy/collection">探索款式系列</a>
    </ShopState>:!!orders?.length&&<div className="cart-layout">
      <div className="diy-cart">
        {pricedOrders.map(renderOrder)}
        {pendingOrders.length>0&&<section className="cart-pending" aria-labelledby="cart-pending-title">
          <h2 id="cart-pending-title">待重新确认的历史方案</h2>
          {pendingOrders.map(renderOrder)}
        </section>}
      </div>
      <aside className="cart-summary" aria-labelledby="cart-summary-title">
        <h2 id="cart-summary-title">方案小计</h2>
        <dl>
          <div><dt>已计价方案</dt><dd>{pricedOrders.length} 件</dd></div>
          {pendingOrders.length>0&&<div><dt>待重新确认</dt><dd>{pendingOrders.length} 件</dd></div>}
          <div className="cart-total"><dt>参考合计</dt><dd>{total===null?'待确认':formatYuan(total)}</dd></div>
        </dl>
        <p>方案已保留在本机。当前为演示购物车，暂不收款，实物价格与制作信息待正式确认。</p>
        <a className="shop-button" href="#/diy/collection">继续挑选</a>
        <a className="shop-text-link" href="#/my-designs">查看我的设计</a>
      </aside>
    </div>}
  </main>;
}
