---
name: Ring Laboratory
description: White studio photography and a shared jewelry storefront interface.
colors:
  primary: '#233b55'
  secondary: '#233b55'
  surface: '#ffffff'
  background: '#fafbfc'
  line: '#dce2e8'
  muted: '#596575'
  listing: '#ffffff'
  text: '#202b37'
  forme-ink: '#302c29'
  forme-muted: '#6b6259'
  forme-frame: '#f5f3ee'
  forme-surface: '#fffefb'
  forme-line: '#dfd9cf'
  forme-active: '#ede6df'
  forme-accent: '#71394a'
typography:
  forme-brand:
    fontFamily: 'Cormorant Garamond, serif'
    fontSize: '32px'
    fontWeight: 500
    lineHeight: 1
    letterSpacing: '.055em'
  forme-title:
    fontFamily: 'Songti SC, Noto Serif SC, serif'
    fontSize: '32px'
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: '.1em'
  forme-panel-title:
    fontFamily: 'Songti SC, Noto Serif SC, serif'
    fontSize: '23px'
    fontWeight: 500
    lineHeight: 1.4
  forme-body:
    fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, sans-serif'
    fontSize: '14px'
  forme-control:
    fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, sans-serif'
    fontSize: '13px'
  forme-caption:
    fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, sans-serif'
    fontSize: '12px'
rounded:
  forme-control: '2px'
  forme-popup: '4px'
  forme-swatch: '50%'
spacing:
  forme-xs: '4px'
  forme-sm: '8px'
  forme-md: '12px'
  forme-lg: '16px'
  forme-panel: '20px'
  forme-desktop-panel: '28px'
components:
  forme-button:
    backgroundColor: '{colors.forme-surface}'
    textColor: '{colors.forme-ink}'
    typography: '{typography.forme-caption}'
    rounded: '{rounded.forme-control}'
    padding: '0 12px'
  forme-input:
    backgroundColor: '{colors.forme-surface}'
    textColor: '{colors.forme-ink}'
    typography: '{typography.forme-control}'
    rounded: '{rounded.forme-control}'
    padding: '7px 9px'
  forme-tab-selected:
    textColor: '{colors.forme-accent}'
    typography: '{typography.forme-control}'
    padding: '0 8px'
  forme-material-selected:
    backgroundColor: '{colors.forme-active}'
    textColor: '{colors.forme-ink}'
    typography: '{typography.forme-caption}'
    rounded: '{rounded.forme-control}'
    padding: '8px 0 10px'
---

# Design System: 戒指实验室

## Overview

**Creative North Star: "珠宝是主角"**

展台、款式、镶嵌编辑与购物车共用白色、深蓝灰、细边线和宋体标题。镶嵌编辑使用纯白背景、中性面积灯和本地商品棚 HDR。展台保留白底与暖调两种观察背景。

FORME 采用用户选定的 A · 铂纸画廊。珠宝先行。纸白画布、平直参数栏与作品签式信息承载模组编辑，暗红只提示操作和选择；这一视觉已整合到正式 `/#/modules`，尚未发布。

`forme-*` 词元用于模组编辑器内部。共享导航只显示珠宝展台和镶嵌 DIY，模组编辑器可通过已有链接打开。

**Key Characteristics:**
- 主展台保留纯白 Listing 与暖调展陈两种背景。
- FORME 用纸白、细线与平直面板组织编辑，圆形金属色样帮助识别材质。
- 同一真实模型连接材质、花形、尺寸与作品信息，界面变化不代表渲染质量升级。

## Colors

主要操作使用深蓝灰底白字。选中项使用同色边线和浅蓝灰底。FORME 的 `forme-accent` 用于主要动作、选中边线与焦点，`forme-active` 承载选中底色，`forme-frame` 和 `forme-surface` 区分画布与参数区域；`forme-muted` 用于次要说明，颜色不能替代文字标签。

侧车中的色阶仅供文档预览，不扩充运行时色板。

## Typography

主展台正文使用平台中文无衬线字体，预览标题使用宋体衬线。层级保留。标题与选项文字保持区别，不以全大写或装饰性等宽字表达精密感。

FORME 的品牌字使用 Cormorant Garamond，中文标题使用设备宋体，控件使用 Manrope 与设备中文无衬线字体。正文从简。标题与控件的实际字号见词元；品牌在手机上为 25px，画布标题在 1000px 以下为 28px、700px 以下为 26px、380px 以下为 24px。字体与 OFL 许可证位于 `public/fonts/forme/`，设备中文字体会随系统变化。

