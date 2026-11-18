import {useEffect,useRef,useState} from 'react';
import {XiangyanWordmark} from './XiangyanWordmark';
import {CART_CHANGED,demoOrders} from '../stone-first/ring02/demoOrder';

const styles=[['paris','巴黎极简'],['french','法式浪漫'],['italian','意式雕塑'],['arch','建筑黑白']] as const;
type ShopStyle=typeof styles[number][0];
const STYLE_KEY='xiangyan:shop-style';

function initialStyle():ShopStyle{
  try{
    const saved=localStorage.getItem(STYLE_KEY);
    if(styles.some(([id])=>id===saved))return saved as ShopStyle;
  }catch{/* Style selection remains available when browser storage is blocked. */}
  return 'paris';
}

export function ShopHeader({page}:{page:string|null}){
  const [style,setStyle]=useState(initialStyle);
  const [count,setCount]=useState(0);
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
    document.documentElement.dataset.style=style;
    try{localStorage.setItem(STYLE_KEY,style);}catch{}
  },[style]);
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
        <label className="shop-style"><span className="sr-only">网站风格</span>
          <select value={style} onChange={event=>setStyle(event.target.value as ShopStyle)}>{styles.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
        </label>
        <a className="header-cart" aria-label={'购物车'+(count?'，'+count+' 件':'')} href="#/diy/cart" aria-current={page==='cart'?'page':undefined}>
          <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true"><path d="M5 8h14l-1 13H6L5 8Zm4 0V6a3 3 0 0 1 6 0v2"/></svg>
          <span className="cart-label">购物车</span>{count>0&&<span className="cart-count">{count}</span>}
        </a>
      </div>
      <nav className="shop-mobile-menu" id="shop-mobile-menu" aria-label="移动端导航" hidden={!menu}>
        {links}
      </nav>
    </header>
  </>;
}
