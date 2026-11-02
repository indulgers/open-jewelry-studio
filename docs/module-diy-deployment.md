# 同一个前端：珠宝展台 + 模组 DIY

现有 Vite 前端增加两个顶层 Tab：`/#/showroom`、`/#/modules`。原有成品、宝石库、结构 DIY 保留在展台；FORME 四照花编辑器随同一份 `dist` 部署到 `/forme/index.html`，通过同源 iframe 隔离两套样式。首次打开才载入，切换保留临时编辑和自定义 STL，隐藏时暂停其动画；展台隐藏时释放 WebGL 场景并保留 React 配置。

保留正交相机、无额外支撑圈、花瓣变形、戒指/项链排列、撤销/重做、JSON/STL/OBJ/PNG 导出。分享链接回到主站的模组 Tab。设计保存在当前浏览器，未增加云端设计存储。

## 本地开发

```sh
npm ci
python3 -m venv .venv
.venv/bin/pip install -r services/forme/requirements.txt
.venv/bin/python -m pip install -r services/forme/requirements-dev.txt
npm run dev:full
```

Vite 自动将 `/api/forme/*` 代理给 `127.0.0.1:8787`。开发代理也接受 `FORME_API_ORIGIN`，它是服务端环境变量，不会写入浏览器。独立 HTML 也使用同域 API，不再访问访客电脑的 localhost。

## 完整部署到一台服务器

```sh
docker compose up -d --build
```

访问 `http://服务器:8080/#/modules`。前端只有一个入口和一份构建，Nginx 将 `/api/forme/*` 转到内网 Python 容器。生产域名/TLS 接入现有反向代理。几何服务不暴露主机端口，单 worker、一次计算一个任务，上传上限 20 MB，七百万体素上限，计算入口每 IP 每分钟 3 次。容器内存上限 2 GB，结果在临时目录保留至多 24 小时并在访问时清理；重启容器会清除结果。没有添加任务队列或云端持久化。

## 继续使用现有 Vercel 前端

原有 `vercel.json` 和部署方式不变，两个 Tab 都进入同一个静态构建。Python/VTK 服务需要单独的容器运行环境，无法仅随 Vite 静态文件运行。

把 `services/forme` 的容器部署到现有服务器/容器服务，开启 HTTPS。将 `deploy/vercel-with-geometry.example.json` 中 `YOUR-GEOMETRY-HOST` 替换成实际服务域名后作为根目录 `vercel.json`，再部署前端。这里使用外部 rewrite 而非 Node Serverless 函数转发，避免将大 STL 放进函数请求体；几何服务对外入口仍应有上传/频率限制。前端与下载链接始终使用主站 `/api/forme/*`。没有服务配置时，普通编辑与预览导出可用，融合操作明确提示服务不可用。

## 验证

```sh
npm test
npm run build
python -m pytest services/forme/test_solid_engine.py
curl http://localhost:8080/api/forme/health
```

体素融合和局部接缝估计沿用 V1.3 算法。封闭连通与厚度门槛独立报告；项链接点专项检查、全局壁厚及铸造认证尚未实现。原仓库资产使用范围不变，参见已有 THIRD_PARTY_NOTICES.md。
