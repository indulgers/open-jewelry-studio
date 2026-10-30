---
name: Ring Laboratory
description: Warm, quiet jewellery inspection and configuration.
colors:
  primary: '#303a2c'
  secondary: '#76643c'
  surface: '#fffdfa'
  background: '#f4f0e8'
  line: '#e5dfd3'
  muted: '#60645c'
  listing: '#ffffff'
  text: '#292d29'
---

# Design System: 戒指实验室

## Overview

**Creative North Star: "珠宝是主角"**

安静、温暖的展陈台。三维物件承担视觉表达；展台可在纯白 Listing 与暖调展陈之间切换。纯白模式用透明画布与纯白页面底，只保留接触阴影；暖调模式是一块跟随相机的棚拍 sweep（顶部纸白、底部暖灰，中心一层很轻的灯池）。界面以白瓷面板和细边线让位给选择、比较与观察。

## Colors

深橄榄色承担主要动作，黄铜色提示选择，象牙白用于控制区域，石灰石色衬托金属反射。颜色不能替代文字标签。

## Typography

正文使用平台中文无衬线字体；预览标题使用宋体衬线。标题与选项文字保持不同层级，不以全大写或装饰性等宽字表达精密感。

## Layout

桌面为宽预览加右侧配置栏；700px 以下变为上下排列。预览先于配置。视角快捷键位于预览底部中央，兼容模式入口与它保持分离。

## Background

默认纯白 Listing：`#ffffff` 页面底 + 透明 WebGL 画布 + 接触阴影，商品图导出压白底，适合商品主图。暖调展台：相机跟随的 sweep 与灯池，用于品牌页。

## Elevation & Depth

界面主要依靠表面色与细边线分区；页面外壳是暖象牙底上的白瓷面板。三维展台的深度来自 sweep 的明暗、接触阴影与金属反射，不给面板或产品添加发光装饰。

## Shapes

选项为轻圆角矩形，金属色样为圆形，所有图标使用一致的细线 SVG。戒臂具有宽内壁、边缘倒角与厚度，不使用简单圆管代替完整戒臂。

## Components

单选框始终关联中文标签；选择状态保留外框提示。展台背景提供纯白 Listing 与暖调展台两档，纯白为默认。保存按钮说明仅保存到本机。观察快捷键显示当前预设。错误提供恢复动作，不清空用户选择。自动旋转默认关闭。

## Do's and Don'ts

- Do 以可检查的真实几何、光照与清晰度改善珠宝展示。
- Do 保留来源与许可证入口。
- Don't 用过度泛光掩盖切工、镶座或法线问题。
- Don't 将视觉比例标为实际克拉、戒围或生产规格。
