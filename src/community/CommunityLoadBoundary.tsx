import {Component,type ReactNode} from 'react';
import {ShopState} from '../components/ShopState';

export class CommunityLoadBoundary extends Component<{children:ReactNode;standalone?:boolean},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){
    if(!this.state.failed)return this.props.children;
    const recovery=<ShopState kind="error" title="作品页面暂时无法打开，请重新载入。">
      <button className="shop-button" onClick={()=>window.location.reload()}>重新载入页面</button>
    </ShopState>;
    return this.props.standalone?<div className="app-shell">{recovery}</div>:recovery;
  }
}
