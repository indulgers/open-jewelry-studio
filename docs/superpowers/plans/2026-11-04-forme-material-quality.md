# FORME Material Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保持四照花原型及编辑范围不变的前提下，提高 Web 模组 DIY 的金属质感与运动稳定性，提供真实、同步的前后对照。

**Architecture:** 保留当前 WebGL2 路线与网格生成流程，抽出旧渲染器作为固定基线；候选渲染器使用离线预过滤环境、金属 BRDF 与确定性屏幕空间遮挡。通过既有同源编辑器 iframe 接入候选和基线，在画质验收前保留正式入口的旧版默认值。

**Tech Stack:** 原生 JavaScript ES modules、WebGL2、现有 Manifold WASM、Node、Vitest、Vite；已有 Three.js 仅在环境资源准备脚本中解码 HDR，不接入其运行时渲染器。

**Spec:** `docs/superpowers/specs/2026-11-04-forme-material-quality-design.md`

## Global Constraints

- 原始顶点、面索引、花瓣轮廓、结构和比例保持原样；保留既有形变范围、排列和切孔规则。
- 对相同输入配置，升级前后生成模型的位置和面索引应一致。
- 不移动顶点，不增加倒角、细分、额外戒臂或位移贴图，不合并原始独立部件。
- 不新增模型下载入口或浏览器自动保存，不向第三方上传模型或带模型的截图；调试与对照素材保留在本地。
- 保持当前画布像素比例上限 2，不以降低实际分辨率或缩小模型来换取通过。
- 静止与拖动使用同一材质、曝光和主要渲染路径，不依赖停止几秒后累积采样才能恢复正常，不添加泛光掩盖形体。
- 桌面争取 60 FPS；OPPO Find X8、iPhone 17 的目标浏览器中，单个活动视图稳定旋转 30 秒，中位帧率至少 30 FPS、帧间隔 P95 不超过 50 ms。
- 先完成一个有完整反射和遮挡效果的候选版本，再根据用户对照反馈集中修正一轮；仍不达标转第二条，不以换引擎代替改模。
- 本轮不修改小程序，不推送或部署。文档与实现使用范围明确的本地提交；保留当前未跟踪实验和临时文件。

## Review Focus

1. 首次加载、资源损坏或 WebGL 上下文丢失：可读错误、可重试、保留当前编辑；任务 2/4 验证。
2. 正交/透视、俯视与最近观察距离：遮挡重建正确，不出现轮廓黑边或透明背景污染；任务 3 验证。
3. 连续改尺寸、撤销、隐藏再显示：遮挡使用当前网格，资源释放，恢复只有一个绘制循环；任务 1/4 验证。
4. 同源对照视图的相机同步及单视图测速：不修改生成网格、不把两个视图争用 GPU 的结果当作正式性能；任务 5 验证。
5. 项链、合法自定义 STL 与兼容线稿：继续可用、原限制不变，失败不清空作品；任务 4/5 验证。

---

## 文件边界与固定接口

- `public/forme/index.html`：继续拥有源模型、生成/编辑、撤销与导出；只改渲染器接入、准备状态及对照用视图接口。
- `public/forme/renderer-legacy.js`：从 `5498acc` 取当前旧类，机械抽取，不改其 shader、palette、roughness、色调映射和绘制顺序。文件头注明基线版本。
- `public/forme/render-math.js`：原样抽取 `mat4Perspective`、`mat4Ortho`、`mat4LookAt`、`multiply4`；增加仅用于遮挡重建的 `invert4(matrix): Float32Array`。
- `public/forme/renderer.js`：候选 `WebGLJewelryRenderer`，负责资源、准备、上传、绘制和生命周期。
- `public/forme/render-material.js`、`render-occlusion.js`：分别负责材质程序与遮挡资源/程序，避免把新 shader 全堆回 HTML。
- `scripts/prepare-forme-environment.mjs`：预计算环境与 BRDF 资源。`public/forme/lighting/`：只放生成的灯光资源与来源清单，不放模型。
- `public/render-study/`：前后对照 HTML/CSS/JS，两个同源 iframe；不改变 A 方案提案页。
- `scripts/forme-*.test.js`、`scripts/check-forme-render-geometry.mjs`、`tests/fixtures/forme-render-geometry.json`：数值、生命周期和原型检查。
- `tests/browser/forme-render-checks.html`、`tests/browser/forme-render-checks.js`：开发环境中的真实 WebGL 检查页面，输出可见 PASS/FAIL；不放入 `public` 或生产构建。

