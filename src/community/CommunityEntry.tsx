import {useLayoutEffect} from 'react';
import {ShopHeader} from '../components/ShopHeader';
import CommunityStudio from './CommunityStudio';

export default function CommunityEntry({mode}:{mode:'community'|'mine'}){
  useLayoutEffect(()=>{
    if(window.scrollY>0)window.scrollTo({top:0,behavior:'instant'});
  },[mode]);
  return <div className="app-shell" data-workspace="stonefirst">
    <ShopHeader page={mode}/>
    <section id="panel-stonefirst" aria-label="戒指定制"><CommunityStudio key={mode} mode={mode}/></section>
  </div>;
}
