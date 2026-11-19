import {useEffect,useRef,useState} from 'react';
import {ReviewDialog} from '../stone-first/ring02/ReviewDialog';
import {AccountForm} from './AccountForm';
import {CommunityAccountChanged,CommunityRequestError,communityRequest,errorText,type Account,type Order,type Work} from './client';

type Props={
  work:Work;
  account:Account|null;
  onLogin:(account:Account)=>void;
  onClose:()=>void;
  onAccountChanged:()=>void;
  onWithdrawn:()=>void;
};

export function WorkRequestDialog({work,account,onLogin,onClose,onAccountChanged,onWithdrawn}:Props){
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [receipt,setReceipt]=useState<Order>();
  const trackingLink=useRef<HTMLAnchorElement>(null);
  const confirmButton=useRef<HTMLButtonElement>(null);
  const needsConfirmationFocus=useRef(false);
  useEffect(()=>{
    if(receipt)trackingLink.current?.focus();
    else if(account&&needsConfirmationFocus.current){
      confirmButton.current?.focus();
      needsConfirmationFocus.current=false;
    }
  },[receipt,account]);

  async function submit(){
    if(!account||busy||receipt)return;
    setBusy(true);
    setError('');
    try{
      setReceipt(await communityRequest<Order>('works/'+work.id+'/orders',{expectedAccount:account.name}));
    }catch(cause){
      if(cause instanceof CommunityAccountChanged)onAccountChanged();
      else if(cause instanceof CommunityRequestError&&cause.status===404)onWithdrawn();
      else setError(cause instanceof TypeError?'连接中断，请检查网络后重试。':errorText(cause));
    }finally{setBusy(false);}
  }

  return <ReviewDialog title={receipt?'同款申请回执':account?'确认同款申请':'登录后申请同款'} busy={busy} onClose={onClose}>
    <div className="community-request-work">
      <img src={work.image} alt=""/>
      <div><strong>{work.title}</strong><small>{work.author}</small></div>
    </div>
    {receipt?<div className="community-request-receipt">
      <dl><div><dt>申请状态</dt><dd>{receipt.status}</dd></div>
        <div><dt>受理编号</dt><dd>{receipt.id}</dd></div></dl>
      <div className="community-actions">
        <a className="shop-button" ref={trackingLink} href={'#/my-designs?order='+encodeURIComponent(receipt.id)}>查看这笔申请</a>
        <button className="shop-text-link" onClick={onClose}>继续浏览</button>
      </div>
    </div>:<>
      <p className="community-request-terms">提交后由工作室核对用料和制作费用，报价由你确认。本次申请无需付款。</p>
      {account?<>
        <p className="community-request-account">申请账号 <strong>{account.name}</strong></p>
        {error&&<p role="alert" className="community-notice">{error}</p>}
        <div className="community-actions">
          <button className="shop-button" ref={confirmButton} disabled={busy} onClick={()=>void submit()}>
            {busy?'正在提交…':error?'重试提交':'确认提交申请'}</button>
          <button className="shop-text-link" disabled={busy} onClick={onClose}>取消</button>
        </div>
      </>:<>
        <AccountForm onSuccess={user=>{needsConfirmationFocus.current=true;onLogin(user);}}/>
        <button className="shop-text-link" onClick={onClose}>返回社区</button>
      </>}
    </>}
  </ReviewDialog>;
}