**The FORME Legibility Rule.** FORME 正常可见文字不小于 12px；数字使用等宽数字，次要文字统一使用 `forme-muted`，不把主展台的历史小字号沿用到模组端。

## Layout

主展台桌面为宽预览加右侧配置栏，700px 以下变为上下排列。预览先于配置。视角快捷键位于预览底部中央，兼容模式入口与它保持分离。

### 主展台背景

默认纯白 Listing：`#ffffff` 页面底 + 透明 WebGL 画布 + 接触阴影，商品图导出压白底，适合商品主图。暖调展台：相机跟随的 sweep 与灯池，用于品牌页。

### FORME

| 条件 | 实际布局 |
| --- | --- |
| 宽度大于 1000px | 左画布、右侧 340px 参数栏；参数栏水平内边距 28px |
| 宽度不超过 1000px | 参数栏宽 304px，水平内边距 22px |
| 宽度不超过 700px | 上画布、下方 292px 参数区；参数内容局部滚动，常用按钮和页签高至少 44px |
| 手机布局且编辑器高度不超过 660px | 参数区缩至 246px，保留上方模型空间 |

顶部导航共用一套字体、底色和选中态，高 64px，手机为 56px。品牌居左，两个入口居中，购物车居右。预留滚动条空间，避免切换页面时横移。FORME 操作栏分别为 68px 和 56px。模型保持可见。戒指居中构图复用 `camera.js`，画布宽度小于 520px 时距离为 35，其余为 32，避免提案再叠加初始缩放。

## Elevation & Depth

界面主要依靠表面色与细边线分区；页面外壳为浅灰白，面板为白色。三维展台的深度来自 sweep 的明暗、接触阴影与金属反射，不给面板或产品添加发光装饰。

**The FORME Quiet Surface Rule.** FORME 常驻面板靠表面色与细边线分区；阴影仅用于浮动导出菜单和对话框，金属色样的渐变只表达材质，不作为页面装饰。

## Shapes

选项为轻圆角矩形，金属色样为圆形，所有图标使用一致的细线 SVG。戒臂具有宽内壁、边缘倒角与厚度，不使用简单圆管代替完整戒臂。

FORME 常驻面板保持平直边缘，控件微圆角、浮层稍圆，数值见 `rounded` 词元。色样为圆形。图标沿用细线 SVG；该界面规范不改变珠宝的几何、光照或着色器。

## Components

主展台单选框始终关联中文标签，选择状态保留外框提示；背景提供纯白 Listing 与暖调展台两档，纯白为默认。自动旋转默认关闭。观察快捷键显示当前预设，错误提供恢复动作，不清空用户选择。

FORME 使用已实现的控件。保持原行为。

- 操作按钮：普通按钮为浅底细边，主要按钮为暗红底，文字按钮用于局部恢复；桌面常规按钮最小高度 36px，手机为 44px。悬停改变底色，焦点为 2px 暗红外框、外偏移 3px，禁用状态降低透明度。
- 参数页签：材质、花形、尺寸、款式、素材；五项等宽，至少高 44px，左右内边距 8px，桌面间距 4px；选中态以暗红文字和 2px 下边线共同标记，材质为初始页。保留键盘页签导航。
- 材质与表面：带名称的圆形金属色样，选中时增加暗红外框和浅选中底；表面处理用文字与勾选提示。默认模型材质为金色。
- 输入与分段选项：输入框保持可见标签和细边线；分段选中项使用浅选中底与暗红文字。作品名称可以直接编辑。
- 编辑记录：不做本机自动保存；重置恢复默认模型与参数，并保留撤销能力。既有导入、导出和分享入口不等同于自动持久保存。
- 状态反馈：参数区反馈与当前操作相邻，错误用文字说明；导入对话框、导出菜单沿用现有行为。状态颜色过渡为 160ms，开关为 150ms，减少动态效果偏好下关闭过渡。

## Do's and Don'ts

- Do 以可检查的真实几何、光照与清晰度改善珠宝展示。
- Do 保留来源与许可证入口。
- Do 让展台、模板页、镶嵌编辑和购物车共用导航、主按钮与选中态。
- Do 保留 FORME 的可见标签、焦点、可撤销重置与局部滚动参数区。
- Don't 用过度泛光掩盖切工、镶座或法线问题。
- Don't 将视觉比例标为实际克拉、戒围或生产规格。
- Don't 把本地整合、浏览器响应式检查或几何预筛选写成已部署、手机真机验证或制造认证。
