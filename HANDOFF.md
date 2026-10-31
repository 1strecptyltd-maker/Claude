# HANDOFF — First Rec. 网站（cheese-portfolio）

> 写于 2026-10-20，用途：从 Mac 本地（Codex 开发）迁到 GitHub，后续在云端继续开发。
> 更完整的审计（逐案例授权、DNS 实测、U0–U11 任务拆分）见 **`docs/HANDOFF-2026-10-17-CLAUDE.md`**。本文是精简入口；两者冲突时，以实际代码和最新实测为准。

## 1. 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | **React 19 + Next.js App Router 兼容 API，跑在 vinext 1.0.0-beta.2 / Vite 8 上**（不是普通 `next build`，`next` 不是常规依赖，别随手升级） |
| 输出 | 纯静态导出：`next.config.ts` 里 `output: "export"`、`images.unoptimized: true` → `dist/client/` |
| 样式 | Tailwind CSS 4（`@tailwindcss/postcss`）+ `app/globals.css`；字体 Newsreader（`@fontsource-variable`） |
| 语言 | TypeScript 5.9；ESLint 9（react / hooks / jsx-a11y / next 插件） |
| 数据 | 内容写在代码里：`app/_data/site.ts`（36 个案例 + 服务 + 设备）。内部 Drive 索引 `app/_data/approved.ts` **不在本仓库**（见第 6 节） |
| 数据库 | **没有接通**。`drizzle-orm` / `db/` / `drizzle.config.ts` / `examples/d1/` 是 Sites 模板留下的 D1 示例，`db/schema.ts` 为空 |
| 模板残留 | `worker/index.ts`（Cloudflare Worker）、`build/sites-vite-plugin.ts`、`.openai/hosting.json`（OpenAI Sites 项目 ID，非凭证，未发布过）、`app/chatgpt-auth.ts`（未使用） |
| 测试 | `node --test tests/rendered-html.test.mjs`（5 项，读构建后的 HTML 做断言） |
| Node | `engines: >=22.13.0`；Docker 用 Node 22；Codex 实测用的是 Node 25.3 |

## 2. 本地运行

```sh
npm ci
cp .env.example .env          # 填 NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_CONTACT_EMAIL
npm run dev                   # vinext dev → http://localhost:3000
npm run lint
NEXT_PUBLIC_SITE_URL=https://www.firstrec.work npm test   # 含一次完整生产构建 + 5 项测试
npm run build                 # vinext build + scripts/normalize-static-export.mjs → dist/client/
```

注意：
- `npm run build` **必须**经过 `scripts/normalize-static-export.mjs`（把 `foo.html` 变成 `foo/index.html`，NAS 上的干净 URL 靠它）。只跑 `vinext build` 会缺这一步。
- 构建会起一个本地回环预渲染服务；沙箱里报 `listen EPERM` / `.vite-temp` 写入失败属于环境问题，不是业务 bug。
- `NEXT_PUBLIC_*` 在构建时写进 HTML，是公开值。上线包必须在**最后一次构建**时带上正式 URL，否则 OG 会回落到 `http://localhost:3000`。

## 3. 现在怎么部署到 NAS

**链路：Cloudflare（firstrec.work 的 DNS + 代理）→ TrueNAS SCALE 上的 Nginx Proxy Manager → Docker 容器 `nginx:1.27-alpine` 提供 `dist/client/` 静态文件。**OpenAI Sites 项目只登记过，从没发布过；Cloudflare Workers 也没在用。

