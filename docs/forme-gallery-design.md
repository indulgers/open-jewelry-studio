# FORME 铂纸画廊

用户已选择三方案中的 A，已整合到正式 `/#/modules`。尚未发布。本轮把获选的可操作提案整合进现有编辑器，采用 code-led 路径，不重新选方向，不更换几何、光照或渲染质量；参考图为本次会话的 `design-gallery-desktop.jpg` 和 `design-gallery-mobile.jpg`。

## Direction contract

**THESIS**：让真实珠宝占据纸白画布，参数如作品签般清晰；不保留原有的圆角卡片外框。

**OWN-WORLD**：纸白 `#f5f3ee`、近白 `#fffefb`、石墨 `#302c29`、暗红 `#71394a`。Cormorant Garamond 品牌字、中文宋体标题、Manrope 与设备中文无衬线控件。平直面板，圆形金属色样，细线图标。

**STORY**：先看到完整四照花戒指，再选材质、观察反光，随后调整花形和尺寸。保留款式、素材、撤销、重做、重置和已有导入/导出功能，继续沿用安全编辑范围。

**FIRST VIEWPORT**：顶部工作空间切换加 FORME 操作栏；左侧大画布，右侧 340px 参数栏，材质为初始页。模型下方展示实际名称、材质与尺寸。右下工具不遮挡主体。手机使用上方画布和下方固定高度的参数区，只有参数内容局部滚动。

**FORM**：用户明确选择 A · 铂纸画廊（原提案种子 `b879d1bc`，Taste 结构研究种子 `831721790`）。操作场景是在室内或日常移动环境反复观察和调整珠宝。特征是同一真实模型与下方作品信息、右侧参数同步变化。

**FINISH**：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

范围：`public/forme/index.html`、`public/forme/studio.css`、`public/forme/camera.js`、两路由共用的外层导航以及共享本地字体。主展台内容区的视觉与渲染保持原行为。390px、768px、1440px 和当前浏览器宽度检查；手机真机测试不在本轮已验证范围内。

## 已实现的约束

- 两工作空间共用品牌与切换栏，桌面高 64px、手机高 56px；预留滚动条空间，避免页面切换时顶部横移。
- 五个参数页签等宽，最小高度 44px、左右内边距 8px；桌面项间距 4px，悬停背景覆盖完整点击区域。

- 次要文字为 `#6b6259`，正常可见文字不小于 12px；Manrope、Cormorant Garamond 和许可证共用 `public/fonts/forme/`。
- 桌面参数栏宽 340px，1000px 以下为 304px；700px 以下上下布局，参数区高 292px，编辑器高度不超过 660px 时为 246px。
- 戒指默认金色，居中距离按画布宽度为 32 或 35；正式编辑器与提案共用此构图，不再另加两档缩放。
- 模组端不做本机自动保存，重置可撤销；保留现有导入、导出与分享能力。

## 验证与收尾

- 项目测试：25 个文件、83 项测试通过；切孔专项与 256 种边界组合通过。
- 生产构建通过，仍有原有的大分包提示。
- 浏览器检查覆盖 1440×900、768×1024、390×844 和 1576×865；材质与参数操作、名称键盘输入、导入对话框均已检查，未实际导入或导出模型文件。
- 独立 finish reviewer 对四尺寸响应式与 A 方案忠实度给出 `disposition: ship`，无 material fixes；这表示本轮复核通过，不表示已部署。
- 证据：`.impeccable/review/desktop.jpg`、`tablet.jpg`、`mobile.jpg`、`user-1576.jpg`。词元与组件记录已合并到 `DESIGN.md` 和 `.impeccable/design.json`。
- 未做手机真机测试，本轮检查不是渲染性能或制造可行性认证。

## 2026-11-04 页签与共享导航修正

- 修复参数页签悬停底色贴字；五项等宽，左右内边距 8px，最小高度 44px。
- 移除模组页隐藏品牌栏、单独改变导航尺寸的规则，两工作空间共用紧凑顶部栏；滚动条出现前后预留相同空间。
- 浏览器实测 320、390、768、1440px 四种宽度：两页顶部位置、宽高与底色一致，没有横向溢出；参数页签点击、悬停、方向键及工作空间切换正常。5 项应用导航/生命周期测试和生产构建通过；构建仍提示原有的大分包。未复跑几何专项，未做手机真机测试，未发布。
- 本次证据：`.impeccable/review/navigation-tabs-desktop.jpg`、`navigation-tabs-mobile.jpg`、`navigation-showroom-desktop.jpg`、`navigation-showroom-mobile.jpg` 与 `navigation-verification.json`。
