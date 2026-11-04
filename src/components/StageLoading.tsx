export function StageLoading({poster,warming=false}:{poster?:string;warming?:boolean}){
  return <div className="loading-indicator" role="status">
    {poster&&<img className="catalog-poster" src={poster} alt="黄金色枕形光环戒指图片预览"/>}
    <div className="loading-caption"><span aria-hidden="true"/><div>
      <strong>{warming?'正在准备光线与切面':'正在准备三维预览'}</strong>
      <small>{poster?'当前为图片预览，完成后即可拖动':'完成后即可拖动旋转'}</small>
    </div></div>
  </div>;
}