渲染器公共约定：`new Renderer(canvas, {getState, onOrbit, onError})`；`camera` 沿用 `camera.js` 的对象形状；`gpu` 保留现有每网格 `material` 字段，兼容现有换色路径；`ready: Promise<void>`、`upload(meshes): void`、`reset(): void`、`setActive(boolean): void`、`dispose(): void`。`getState()` 读取现有 state，渲染器不得修改它。

网格结构沿用 `{positions: Float32Array, normals: Float32Array, indices: Uint32Array, material, name}`；上传不得改动输入数组。`bindCamera(renderer,onOrbit)` 在保留行为和调用方式的同时返回解绑函数；两个渲染器在 `dispose()` 中调用它。

## Task 1: 固定旧版画面与原型基线

**Files:** 创建 `renderer-legacy.js`、`render-math.js`、几何检查脚本及 JSON fixture；修改 `index.html`、`camera.js`；扩展 `scripts/forme-camera.test.js`，创建 `scripts/forme-render-contract.test.js`。

**Interfaces:** 产出上述公共渲染器接口；保留既有 `__FORME__` 方法及 `createMotifs` / `cutRing` 调用边界。旧类的全局 state、palette 和 UI 引用改为构造参数/回调，数学与 shader 不改。

- [ ] **先固定输入与预期。** 从 `5498acc` 读取源 HTML 与当前固定 Manifold 生成 5 个 fixture：默认、`bloom:10,twist:4,depth:120,curve:25`、内径 16、内径 23、`mirror:true,arrange:'alternating'`，均先调用原 `constrain`。只保存配置、源数据摘要、生成位置/面索引的 SHA-256、数组长度及基线版本，不另存模型；另固定旧 shader 字符串摘要及 palette/roughness 值，测试旧版不会跟候选一起变化。测试断言：

```js
expect(candidate.positionsHash).toBe(baseline.positionsHash);
expect(candidate.indicesHash).toBe(baseline.indicesHash);
expect(candidate.vertexCount).toBe(baseline.vertexCount);
```

- [ ] **补生命周期失败测试。** `bindCamera` 解绑后再次触发拖动/滚轮，相机不再改变；`dispose()` 后不再有活动动画帧或监听器。上传前后输入 typed arrays 逐项相等，换色不重新调用几何生成。先运行 `npx vitest run scripts/forme-camera.test.js scripts/forme-render-contract.test.js`，确认新增接口相关测试失败。
- [ ] **机械抽取旧渲染器与数学函数。** 实现公共接口，正式页仍用旧版；为监听器和动画循环增加显式清理。切换页面用 `setActive`，不再由 HTML 直接维护内部 RAF。Canvas 兼容类保留。
- [ ] **验证基线。** 运行前述测试与 `node scripts/check-forme-render-geometry.mjs`。浏览器对照抽取前记录与抽取后画面：相机、尺寸、金属反光与透明背景一致。运行现有 policy/camera 测试，确认 VM 抽取范围未被破坏。
- [ ] **本地提交。** 仅包含本任务明确列出的文件，不加入原有未跟踪目录。

## Task 2: 交付可单独观察的候选金属材质

