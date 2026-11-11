import {RING02_POSTER} from './assets';
import './loading.css';

export function Ring02Loading({retry}:{retry?:()=>void}){
  return <div className="ring02-stage-loading">
    <img src={RING02_POSTER} alt="原款围钻戒指" fetchPriority="high" width={822} height={598}/>
    <div role="status">
      {retry?<><span>三维预览加载失败。</span><button onClick={retry}>重试加载</button></>:<span>图片预览 · 正在加载 3D</span>}
    </div>
  </div>;
}