| 项 | 值 |
| --- | --- |
| 公网地址 | `https://www.firstrec.work`（裸域 `firstrec.work` 2026-10-17 实测无解析） |
| 源站 | `http://192.168.74.200:30040`（局域网） |
| NAS 部署目录 | `/mnt/SSD POOL/codexdeploy/codexdeploy/cheese-portfolio` |
| Compose 文件 | `compose.truenas.yaml`：`nginx:1.27-alpine`，端口 `30040:80`，把 `./dist/client` 只读挂载到 `/usr/share/nginx/html`，`./deploy/nginx.conf` 只读挂载为 `default.conf`（干净 URL + 品牌 404，见 `NAS-DEPLOY.md`） |
| 是否用 Docker | **是**，但只用来跑 Nginx；静态文件在 Mac 上构建好再拷过去，NAS 上不构建 |
| `firstrec.com.au` | GoDaddy DNS，用 frameset **框架嵌入** `www.firstrec.work`（不是 301） |
| 线上内容 | 仍是 2026-08-13 的旧版（8 个案例）；本地/仓库是 36 个案例，**尚未上线** |

部署步骤（Codex 记录的流程，2026-10-20 未重新验证）：

```sh
# 1. 在有完整视频素材的机器上（目前是 Mac）构建
npm ci
NEXT_PUBLIC_SITE_URL=https://www.firstrec.work NEXT_PUBLIC_CONTACT_EMAIL=<确认后的邮箱> npm test
npm run lint

# 2. 先备份 NAS 上现有的 dist/client、compose 和代理配置，再把新的 dist/client/ 传到
#    /mnt/SSD POOL/codexdeploy/codexdeploy/cheese-portfolio/dist/client/
#    同时把 compose.truenas.yaml 和 deploy/nginx.conf 传到部署目录（缺 nginx.conf 时 Nginx 起不来）

# 3. 在 NAS 部署目录执行
sudo /usr/bin/docker compose -f compose.truenas.yaml up -d

# 4. 验证首页、嵌套路由、图片/视频、404、OG 域名、联系邮箱；失败就回滚备份
```

其他方案：`Dockerfile` + `compose.yaml` 是"在 NAS 上构建镜像"的通用方案（Node 22 构建 → Nginx，端口 8080），**没实测过**，别和 TrueNAS 的 30040 方案混用。

⚠️ **上线前注意**：本仓库已删掉 `/work/approved/` 内部索引页和 `approved.ts`，但 **Mac 上的原项目里还在**。如果从 Mac 构建部署，仍会把 71 条 Drive 记录导出到 `dist/client/work/approved/index.html`。以后请从本仓库构建；旧 handoff 的 U1 还差一条防回归测试（构建产物里不得出现内部索引/Drive 链接）。

⚠️ 本仓库里只有 6 个已授权案例的图片（见第 6 节），从这里构建出来的站，其余 30 个案例会缺图。在发布状态（U3）做完之前，**不要直接用本仓库构建的结果覆盖线上**。

## 4. 功能状态

### 已完成
- 多页静态站：首页、Work 索引、Services、About、Equipment、Contact
- 36 个案例页（共享模板 `app/_components/CaseStudyPage.tsx`）+ 餐饮集合页 `/work/food-hospitality/`
- 共享组件：`PageShell`、`SiteHeader`、`SiteFooter`、`ContactBand`
- 内容集中在 `app/_data/site.ts`；网页用图已压缩成衍生图放在 `public/portfolio/`
- 静态导出规范化脚本、5 项 HTML 测试、ESLint 通过（2026-10-17 实测：`npm ci` / `npm test` / `npm run lint` / `npm run build` 全部 exit 0，45 routes）
- NAS（TrueNAS + Nginx Docker）部署方案和线上旧版站点