**Files:** 创建 `prepare-forme-environment.mjs`、`render-material.js`、`renderer.js`、`lighting/environment.json`、`lighting/environment.bin`、`lighting/brdf.bin`；创建 `scripts/forme-environment.test.js`、`scripts/forme-material.test.js`；更新来源说明 `THIRD_PARTY_NOTICES.md`、`package.json`。

**Interfaces:** 脚本导出 `prefilterEnvironment({width,height,data}, {faceSize,samples}): {levels,data}` 与 `integrateBrdf(size,samples): Uint16Array`，供小尺寸测试调用；CLI 才写文件。运行时 `loadLighting(baseURL, signal): Promise<LightingData>` 验证清单和数组长度；`createMetalProgram(gl,lighting): {program,uniforms,dispose}` 负责 shader/纹理。

- [ ] **先写数值与资产测试。** 常量白环境经所有粗糙度层过滤仍为白，误差不超过 0.01；六面接缝方向采样一致；BRDF 系数有限、非负，掠射与 roughness 下限无 NaN。空数据、截断文件和错误版本必须拒绝，不上传不完整纹理。测试使用小尺寸 `faceSize:4,samples:32`；完整生成资产独立验证尺寸与字节数。
- [ ] **运行新增测试，确认缺失实现导致失败。** `npx vitest run scripts/forme-environment.test.js scripts/forme-material.test.js`。
- [ ] **准备真实灯光资源。** 读取现有 `public/environments/catalog-studio.hdr`，复用已安装 HDRLoader 的 Node 解码方式；不改展台使用的原文件。使用确定性 GGX 重要性采样：128×128 六面、8 层（128 至 1）、每 texel 256 样本；level 0 直接采样原环境，其他层 roughness=`level/7`。输出 RGB16F 小端数据，面顺序 +X/-X/+Y/-Y/+Z/-Z；清单包含每层 offset/byteLength/size、版本 1、来源摘要。BRDF 表 128×128、512 样本，RG16F，轴为 NdotV/roughness。`npm run prepare:forme-lighting` 执行生成，运行时只加载已生成资产。
- [ ] **实现金属响应。** 候选程序使用预过滤反射、BRDF 表及多次散射能量补偿；可参照已安装 Three.js `lights_physical_pars_fragment.glsl.js` 的同类计算并保留适用许可。材质输入以线性反射率表示，初始 F0：银 `[.96,.96,.94]`、金 `[.98,.76,.34]`、玫瑰金 `[.96,.62,.46]`、石墨 `[.28,.30,.31]`；抛光 roughness `.16`、柔缎 `.45`，曝光 1。最后统一色调映射与 sRGB 输出，禁止再次 gamma 转换。以上美术数值是校准起点，不是实测合金数据，后续允许只改这些数值进行一轮校准。
- [ ] **接入候选入口。** `?renderer=candidate` 使用新类，默认仍是旧版。新类沿用原 draw/VAO/upload 接口，先做无 AO 的完整材质画面；`ready` 在环境、shader 与初次预热绘制完成后兑现。检查纹理线性过滤和完整 mip 链，不依赖浮点颜色附件扩展。
- [ ] **验证并提交。** 数值测试全绿，完整资产解码正常；在真实浏览器验证四金属和两种表面、WebGL 错误为零、首图与拖动的曝光一致。`npm run build` 通过后本地提交。

## Task 3: 加入稳定的局部遮挡

**Files:** 创建 `render-occlusion.js` 与 `scripts/forme-occlusion.test.js`；修改 `renderer.js`、`render-material.js`、`render-math.js`；创建真实 WebGL 检查页面及脚本。

**Interfaces:** `createOcclusionPass(gl): {resize(width,height), render({meshes,view,projection,inverseProjection}), texture, dispose}`；`texture` 为供材质程序采样的 AO 结果。`meshes` 使用已有 GPU 网格资源，不再生成或更改几何。

