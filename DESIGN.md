---
name: "相言"
description: "高定白：单一品牌视觉，纯白底、暖灰商品底、墨黑唯一强调色、直角控件；首页、编辑器、购物车、社区共用。FORME 保留铂纸画廊。"
colors:
  page: "#fff"
  panel: "#fff"
  tint: "#f4f3f0"
  tint-2: "#ebe9e4"
  ink: "#111"
  muted: "#6e6c68"
  faint: "#9a9893"
  line: "#e7e5e1"
  line-strong: "#bdbab4"
  shop-dark-2: "#2a2a2a"
  on-dark-muted: "#bdbbb6"
  error: "#8a2a1f"
  forme-ink: "#302c29"
  forme-muted: "#6b6259"
  forme-frame: "#f5f3ee"
  forme-surface: "#fffefb"
  forme-line: "#dfd9cf"
  forme-active: "#ede6df"
  forme-accent: "#71394a"
typography:
  display:
    fontFamily: "Songti SC, STSong, Noto Serif SC, Source Han Serif SC, SimSun, serif"
    fontSize: "clamp(34px, 3.9vw, 62px)"
    fontWeight: 400
    lineHeight: 1.34
    letterSpacing: ".08em"
  headline:
    fontFamily: "Songti SC, STSong, Noto Serif SC, serif"
    fontSize: "clamp(28px, 2.6vw, 40px)"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: ".06em"
  page-title:
    fontFamily: "Songti SC, STSong, Noto Serif SC, serif"
    fontSize: "clamp(30px, 3.2vw, 46px)"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: ".1em"
  title:
    fontFamily: "Songti SC, STSong, Noto Serif SC, serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: ".08em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif"
    fontSize: "15px"
    lineHeight: 2
  control:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    letterSpacing: ".14em"
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, sans-serif"
    fontSize: "12px"
  eyebrow:
    fontFamily: "Manrope, -apple-system, Helvetica Neue, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: ".24em"
  price:
    fontFamily: "Manrope, -apple-system, sans-serif"
    fontSize: "22px"
    fontWeight: 500
  micro:
    fontFamily: "Manrope, sans-serif"
    fontSize: "9px"
    letterSpacing: ".5em"
  wordmark-mobile:
    fontFamily: "Manrope, sans-serif"
    fontSize: "7px"
rounded:
  surface: "0px"
  button: "0px"
  forme-control: "2px"
  forme-popup: "4px"
  forme-swatch: "50%"
spacing:
  gutter: "clamp(20px, 3.2vw, 48px)"
  section: "clamp(64px, 8vw, 120px)"
  grid-gap: "clamp(12px, 1.6vw, 24px)"
  stage-pad: "clamp(16px, 2vw, 28px)"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.page}"
    typography: "{typography.control}"
    rounded: "{rounded.button}"
    padding: "13px 28px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.button}"
  option-selected:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
  product-tile:
    backgroundColor: "{colors.tint}"
    rounded: "{rounded.surface}"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.page}"
    rounded: "{rounded.surface}"
---

# Design System: 相言

## Overview

**North Star：「高定白」。** 2026-11-19 用户在四个可操作 H5 方向（朱丝栏信笺、夜间展柜、高定白、月白汝瓷）中选定高定白，即行业标准高级珠宝官网的直白执行。四套可切换主题已退役，整站只有一个品牌视觉。

- 纯白底，商品图与三维画布放在暖灰 `tint` 方块上，用 multiply 融合，银色戒指不被染色。
- 墨黑是唯一强调色：主按钮、选中边框、下划线、购物车角标、提示条。
- 所有控件直角，选中靠墨色细框与小圆点，不靠色块。
- 中文标题用宋体常规字重，字距 .06–.1em；导航、按钮、标签用加字距；英文 eyebrow 用 Manrope 大写加宽字距（Signature Pieces、On the Hand、The Atelier）。
- FORME 模组编辑器保持原有铂纸画廊词元，不在本次范围内。

## Layout

