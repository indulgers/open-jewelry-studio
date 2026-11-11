import {RING02_POSTER} from './assets';
import './loading.css';

export function Ring02Loading({retry}:{retry?:()=>void}){
  if(retry)return <div className="ring02-load-error" role="alert">
    <span>三维预览加载失败。</span>
    <button onClick={retry}>重试加载</button>
  </div>;
  return <div className="ring02-stage-loading" role="status" aria-label="原款参考，正在加载 3D 预览">
    <img src={RING02_POSTER} alt="银色围钻戒指原款" width={822} height={598}/>
    <span className="ring02-load-status"><span className="ring02-spinner" aria-hidden="true"/>原款参考 · 正在加载 3D</span>
  </div>;
}
