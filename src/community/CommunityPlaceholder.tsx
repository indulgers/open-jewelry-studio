import {GallerySkeleton} from '../components/ShopState';
import './community.css';

export function CommunityHeading({mine,account}:{mine:boolean;account?:string}){
  return <header className="community-heading"><div><h1>{mine?'我的设计':'设计社区'}</h1>
    <p>{mine?'查看保存的作品、发布记录和同款申请。':'浏览创作者发布的珠宝作品，选择心仪的设计申请制作。'}</p></div>
    <div className="community-heading-links">{!mine&&account&&<small>当前账号 {account}</small>}
      <a className="shop-text-link" href={mine?'#/community':'#/my-designs'}>{mine?'浏览设计社区':'我的设计'}</a>
    </div>
  </header>;
}
export function CommunityPlaceholder({mine}:{mine:boolean}){
  return <main className="community-page"><CommunityHeading mine={mine}/><GallerySkeleton type="community" label="正在打开作品…"/></main>;
}
