import {GEM_ASSET} from '../assets/gemManifest';
export function AssetCredits(){
  return <details className="asset-credits"><summary>素材与开源说明</summary>
    <p>参数化 DIY 主石：<a href={GEM_ASSET.sourceUrl} target="_blank" rel="noreferrer">{GEM_ASSET.sourceTitle}</a>，作者 {GEM_ASSET.author}，
      <a href={GEM_ASSET.licenseUrl} target="_blank" rel="noreferrer">{GEM_ASSET.licenseName}</a>。</p>
    <p>{GEM_ASSET.modifications}</p>
    <p>成品戒托与配钻：<a href="https://github.com/ehsanwwe/diamond-shader-lab" target="_blank" rel="noreferrer">Diamond Shader Lab</a>，Ehsan Moradi，<a href="/licenses/diamond-shader-lab-MIT.txt" target="_blank">MIT</a>；替换为用户提供的圆形主石，增加局部金属遮蔽。</p>
    <p>19 款宝石来自用户提供的 Rhino 文件，保留切面并转换为 GLB。源文件未标注单位，当前仅用于比例展示。环境光由本项目原创程序生成。</p>
    <p>参数化戒托由程序生成。Three.js / R3F / drei 与本地光学材质实时渲染；不含专有珠宝 SDK 或其着色器代码。</p>
    <p>布光与后处理参考 <a href="https://github.com/pmndrs/examples/tree/main/examples/diamond-ring" target="_blank" rel="noreferrer">Poimandres Diamond Ring</a>（MIT），未使用其戒指模型。</p>
  </details>;
}
