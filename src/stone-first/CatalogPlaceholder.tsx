import {GallerySkeleton} from '../components/ShopState';
import './diy-home.css';

export function CatalogHeading({all,featured=false,count,loading}:{all:boolean;featured?:boolean;count?:number;loading:boolean}){
  const Heading=all||!featured?'h1':'h2';
  return <div className="shop-section-heading catalog-heading"><p className="shop-eyebrow">{all?'The Collection':'Signature Pieces'}</p><Heading id="collection-title">{all?'全部款式':'精选原款'}</Heading>
    <p>查看原款结构与演示参考价，或选一款开始定制。</p>
    {all?<span className="collection-count">{loading?<i className="skeleton-count" aria-hidden="true"/>:count?count+' 款戒指':null}</span>
      :!!count&&<a className="shop-text-link" href="#/diy/collection">查看全部款式 <span aria-hidden="true">→</span></a>}
  </div>;
}

export function HeroCopy(){
  return <><h1 id="diy-title"><span>让心意，</span><br/><span>有自己的形状。</span></h1>
    <p className="diy-hero-sub">从一枚喜欢的戒指开始。在三维工作台里试搭戒头与戒圈，查看每一处镶嵌细节。</p></>;
}

export function HeroPlaceholder(){
  return <section className="diy-hero" aria-hidden="true">
    <div className="diy-hero-content"><p className="shop-eyebrow"><i className="skeleton-count"/></p>
      <HeroCopy/><div className="diy-hero-ctas"><div className="hero-action-placeholder"/></div>
      <div className="diy-hero-piece"><div className="hero-piece-photo hero-photo-placeholder"/><i className="skeleton-count"/></div></div>
    <div className="diy-hero-art hero-photo-placeholder"/>
  </section>;
}

export function CatalogPlaceholder({all,label}:{all:boolean;label:string}){
  return <main className="diy-home">{!all&&<HeroPlaceholder/>}
    <section className="diy-collection shop-wrap"><CatalogHeading all={all} featured={!all} loading/>
      <GallerySkeleton type="catalog" label={label}/></section></main>;
}
