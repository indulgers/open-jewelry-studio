import {useEffect,useState} from 'react';
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
  return <>
    <div className="shop-announcement">银色珠宝，心意由你定义<span> · </span>相言定制系列</div>
    <header className="site-header">
      <nav className="shop-navigation" aria-label="主导航">
        <a href="#/diy/collection" aria-current={page==='collection'?'page':undefined}>款式系列</a>
        <a href="#/stonefirst/ring-02">专属定制</a>
        <a href="#/diy/story">关于相言</a>
      </nav>
      <button className="shop-menu-button" aria-label={menu?'收起导航':'展开导航'} aria-expanded={menu} aria-controls="shop-mobile-menu" onClick={()=>setMenu(!menu)}>
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
        <a href="#/diy/collection" onClick={()=>setMenu(false)}>款式系列</a>
        <a href="#/stonefirst/ring-02" onClick={()=>setMenu(false)}>专属定制</a>
        <a href="#/diy/story" onClick={()=>setMenu(false)}>关于相言</a>
      </nav>
    </header>
  </>;
}