### 未完成 / 待做
- **内部索引隔离**：本仓库已删除 `/work/approved/`、`approved.ts` 和 Work 页上的入口链接；还差防回归测试（U1 剩余部分）
- **发布状态**：只有 6 个案例标了公开授权（Spin Panda、Dr. LeWinn's、INDIBA、Jo Loves、MM Karaoke、NVIDIA），其余 30 个是"内部审核 / 待确认"，但首页仍全量列出 36 个
- 早期路由用 `caseStudies[n]` 数组下标取数，重排数组会让旧 URL 显示错的案例 → 改成按 slug 取
- 首页 6–8 个精选、排序、餐饮合并策略
- 生产配置收口：最终域名已定为 `firstrec.com.au`，但 DNS 尚未统一，切换前仍按 `www.firstrec.work` 构建；联系邮箱已定为 `info@firstrec.com.au`（线上旧版仍是 `hello@cheese.studio`，下次部署后替换）。见 `docs/DECISIONS.md`
- V2（规范 v0.2，原文在 Mac 上的 Codex 目录，未入库）：自托管 Supabase、Admin/CMS、CRM 询盘表单、私有预览链接、媒体管线、模块化案例 blocks、切域——**都还没开始**
- 未做：逐页浏览器视觉 QA、Docker 实测、Node 22 实测、NAS/Cloudflare/GoDaddy 后台配置核实

建议顺序（沿用旧 handoff）：U0 部署基线 → U1 内部索引隔离 → U2 slug 引用 → U3 发布状态 → U4 精选与文案 → U5 生产配置 → 之后再做 V2。

## 5. 环境变量

只有两个应用变量，都是**构建期、公开**的（不是密钥）：

| 变量 | 用处 | 缺省值 |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `app/layout.tsx` 的 `metadataBase`（OG/canonical） | `http://localhost:3000` |
| `NEXT_PUBLIC_CONTACT_EMAIL` | `app/_data/site.ts` 的 `contactEmail` | `info@firstrec.com.au`（2026-10-31 创始人确认，见 `docs/DECISIONS.md`） |

工具变量（非密钥，一般不用设）：`CODEX_SANDBOX`、`WRANGLER_LOG_PATH`、`WRANGLER_WRITE_LOGS`、`MINIFLARE_REGISTRY_PATH`。

Worker 模板里的 `env.ASSETS` / `env.IMAGES` / `env.DB` 是 Cloudflare binding，当前没配置（`.openai/hosting.json` 里 `d1`/`r2` 均为 `null`）。

凭证在哪（只列位置，不含值）：NAS / Nginx Proxy Manager、Cloudflare、GoDaddy 的账号都在仓库之外，由创始人管理；airouter 连接配置在 Mac 的 `~/.config/airouter-kit/ar.env`，**不要拷进仓库**。

## 6. 不在 Git 里的东西

本仓库是 **public**，所以推送前（包括所有历史提交）去掉了下面这些内容。它们都还在 Mac 原项目里：

**a) 内部资料**
- `app/_data/approved.ts`（71 条内部 Google Drive 文件夹 ID）和 `app/work/approved/page.tsx`；`app/work/page.tsx` 里指向它的链接也删掉了
- `docs/PORTFOLIO-INGESTION-2026-08-15-GOOGLE-DRIVE.md` 里的 Drive 文件夹链接被替换成 `(internal Drive link removed)`

**b) 尚未取得公开授权的 30 个案例的图片**：`public/portfolio/` 下这些目录整个没提交
`bentley/`、`chongguang-workshop/`、`eimele/`、`emp-dairy-lactoferrin/`、`geely/`、`hatman/`、`malaymalay/`、`mirror-and-moon/`、`molly-tea/`、`stasis/`、`food-hospitality/`（20 家餐饮）。
`app/_data/site.ts` 里这些案例的文字和图片路径**还保留着**，所以本地/云端开发时这些页面会是坏图。授权确认一家，就从 Mac 拷一家目录进来再提交。
仓库里保留的图片：6 个已授权案例（`spin-panda`、`dr-lewinn`、`indiba-icc`、`jo-loves`、`mm-karaoke`、`nvidia`），品牌素材 `brand/`，`og-*.png`，以及 4 张通用占位图（`blue-current`、`hard-light`、`southbound`、`tidal-vows`，没有被页面引用）。