- 首页：首屏左文右图，图片贴满右侧到视口边；精选原款四列方块；佩戴图集横向滑动；工坊区左图右三步；品牌故事居中；四格服务入口；暖灰页脚。
- 编辑器：左侧全高白色舞台（顶部减去导航，sticky），右侧 440px 配置栏（≤1100px 为 380px），估价与操作停靠在配置栏底部。手机端舞台在上并 sticky，配置在下，估价栏全宽固定在底部。
- 页面标题（购物车、社区、我的设计、尺寸）共用 `page-title`。

## Motion

- 统一缓动 `cubic-bezier(.16,1,.3,1)`。
- 首屏图片 1.2s 由 1.04 缓入，文案逐行错开 80ms 上浮。
- 商品方块悬停时 1.2s 放大，有佩戴图的款式交叉淡入佩戴图，并浮出「开始定制」。
- 文字链接的下划线悬停时从左向右收起，箭头右移 4px。
- 三维镜头：切换视角、复位、戒头/戒圈页签时，沿球面插值 760ms 移动到目标取景，期间用户一拖动即中断。进入戒头页签切到「镶嵌特写」，进入戒圈页签回到「整体」。
- 舞台首次显示「拖动旋转 · 滚轮缩放」提示，触碰或 9 秒后淡出。
- 估价变化时数字上翻 550ms；购物车角标数量增加时弹跳一次。
- 以上动画在 `prefers-reduced-motion` 下全部关闭，镜头直接跳到目标。

## Do / Don't

- Do：产品图与三维画布只放在白或 `tint` 上；AI 佩戴示意继续明确标注。
- Do：所有可点击控件至少 44px 高，焦点为 1px 墨色外框、偏移 4px。
- Don't：重新引入主题切换、彩色强调或圆角胶囊按钮。
- Don't：用阴影分区；只有浮层（对话框、提示条）使用阴影。


## FORME（未改动）

以下内容沿用上一版，模组编辑器不随高定白改动。

### 保留的展台与 FORME

主展台保留纯白 Listing 与暖调展台两档，纯白为默认，自动旋转默认关闭。照旧使用。纯白底配透明 WebGL 画布与接触阴影，暖调展台的 sweep 与灯池用于展陈，图像导出仍压白底。

| FORME 条件 | 既有布局 |
| --- | --- |
| 宽度大于 1000px | 左画布、右侧 340px 参数栏，参数栏水平内边距 28px |
| 宽度不超过 1000px | 参数栏宽 304px，水平内边距 22px |
| 宽度不超过 700px | 上画布、下方 292px 参数区，参数内容局部滚动，常用按钮与页签高至少 44px |
| 手机布局且高度不超过 660px | 参数区缩至 246px，保留模型空间 |

FORME 操作栏分别为 68px 和 56px，戒指构图复用 `camera.js`，画布宽度小于 520px 时相机距离为 35，其余为 32。保持既有值。外部品牌导航以本节共享导航为准，内部模组布局不受本轮主题重设计影响。

### FORME

- 操作按钮：浅底细边、暗红主要动作和局部恢复文字按钮；桌面最小高度 36px、手机为 44px，焦点为 2px 暗红外框、偏移 3px，禁用状态降低透明度。
- 参数页签：材质、花形、尺寸、款式、素材五项等宽，至少高 44px，暗红文字和 2px 下边线共同标记选中，保留键盘页签导航，材质为初始页。
- 材质与表面：带名称的圆形金属色样，选中增加暗红外框和浅底，表面处理用文字与勾选提示，默认模型材质为金色。
- 输入与分段：输入框保留可见标签和细边线，分段选中项使用浅底与暗红文字，作品名称可以直接编辑。
- 编辑记录：不做本机自动保存；重置恢复默认模型与参数，并保留撤销能力，既有导入、导出与分享入口不等同于自动持久保存。
- 状态反馈：反馈与操作相邻，错误用文字说明；导入对话框和导出菜单保持既有行为，状态颜色过渡为 160ms、开关为 150ms，减少动态效果偏好下关闭过渡。

**The FORME Quiet Surface Rule.** FORME 常驻面板靠表面色与细边线分区；阴影仅用于浮动导出菜单和对话框，金属色样的渐变只表达材质，不作为页面装饰。

**The FORME Legibility Rule.** FORME 正常可见文字不小于 12px；数字使用等宽数字，次要文字统一使用 forme-muted，不把官网的历史小字号沿用到模组端。
