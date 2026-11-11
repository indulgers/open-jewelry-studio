import {useEffect,useState} from 'react';
import {demoOrders,formatYuan} from './ring02/demoOrder';
import './diy-home.css';

export function DiyCart(){
  const [orders,setOrders]=useState<ReturnType<typeof demoOrders>|null>(null);
  const [error,setError]=useState(false);
  useEffect(()=>{
    function refresh(){
      try{setOrders(demoOrders());setError(false);}
      catch{setError(true);}
    }
    refresh();
    window.addEventListener('storage',refresh);
    return ()=>window.removeEventListener('storage',refresh);
  },[]);
  return <main className="diy-home">
    <header className="diy-home-intro">
      <a href="#/diy">全部款式</a>
      <h1>购物车</h1>
      <p>方案保留在本机，价格和交期为示例。</p>
    </header>
    {error?<p role="alert">无法读取当前浏览器的购物车。</p>:orders?.length===0?<p>购物车为空。</p>:null}
    <div className="diy-cart">
      {orders?.map(order=><article key={order.revision} className="diy-template diy-template-details">
        <h2>围钻戒指 · 1 件</h2>
        <p>确认于 <time dateTime={order.confirmedAt}>{new Date(order.confirmedAt).toLocaleString('zh-CN')}</time></p>
        <dl>{order.details.map(detail=><div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>
        <p><strong>{formatYuan(order.quote.amount)}</strong> · 示例交期 {order.quote.leadTime}</p>
      </article>)}
    </div>
  </main>;
}
