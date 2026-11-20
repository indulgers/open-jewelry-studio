import {useEffect,useRef,useState} from 'react';
import {communityRequest,CUSTOMER_SESSION_CHANGED,type Account} from '../community/client';
import {XiangyanWordmark} from './XiangyanWordmark';
import {CART_CHANGED,demoOrders} from '../stone-first/ring02/demoOrder';

export function ShopHeader({page,verifyAccount=true}:{page:string|null;verifyAccount?:boolean}){
  const [member,setMember]=useState(false);
  useEffect(()=>{
    if(!verifyAccount)return;
    let active:AbortController;
    const read=()=>{
      active?.abort();
      const request=active=new AbortController();
      communityRequest<{account:Account|null}>('session',undefined,request.signal)
        .then(({account})=>{if(!request.signal.aborted)setMember(!!account);})
        .catch(()=>{if(!request.signal.aborted)setMember(false);});
    };
    const storage=(event:StorageEvent)=>{if(!event.key||event.key===CUSTOMER_SESSION_CHANGED)read();};
    read();
    window.addEventListener(CUSTOMER_SESSION_CHANGED,read);
    window.addEventListener('storage',storage);
    window.addEventListener('pageshow',read);
    return ()=>{active.abort();window.removeEventListener(CUSTOMER_SESSION_CHANGED,read);window.removeEventListener('storage',storage);window.removeEventListener('pageshow',read);};
  },[verifyAccount]);
  const [count,setCount]=useState(0);
  const [bump,setBump]=useState(0);
  const lastCount=useRef<number|null>(null);
  const [menu,setMenu]=useState(false);
  const menuButton=useRef<HTMLButtonElement>(null);
  const header=useRef<HTMLElement>(null);
  useEffect(()=>{
    if(!menu)return;
    function dismiss(event:PointerEvent){
      if(event.target instanceof Node && !header.current?.contains(event.target))setMenu(false);
    }
    function escape(event:KeyboardEvent){
      if(event.key!=='Escape')return;
      setMenu(false);
      menuButton.current?.focus();
    }
    document.addEventListener('pointerdown',dismiss);
    document.addEventListener('keydown',escape);
    return ()=>{
      document.removeEventListener('pointerdown',dismiss);
      document.removeEventListener('keydown',escape);
    };
  },[menu]);
  useEffect(()=>{
    // The four switchable themes were retired; clear the attribute an older session may have left.
    delete document.documentElement.dataset.style;
  },[]);
  useEffect(()=>{
    if(lastCount.current!==null&&count>lastCount.current)setBump(value=>value+1);
    lastCount.current=count;
  },[count]);
  useEffect(()=>{
    const refresh=()=>{try{setCount(demoOrders().length);}catch{setCount(0);}};
    const close=()=>setMenu(false);
    refresh();
    window.addEventListener(CART_CHANGED,refresh);
    window.addEventListener('storage',refresh);
    window.addEventListener('hashchange',close);
    return ()=>{
      window.removeEventListener(CART_CHANGED,refresh);
      window.removeEventListener('storage',refresh);
      window.removeEventListener('hashchange',close);
    };
  },[]);
  const customising=['reference','published','ring02','recipes'].includes(page??'');
  const links=[
    {label:'款式系列',href:'#/diy/collection',active:page==='collection'},
    {label:'专属定制',href:'#/stonefirst/ring-02',active:customising},
    {label:'设计社区',href:'#/community',active:page==='community'},
    {label:'关于相言',href:'#/diy/story',active:page==='story'},
  ].map(({label,href,active})=><a key={href} href={href} aria-current={active?'page':undefined}
    onClick={()=>setMenu(false)}>{label}</a>);
  return <>
    <header className="site-header" ref={header} onBlur={event=>{
      if(event.relatedTarget instanceof Node&&!event.currentTarget.contains(event.relatedTarget))setMenu(false);
    }}>
      <nav className="shop-navigation" aria-label="主导航">{links}</nav>
      <button ref={menuButton} className="shop-menu-button" aria-label={menu?'收起导航':'展开导航'} aria-expanded={menu} aria-controls="shop-mobile-menu" onClick={()=>setMenu(!menu)}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d={menu?'M5 5l14 14M5 19 19 5':'M3 6h18M3 12h18M3 18h12'}/></svg>
      </button>
      <a className="brand" href="#/diy" aria-label="相言首页"><XiangyanWordmark/><span>XIANGYAN</span></a>
      <div className="shop-header-actions">
        <div className="header-account" aria-label="消费者账号">
          {member?<a href="#/my-designs" aria-current={page==='mine'?'page':undefined}>我的账户</a>:<>
            <a href="#/my-designs?auth=login">登录</a><span aria-hidden="true">/</span><a href="#/my-designs?auth=register">注册</a>
          </>}
        </div>
        <a className="header-cart" aria-label={'购物车'+(count?'，'+count+' 件':'')} href="#/diy/cart" aria-current={page==='cart'?'page':undefined}>
          <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true"><path d="M4.5 8.5h15l-1.2 12h-12.6l-1.2-12Zm4-.2V7a3.5 3.5 0 0 1 7 0v1.3"/></svg>
          <span className="cart-label">购物车</span>{count>0&&<span key={bump} className="cart-count" data-bump={bump?'':undefined}>{count}</span>}
        </a>
      </div>
      <nav className="shop-mobile-menu" id="shop-mobile-menu" aria-label="移动端导航" hidden={!menu}>
        {links}
      </nav>
    </header>
  </>;
}