- [ ] **先写重建与边界测试。** 透视/正交分别将已知 view-space 点投影到深度，再由 inverseProjection 重建，误差小于 `1e-4`；覆盖相机最近距离 19 和 front/top/right。背景 depth=1 不形成遮挡；平面无邻接遮挡时 AO 接近 1。运行 `npx vitest run scripts/forme-occlusion.test.js`，确认先失败。
- [ ] **实现非累积遮挡。** 全分辨率深度/法线预通道采用 DEPTH_COMPONENT24 与 RGBA8；AO 使用半宽半高缓冲，固定 16 个方向/距离样本、初始半径 0.4 mm、深度偏差 0.03 mm、强度 0.45。进行深度/法线保边平滑和上采样；背景或视口外样本忽略。材质颜色仍按原 DPR 全分辨率输出并保留原 MSAA，不降低主体清晰度。AO 只调节局部间接光，避免抛光反射整片发黑。
- [ ] **完成 GPU 可见检查。** 开发检查页提供“运行渲染检查”按钮：平面、相交遮挡几何、屏幕边缘各自输出像素断言；同一相机连续两帧 `readPixels` 一致，前后台恢复帧与静止帧一致；检查两投影和 resize 后 FBO 完整、无 GL error。只用测试几何，不新增用户模型文件。
- [ ] **验证与提交。** CUA 在检查页读取明确 PASS/FAIL，实际四照花连续旋转检查黑边、爬动和拖尾；数值测试及构建通过后本地提交。若 AO 未达到运动稳定标准，修正此实现，不能用静止累积或拖动时停用 AO 规避验收。

## Task 4: 完成加载、恢复和编辑器兼容

**Files:** 修改 `index.html`、`studio.css`、`renderer.js`；扩展 contract 测试与浏览器检查页面，创建 `scripts/forme-render-lifecycle.test.js`。

**Interfaces:** HTML 内的 `async initializeRenderer(variant): Promise<void>` 负责当前 canvas 与 renderer 的准备/替换；失败保留 state/history/sourceMesh/sceneMeshes，提供 `retryRenderer()`。渲染器 `setActive` 同时尊重工作空间可见性与 document.hidden。

- [ ] **先写恢复测试。** 使用可控资源 Promise 和 RAF 调度替身验证：ready 前不接收拖动；加载失败显示错误与重试；重试不改变模型、历史或材质；连续 active=true 两次只有一个 RAF；dispose 取消 RAF、解绑相机、断开 ResizeObserver 并释放纹理/FBO/VAO/buffer/program。再次运行相关测试确认新增失败。
- [ ] **接入准备反馈。** Canvas 就绪前用局部提示“正在准备材质与光照…”；失败为“材质预览未能载入，请重试”，有真实重试按钮；着色器和资源预热结束后移除提示并允许拖动。不在第一次 pointerdown 才编译或加载资源。
- [ ] **实现恢复路径。** 重试重建 GPU 资源，复用当前生成网格与相机；处理 webglcontextlost/restored，丢失期间停止 RAF。只有不可用的 WebGL 才进入已有线稿兼容模式；需要更换 canvas 才能创建 2D 上下文时同步更新引用与绑定。线稿清楚标记为兼容预览，不声称画质通过。
- [ ] **覆盖编辑与失败场景。** 真实页面操作换色、尺寸、撤销重做、两种投影、线框、隐藏恢复；注入环境加载失败与上下文丢失的测试由开发检查页面按钮执行，检查 UI 能恢复且参数不丢失。合法自定义 STL 使用现有测试素材路径，不上传到外部；保留既有非法 STL 检查与编辑范围。
- [ ] **验证与提交。** `npx vitest run scripts/forme-render-lifecycle.test.js scripts/forme-render-contract.test.js scripts/forme-policy.test.js scripts/forme-camera.test.js` 与构建通过后本地提交。

## Task 5: 真实对照、性能记录与交付判定

**Files:** 创建 `public/render-study/index.html`、`study.css`、`study.js`、`scripts/forme-render-study.test.js`、`docs/forme-material-quality-review.md`；修改 `index.html` 的现有 `__FORME__` 接口及渲染器帧时记录。

