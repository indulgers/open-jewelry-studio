import {useState} from 'react';
import {ReviewDialog} from '../stone-first/ring02/ReviewDialog';
import {CommunityAccountChanged,communityRequest,errorText,quoteAmount,type Order} from './client';
import type {OrderQuote} from './order-quote';
import {useOrderMutation} from './useOrderMutation';
import './order-quote.css';

type Props={
  orders:Order[];
  accountName:string;
  onAccountChanged:()=>void;
  onRefresh:()=>void;
};

function QuoteDetails({quote}:{quote:OrderQuote}){
  return <div className="order-quote-details">
    <div><span>一件报价</span><strong>{quoteAmount(quote)}</strong></div>
    <p>{quote.description}</p>
  </div>;
}

export function OrderHistory({orders,accountName,onAccountChanged,onRefresh}:Props){
  const [review,setReview]=useState<{id:string;title:string;quote:OrderQuote;accountName:string}>();
  const [error,setError]=useState('');
  const unknownResult='尚未确认下单结果。';
  const mutation=useOrderMutation(accountName,()=>setError('等待超时。'+unknownResult));
  const {busy}=mutation;
  const current=review&&orders.find(order=>order.id===review.id);
  const changed=review&&(current?.status!=='已报价'||current.quote?.version!==review.quote.version);
  function dismiss(){
    setReview(undefined);
    if(changed||error)onRefresh();
  }
  async function confirm(){
    if(!review||review.accountName!==accountName||changed||error)return;
    const signal=mutation.start();
    if(!signal)return;
    try{
      await communityRequest('orders/'+review.id+'/confirm',{
        expectedAccount:review.accountName,quoteVersion:review.quote.version,
      },signal);
      if(signal.aborted)return;
      setReview(undefined);
      onRefresh();
    }catch(cause){
      if(signal.aborted)return;
      if(cause instanceof CommunityAccountChanged){setReview(undefined);onAccountChanged();}
      else setError(cause instanceof TypeError?'连接中断。'+unknownResult:errorText(cause));
    }finally{mutation.finish(signal);}
  }
  return <section id="community-orders" className="community-orders">
    <h2>我的同款申请</h2>
    {orders.length?<ul className="order-history">{orders.map(order=>
      <li key={order.id} id={'community-order-'+order.id} tabIndex={-1}>
        <div className="order-heading"><h3>{order.title}</h3><span>{order.status==='已下单'?'已下单 · 未支付':order.status}</span></div>
        <small>受理编号 {order.id}</small>
        {order.quote&&<QuoteDetails quote={order.quote}/>}
        {order.status==='已报价'&&order.quote&&<button type="button" className="shop-button" onClick={()=>{
          if(order.quote){setError('');setReview({id:order.id,title:order.title,quote:order.quote,accountName});}
        }}>核对报价并下单</button>}
        {order.status==='已下单'&&order.orderedAt&&<small>下单时间 {new Date(order.orderedAt).toLocaleString('zh-CN')}</small>}
      </li>)}</ul>:<p>暂无同款申请。</p>}
    {review&&review.accountName===accountName&&<ReviewDialog title="核对报价并下单" busy={busy} onClose={dismiss}>
      <p>{review.title} · 1 件</p>
      <QuoteDetails quote={review.quote}/>
      <p>将以 {accountName} 的账号按此报价下单，本次确认无需付款。</p>
      {(changed||error)&&<p role="alert">{changed?'这份报价已变更。':error} 请重新读取申请，核对最新状态。</p>}
      <div className="community-actions">
        {changed||error?<button type="button" className="shop-button" onClick={dismiss}>重新读取申请</button>:
          <button type="button" className="shop-button" disabled={busy} onClick={confirm}>{busy?'正在确认…':'确认按 '+quoteAmount(review.quote)+' 下单'}</button>}
        {!changed&&!error&&<button type="button" disabled={busy} onClick={dismiss}>返回</button>}
      </div>
    </ReviewDialog>}
  </section>;
}
