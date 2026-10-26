import {GEM_ASSET} from '../assets/gemManifest';
export function AssetCredits(){
  return <details className="asset-credits"><summary>素材与开源说明</summary>
    <p>参数化 DIY 主石：<a href={GEM_ASSET.sourceUrl} target="_blank" rel="noreferrer">{GEM_ASSET.sourceTitle}</a>，作者 {GEM_ASSET.author}，
      <a href={GEM_ASSET.licenseUrl} target="_blank" rel="noreferrer">{GEM_ASSET.licenseName}</a>。</p>
    <p>{GEM_ASSET.modifications}</p>
    <p>参考实模：用户提供的六爪 GLB；金属与宝石使用文件中引用的 iJewel EXR，已存于本地。模型与环境图仅作效果研究，未确认商业使用授权。</p>
    <p>参数化戒托由程序生成。Three.js / R3F / drei 与本地光学材质实时渲染；不含专有珠宝 SDK 或其着色器代码。</p>
    <p>布光与后处理参考 <a href="https://github.com/pmndrs/examples/tree/main/examples/diamond-ring" target="_blank" rel="noreferrer">Poimandres Diamond Ring</a>（MIT），未使用其戒指模型。</p>
  </details>;
}