**Interfaces:** `__FORME__.getView(): {yaw,pitch,distance,target,projection}` 返回副本；`setView(view): void` 验证有限数值和已有相机边界后复制；`getRenderStatus(): {ready,variant,frames,canvasWidth,canvasHeight,pixelRatio,startedAt,readyAt,firstInputAt,firstInputFrameAt}` 提供只读副本。时间戳使用各自视图的 `performance.now()`，只在同一视图内相减；首次输入只记录 ready 后真实指针位移，不能把 reset 或同步相机算成用户拖动。对照页继续使用原有 `setParam`、`getState`，不暴露新的模型下载功能。`frames` 是就绪后最近 60 秒、至多 10000 个 RAF 时间戳的缓冲，隐藏时清空，不记录模型或持久化；不足 30 秒明确标记样本不足。

- [ ] **先写同步与统计测试。** 修改 getView 返回对象不影响相机；不合法 view 不应用；相同 view 应用到两端后值一致。统计函数 `summarizeFrames(timestamps): {medianFps,p95Ms,durationMs}` 对固定 33⅓ms 间隔得出约 30 FPS、33⅓ms P95，不计首个间隔；隐藏/模式切换后旧样本不参与。跑 `npx vitest run scripts/forme-render-study.test.js` 确认先失败。
- [ ] **制作真实对照页。** 左右 iframe 分别显式使用 legacy/candidate，iframe 自身只露画布，外层共用材质、表面、案例和投影控件。两端使用同一个配置，待生成/准备完成后允许比较；以最后被操作的一侧为相机源，下一帧同步另一侧，避免双向反馈。桌面并排同尺寸，窄屏使用前后切换；提供单视图模式，另一视图明确暂停。背景、构图、DPR 相同，标清“原版 / 候选版”，不美化基线。
- [ ] **采集条件明确的结果。** 用任务 1 的五个案例，检查四金属×两表面；另做项链与合法自定义 STL 回归。按桌面 1440×900、手机浏览器尺寸 390×844 检查；以相同 viewport 和 DPR 单视图测试 old/new，连续旋转 30 秒，显示中位 FPS/P95、画布像素、准备时间与首次拖动响应。并排状态标明不用于正式测速。OPPO 与 iPhone 真机数据未提供时记录“待测”，不能用桌面缩窄窗口替代。
- [ ] **验证原型与完整流程。** 运行 `node scripts/check-forme-render-geometry.mjs`、`npm test`、`npm run build`。在真实浏览器确认首次拖动、缩放、切材质、编辑和停下后立即成像；保存本地同角度截图和条件记录，阅读控制台新错误。模型及截图不上传第三方。
- [ ] **交付候选给用户判断。** 打开并保留本地对照页，指出实际改善与剩余差距；只有用户接受画质后，才将正式模组页默认值切到 candidate，再复查默认入口和发布构建。第一次反馈后允许集中校准一轮；仍不接受或真实性能不达标，则保留 legacy 默认值、记录失败依据，更新 Three.js 后备路线的设计/计划。几何限制单独报告，不擅自改模。
- [ ] **本地提交与记录。** 将实际测试、真机待测项、用户画质结论与是否启用 candidate 写入 review 文档；此阶段不推送、不部署。若用户尚未给画质结论，明确以“候选对照已交付，等待视觉验收”结束，不宣称整个品质升级已验收完成。

## 计划自检与执行建议

源模型不变由任务 1 固定、任务 5 复验；材质/确定性遮挡由任务 2/3 实现；加载恢复和历史保护由任务 4 验证；五项 Review Focus 均有对应检查。只抽取渲染相关代码，保留既有几何测试，不新建通用渲染框架。

建议 Native 执行：由当前代理连续完成这五项相互依赖的渲染任务，最后用独立审阅者检查整个改动。计划尚待用户审阅及执行方式选择；此刻未开始产品实现。
