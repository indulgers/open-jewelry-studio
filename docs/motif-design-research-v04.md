# 相言 Motif Lab V0.4 · 市售珠宝研究与构型体系

## 研究范围

以用户提供的“搜索四叶草戒指”六款商品卡片作为设计形态观察，不将商品结果图、第三方渲染或商标当作项目素材。结合品牌官方产品说明与 GIA 的镶嵌教育资料，建立**独立原创的造型语法**。

参考事实与来源：

- Van Cleef & Arpels [Vintage Alhambra Malachite ring](https://www.vancleefarpels.com/us/en/collections/jewelry/alhambra/vcaro3qm00---vintage-alhambra-ring.html)：绿纹嵌片、中央钻石、细金珠边缘；材质和保持轮廓的关系
- [Vintage Alhambra Carnelian ring](https://www.vancleefarpels.com/us/en/collections/jewelry/alhambra/vcard40800---vintage-alhambra-ring.html)：红玉髓版本，证明主题造型与嵌片材质可以解耦
- [Guilloché Alhambra ring](https://www.vancleefarpels.com/us/en/collections/jewelry/alhambra/vcarp6i300---vintage-alhambra-ring.html)：金属雕纹与整片嵌片属于不同工艺
- [Frivole single-flower ring](https://www.vancleefarpels.com/us/en/collections/jewelry/flora/frivole/vcarpjmq00---frivole-ring-1-flower-small-model.html) 和 [Frivole pendant](https://www.vancleefarpels.com/us/en/collections/jewelry/flora/frivole/vcarp2v100---frivole-pendant-small-model.html)：花瓣可为立体雕塑或密钉镶，戒指与项链应有不同佩戴主体
- [GIA Ring Setting Guide](https://4cs.gia.edu/en-us/blog/guide-to-ring-settings/)：镶嵌方式（爪镶、包镶、密钉、槽镶等）不同于整体构型（单石、halo、分叉戒臂）
- [GIA Melee Quality Assurance](https://www.gia.edu/design-with-melee)：小钻镶嵌需要金属余量、稳定的爪尖接触、合理的石间距；GIA 资料举例密钉或珠镶周围至少保留约 0.50 mm 金属边，但具体制造依合金、工艺、宝石及工厂而异

## 六套视觉案例不等于六个固定 CAD

| 本项目原创方案 | 主题轮廓 | 工艺层 | 镶石方式 | 戒臂或项链构型 | 视觉关键词 |
|---|---|---|---|---|---|
| 红玉髓·金珠 | 四叶草 | 彩色嵌片、金属台阶、双层包边 | 中央小钻视觉爪镶 | 经典素圈 | 朱红 / 细金珠 / 暖金 |
| 绿纹·金珠 | 四叶草 | 程序化孔雀石纹理嵌片 | 中央小钻 | 经典素圈 | 墨绿 / 脉络 / 材质对比 |
| 放射纹·金质 | 四叶草 | 金属面放射状细纹 | 中央石（可选） | 经典素圈 | 金色 / 光线 / 结构秩序 |
| 银白·群钻花簇 | 花朵 | 单独金属基座 + 群簇石座 | 大小不等的独立刻面小钻 | 戒臂侧石 | 冷白 / 多石反射 / 层次 |
| 花瓣·满钻 | 五瓣花 | 花瓣形金属面 + 分散镶石座 | 密钉小钻、中心主石 | 分叉肩位 | 玫瑰金 / 错层 / 花形 |
| 金属·立体花瓣 | 五瓣花 | 五个有体积的弯曲金属花瓣 | 一颗中心爪镶 | 顶部吊环项链 | 雕塑 / 弧面 / 留白 |

用户可重新组合：保留源 OBJ 主题轮廓，自由选允许的工艺、金属与配色，再给戒指或项链选择实际佩戴接口，而不是把一个完整 OBJ 改材质后当不同商品。

## 编辑器结构分层

```txt
Product (Ring / Necklace)
 └─ Motif silhouette (7 sourced OBJ outlines)
     ├─ Surface technique: Inlay / Guilloché / Pave / Sculpted / Cluster
     ├─ Metal base + perimeter + gold bead option
     ├─ Mounting and diamond instances
     └─ Wearable adapter
          ├─ Ring: classic comfort-fit / split shoulder / pavé shoulders
          └─ Necklace: two top-shoulder links / single top bail
```

源代码：
- `designGrammar.ts`: 相容性矩阵、六个 presets、轮廓边距与镶石位置规划
- `designGeometry.ts`: 沿轮廓收束的放射纹和有厚度的闭合金属花瓣
- `DesignedSurface.tsx`: 不同工艺的真实三维装配，分离小钻、独立金属座与小爪
- `ShankStyles.tsx`: 分叉与侧石戒臂的附加装配表现
- `mineralInlays.ts`: 矿物外观材质（程序化、非实物矿物扫描）
- `WearableAdapters.tsx`: 戒臂与双侧/顶部项链连接
- `designGrammar.test.ts`: 六套案例构型相容性、镶石在轮廓内、金属边距、石间距、闭合花瓣等规则测试

## 关键交互策略

1. 先选择戒指或项链、主题轮廓；工艺选择器根据当前轮廓禁用不相容选项
2. 也可以直接选择六个原创搭配，自动填入主题、材质、工艺、戒臂及连接方式
3. 选择密钉镶会生成受边界限制的镶石点阵，附金属小座和小爪；并非贴图贴白点
4. 选择放射纹会用原始轮廓裁切雕纹辐射长度；当前纹路为可视几何线，并未实际在金属中切槽
5. 选择立体花瓣只适用于 flower/blossom，生成独立闭合花瓣；没有假装每个 OBJ 都能自动变成此种结构
6. 只有经典素圈支持当前 Manifold 融合初筛；分叉戒臂与侧石戒臂不能使用素圈报告冒充验证

## 制造与设计之间的明确边界

- 产品真实度：可编辑装配与结构化组合已经进入 MVP。仍缺真实珠宝 CAD 的“镶座切削”“嵌片止口”“石座承托”“小钻爪的接触力与倒圆”，不能直接用于真实订制下单
- Gems：部分 3D stone seat 为独立可视实体，暂未对金属主体进行 CSG 差集；不能声称石头已被机械锁固
- Inlay：红玉髓与孔雀石用程序纹理模拟，不是扫描；没有考虑脆性、纹理方向和实物材料公差
- Metal：仅经典素圈的戒臂/连接肩部执行基础 Manifold，并不是对全部新工艺完成布尔融合
- Necklaces：两侧连接与单顶部吊环有区分，但细链仅局部建模，不模拟真实链长、动力学和颈部坠落曲线
- IP：设计规则用于原创相言款式。品牌商标、具体产品精确外观不作为商业模型资产

下一阶段应把工艺模型和制造层连接：一体金属通用接口、石座布尔差集、宝石镶爪接触、链环干涉、不同工艺的局部壁厚扫描与可制造性等级。
