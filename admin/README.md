# 相言模型素材后台

在项目根目录运行 `npm run dev`，在终端显示的本地地址后加上 `/admin/`，例如 [本地模型素材后台](http://127.0.0.1:5173/admin/)。这是单机工作台，数据默认保存在 `~/.xiangyan-model-admin`。用 `XIANGYAN_MODEL_DIR` 可以指定别的本地目录。

1. 上传一份整戒 OBJ。上限为 25 MiB、35 万个三角面。后台保留原始 OBJ，单独生成用于预览的 GLB。
2. 在 3D 中定位连通网格，复核戒头、戒圈、主石、配钻和接合件的分区。原款通过原始文件的 SHA-256 识别并沿用既有分区。新模型只提供候选分区，连成一体的网格需要在建模软件中拆开。
3. 复核接合点 Y 后生成版本。可下载整戒 GLB、独立部件和版本清单。清单保存原件哈希、分区、源坐标接合点和编辑器使用的归一化参数。当前原文件的物理单位仍需确认。

生成的部件版本进入内部部件库。通过款式模板确认发布后，消费者才能看到该组合。

## 部件与款式

「部件库」列出现有原款和已复核的上传版本。整戒和各个部件可以直接打开 3D 预览，也可以下载对应版本的文件。模板可以组合不同来源的戒头与戒圈，主石和戒头配钻必须匹配戒头版本，戒臂铺钻必须匹配戒圈版本。

在「款式模板」选好部件后保存草稿。打开编辑器预览，复核接合及镶嵌，再确认发布。发布会从预览生成封面，并保存所用部件和对应版本。再次编辑会生成新草稿版本，旧发布链接仍可用。本地工作台的发布产物写到 `public/models/managed`，线上工作台的发布会即时更新线上「全部款式」。实物尺寸、制作规则和正式报价仍需走后续流程。

## Cloudflare R2 私有素材

在 Cloudflare 的 R2 创建私有桶，保持公开访问关闭。在「Manage API Tokens」生成只对该桶生效的 `Object Read & Write` 凭据。

在 Vercel 项目的 Production 环境变量里设置以下值。`XIANGYAN_ADMIN_PASSWORD` 用于线上后台登录，至少 32 个字符。环境变量和密钥保存在控制台，勿加入仓库。

```dotenv
XIANGYAN_R2_ACCOUNT_ID=
XIANGYAN_R2_BUCKET=
XIANGYAN_R2_ACCESS_KEY_ID=
XIANGYAN_R2_SECRET_ACCESS_KEY=
XIANGYAN_ADMIN_PASSWORD=
```

在 R2 桶的「Settings → CORS Policy」允许实际网站域名发出 `GET` 和 `PUT` 请求。下面的域名按部署地址调整。

```json
[
  {
    "AllowedOrigins": ["https://open-jewelry-studio.vercel.app"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type"]
  }
]
```

线上后台在 `/admin/`。上传文件由浏览器直接写入 R2。模型、复核版本、草稿和发布记录都保存在私有桶的 `studio/v1/` 前缀下。公开目录只列出每款当前发布的版本。后台草稿和部件预览需先登录。

如果只使用本地工作台，可在项目根目录的 `.env.local` 配置四项 R2 变量，然后重启开发服务。此模式把素材备份到 R2，索引、草稿与本地发布仍保存在本机。仓库中的原款模型和部件在两种模式都可读取。

[R2 桶权限](https://developers.cloudflare.com/r2/api/tokens/) · [R2 跨域设置](https://developers.cloudflare.com/r2/buckets/cors/) · [Vercel 环境变量](https://vercel.com/docs/environment-variables)