**c) 视频**：为了满足"排除视频素材和超过 50MB 文件"，以下网页视频**没有提交**，但 `app/_data/site.ts` 引用了它们。在云端构建出的站点这几个视频会 404，部署前要从 Mac 拷回 `public/portfolio/` 对应位置：

| 路径 | 大小 |
| --- | --- |
| `public/portfolio/molly-tea/opening-film.mp4` | 尚不存在，需从 `.mov` 转码（见下方） |
| `public/portfolio/molly-tea/opening-film.mov` | 109 MB |
| `public/portfolio/spin-panda/film.mp4` | 50.4 MB |
| `public/portfolio/indiba-icc/film.mp4` | 28.9 MB |
| `public/portfolio/dr-lewinn/jade-interview.mp4` | 20.7 MB |
| `public/portfolio/geely/launch-film.m4v` | 20.6 MB |
| `public/portfolio/stasis/brand-film.m4v` | 19.1 MB |
| `public/portfolio/jo-loves/film.mp4` | 15.4 MB |
| `public/portfolio/dr-lewinn/ceo-interview.mp4` | 14.0 MB |
| `public/portfolio/dr-lewinn/anniversary-film.mp4` | 12.4 MB |

测试只检查 HTML 里有没有这些路径字符串，不检查文件本身，所以缺视频不影响 `npm test` 通过。

**Molly Tea 转码（QA H2）**：`opening-film.mov` 是 QuickTime 格式，Chrome / Edge / Android / 多数 Firefox 不播放，而且 109 MB 太大。页面现在先给 `opening-film.mp4`（`video/mp4`），`.mov` 只作 Safari 兜底（`app/_data/site.ts` 的 `fallbacks`）。创始人在 Mac 上、`public/portfolio/molly-tea/` 目录里跑一次（`brew install ffmpeg`）：

```sh
ffmpeg -i opening-film.mov \
  -c:v libx264 -preset slow -crf 23 -maxrate 6M -bufsize 12M \
  -vf "scale='min(1920,iw)':-2" -pix_fmt yuv420p -profile:v high \
  -c:a aac -b:a 128k -movflags +faststart \
  opening-film.mp4
```

目标体积与其他片子相近（约 15–30 MB）；超过 30 MB 就把 `-crf` 调到 25–26 再跑一次。H.264 + `yuv420p` + `faststart` 保证所有浏览器能播、能边下边播。MP4 就位后 `.mov` 可以不再部署：能播 MP4 的浏览器不会去请求后面的 `.mov`。

另外没进 Git 的：`node_modules/`、`dist/`、`.next/`、`.vinext/`、`.wrangler/`、`outputs/`、`work/`（旧 ZIP/备份/缓存），以及 Mac 上的原片、原图（在 NAS / Google Drive）。

Mac 源目录：`/Users/cheese/Documents/工作室创业/00-驾驶舱/作品集/cheese-portfolio-site`。那边的本地仓库没有 remote，提交哈希与本仓库不同（本仓库重建了同样两条提交，去掉了上面 a/b/c 三类内容），以后以 GitHub 为准。

## 7. 不能改的约束

英文对外文案；First Rec. 品牌；多页架构；固定暖浅色主题（不做自动 dark mode）；尊重 `prefers-reduced-motion`；不加 scroll listener 和不必要的 JS 动画；不虚构事实、日期、授权或成果；图片按原比例展示（案例 lead/gallery 用 `object-fit: contain`）；原图原片不进网站，只放衍生图。详见旧 handoff 第 9 节。

## 8. 首次在云端接手的检查清单

1. `git config core.hooksPath .githooks`（启用 50MB 拦截钩子）
2. `npm ci && npm run lint && NEXT_PUBLIC_SITE_URL=https://www.firstrec.work npm test`
3. 读 `docs/HANDOFF-2026-10-17-CLAUDE.md` 第 5、7、8 节（授权、任务单元、需要创始人决定的事）
4. 先补 U1 的防回归测试、做 U3 发布状态，再考虑任何部署
