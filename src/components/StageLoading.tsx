export function StageLoading({warming=false}:{warming?:boolean}={}){
  return <div className="loading-indicator" role="status">
    <div className="loading-caption"><span aria-hidden="true"/><div>
      <strong>{warming?'正在准备光线与切面':'正在准备三维预览'}</strong>
      <small>完成后即可拖动旋转</small>
    </div></div>
  </div>;
}
