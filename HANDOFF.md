# HANDOFF — First Rec. 网站（cheese-portfolio）

> 写于 2026-10-20，用途：从 Mac 本地（Codex 开发）迁到 GitHub，后续在云端继续开发。
> 更完整的审计（逐案例授权、DNS 实测、U0–U11 任务拆分）见 **`docs/HANDOFF-2026-10-17-CLAUDE.md`**。本文是精简入口；两者冲突时，以实际代码和最新实测为准。
> 状态更新于 2026-10-31：第 1–5、8 节按 U1–U10 和 QA 修复之后的代码改过；对外配置以 `docs/DECISIONS.md` 为准。

## 1. 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | **React 19 + Next.js App Router 兼容 API，跑在 vinext 1.0.0-beta.2 / Vite 8 上**（不是普通 `next build`，`next` 不是常规依赖，别随手升级） |
| 输出 | 纯静态导出：`next.config.ts` 里 `output: "export"`、`images.unoptimized: true` → `dist/client/` |
| 样式 | Tailwind CSS 4（`@tailwindcss/postcss`）+ `app/globals.css`；字体 Newsreader（`@fontsource-variable`） |
| 语言 | TypeScript 5.9；ESLint 9（react / hooks / jsx-a11y / next 插件） |
| 数据 | 内容写在代码里：`app/_data/site.ts`（36 个案例 + 服务 + 设备），发布状态在 `app/_data/publication.ts`（U3）。内部 Drive 索引 `app/_data/approved.ts` **不在本仓库**（见第 6 节） |
| 数据库 | **没有接通**。`drizzle-orm` / `db/index.ts` / `drizzle.config.ts` / `examples/d1/` 是 Sites 模板留下的 D1 示例，`db/schema.ts` 为空。`db/v2-schema.sql` 是 U7 提议的 V2 Postgres schema，只在测试临时建的库里跑，没接任何服务器 |
| 模板残留 | `worker/index.ts`（Cloudflare Worker）、`build/sites-vite-plugin.ts`、`.openai/hosting.json`（OpenAI Sites 项目 ID，非凭证，未发布过）、`app/chatgpt-auth.ts`（未使用） |
| 测试 | `node --test tests/*.test.mjs`：读构建后的 `dist/client/` 和源码做断言（导出边界、slug 路由、发布状态、案例 blocks、QA 修复、`check:public`、V2 schema）。命令见第 2 节 |
| Node | `engines: >=22.13.0`；`.node-version` 锁 22.22.0（2026-10-31 的测试在这个版本上跑）；Docker 用 Node 22；Codex 实测用的是 Node 25.3 |

## 2. 本地运行

```sh
npm ci
cp .env.example .env          # 填 NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_CONTACT_EMAIL；不要在任何 .env 里写 FIRST_REC_INCLUDE_INTERNAL
npm run media:placeholders    # 给缺的照片 / 视频生成占位文件（开发用，不会被提交，check:public 会拦住）
npm run dev                   # vinext dev → http://localhost:3000
npm run lint
NEXT_PUBLIC_SITE_URL=https://www.firstrec.work NEXT_PUBLIC_CONTACT_EMAIL=info@firstrec.com.au npm run build   # 公开构建 → dist/client/
```

测试命令（2026-10-31 实测：公开和内部两种模式都是 56 项，53 通过、3 项按模式跳过、0 失败；数字以后会变，以实际输出为准）：

| 命令 | 做什么 |
| --- | --- |
| `npm test` | 先跑一次完整公开构建（`npm run build`），再跑全部测试。**会覆盖 `dist/client/`** |
| `npm run test:internal` | `FIRST_REC_INCLUDE_INTERNAL=1`：先做内部预览构建，再跑测试。跑完 `dist/client/` 里是**内部版**，不能上传 |
| `npm run test:dist` | 不构建，只测现有的 `dist/client/`。上传前用 `env -u FIRST_REC_INCLUDE_INTERNAL npm run test:dist`，确保按公开模式检查 |
| `npm run check:public` | 上传前检查 `dist/client/`：localhost / http 链接、内部数据泄露、缺文件、路由、域名、联系邮箱（`scripts/check-public-build.mjs`，规则见 `NAS-DEPLOY.md`「Pre-upload check」） |

`tests/v2-schema.test.mjs` 需要本机有 PostgreSQL 二进制（`V2_PG_BIN` 或 PATH），找不到就跳过，并打印 "V2 schema NOT verified"。

注意：
- `npm run build` = `vinext build` → `scripts/normalize-static-export.mjs`（把 `foo.html` 变成 `foo/index.html`，NAS 上的干净 URL 靠它）→ `scripts/prune-unpublished-media.mjs`（公开构建里删掉 `dist/client/portfolio/` 下没被引用的文件；内部预览构建时什么也不做）。只跑 `vinext build` 会缺后两步。
- 公开 / 内部两种构建由 `FIRST_REC_INCLUDE_INTERNAL` 决定（见第 5 节）。`npm run build:internal` / `npm run test:internal` 产出的内部预览含 36 个案例，**永远不要部署**；部署前确认 shell 里没有 export 这个变量，任何 `.env` 文件里也没有。
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
| 线上内容 | 仍是 2026-08-13 的旧版（8 个案例）；本仓库的公开构建是 6 个已公开案例（U3），**尚未上线** |

部署步骤（完整命令、备份和回滚见 `NAS-DEPLOY.md`「Current TrueNAS SCALE deployment」；2026-10-31 只在本地验证过，还没在 NAS 上跑过）：

```sh
# 1. 在有完整视频素材的机器上（目前是 Mac）做公开构建并测试；不要设 FIRST_REC_INCLUDE_INTERNAL
npm ci
env -u FIRST_REC_INCLUDE_INTERNAL NEXT_PUBLIC_SITE_URL=https://www.firstrec.work NEXT_PUBLIC_CONTACT_EMAIL=info@firstrec.com.au npm test
npm run lint

# 2. 上传门槛：对最终要上传的 dist/client/ 再查一次（不重新构建），两条都必须通过，不加 --allow-* 参数
env -u FIRST_REC_INCLUDE_INTERNAL npm run test:dist
npm run check:public -- --expect-site-url=https://www.firstrec.work

# 3. 先备份 NAS 上现有的 dist/client、compose 和 nginx.conf，再把新的 dist/client/ 传到新的同级目录后切换；
#    同时把 compose.truenas.yaml 和 deploy/nginx.conf 传到部署目录（缺 nginx.conf 时 Nginx 起不来）

# 4. 在 NAS 部署目录执行（--force-recreate 必须带，原因见 NAS-DEPLOY.md）
sudo /usr/bin/docker compose -f compose.truenas.yaml up -d --force-recreate

# 5. 验证首页、嵌套路由、图片/视频、404、OG 域名、联系邮箱；失败就回滚备份
```

其他方案：`Dockerfile` + `compose.yaml` 是"在 NAS 上构建镜像"的通用方案（Node 22 构建 → Nginx，端口 8080），**没实测过**，别和 TrueNAS 的 30040 方案混用。`deploy/nginx.conf` 本身在 2026-10-31 用 `nginx:1.27-alpine` 镜像在本地实测过（路由、301、品牌 404、没有 index.html 的目录返回 404 而不是 403、`Server` 头不带版本号），结果见 `NAS-DEPLOY.md`。

⚠️ **上线前注意**：本仓库已删掉 `/work/approved/` 内部索引页和 `approved.ts`，但 **Mac 上的原项目里还在**。如果从 Mac 的原项目构建部署，仍会把 71 条 Drive 记录导出到 `dist/client/work/approved/index.html`。以后请从本仓库构建；`tests/public-export-boundary.test.mjs`（U1）和 `check:public` 会拦下内部索引和 Drive 链接。

⚠️ 发布状态（U3）已完成：公开构建只导出 6 个 `"public"` 案例；`spin-panda`、`dr-lewinn` 由创始人 2026-10-31 确认可以公开（`docs/DECISIONS.md`），Spin Panda 不进首页精选。开发期缺的照片和视频用 `npm run media:placeholders` 生成占位；`check:public` 发现占位文件或缺文件都会失败，真实素材在 NAS 上放好之前不要上线（第 6 节）。

## 4. 功能状态

### 已完成
- 多页静态站：首页、Work 索引、Services、About、Equipment、Contact
- 36 个案例（共享模板 `app/_components/CaseStudyPage.tsx`，统一由 `app/work/[slug]/page.tsx` 生成）+ 餐饮集合页 `/work/food-hospitality/`
- 共享组件：`PageShell`、`SiteHeader`、`SiteFooter`、`ContactBand`
- 内容集中在 `app/_data/site.ts`；网页用图已压缩成衍生图放在 `public/portfolio/`
- NAS（TrueNAS + Nginx Docker）部署方案和线上旧版站点
- **U1 内部索引隔离**：删除 `/work/approved/`、`approved.ts` 和 Work 页入口；防回归测试 `tests/public-export-boundary.test.mjs`
- **U2 slug 引用**：按 slug 取数（`app/_data/project-access.ts`），缺 slug 直接报错；`tests/project-routes.test.mjs`
- **U3 发布状态**：`app/_data/publication.ts` 给 36 个案例逐条记录 `status` / `evidence`；公开构建只导出 6 个 `"public"` 案例，首页 hero、精选、Work、集合页、直接路由一致过滤，`scripts/prune-unpublished-media.mjs` 删掉未引用的媒体；首页精选暂用占位（`featuredProvisional`，`docs/DECISIONS.md`）；`tests/publication.test.mjs`
- **U5 工具部分**：`.node-version`（22.22.0）、`npm run check:public`（`scripts/check-public-build.mjs` + `tests/check-public-build.test.mjs`）、`npm run test:dist`、`NAS-DEPLOY.md` 里的上传前检查和备份 / 回滚步骤；联系邮箱 `info@firstrec.com.au` 已写进 `app/_data/site.ts`、`compose.yaml`、`Dockerfile`、`.env.example`
- **U6**：`docs/Website-V2-Development-Spec-v0.2.md`（**仓库内重建摘要，不是原文**）+ `docs/V2-ARCHITECTURE-ADR.md`（Proposed，D1–D8 均未签批）
- **U7**：`docs/V2-DATA-CONTRACT.md`、`db/v2-schema.sql`、`scripts/export-v2-seed.mjs`、`tests/v2-schema.test.mjs`（Proposed；只在测试临时建的 Postgres 里验证，前提 D1 未批准）
- **U8 模块化案例**：`app/_components/CaseStudyBlocks.tsx`，Spin Panda 作为示例；`tests/case-blocks.test.mjs`
- **U9 / U10 设计**：`docs/V2-INQUIRY-API.md`、`docs/V2-PRIVATE-PREVIEW.md`（只是设计，Proposed，没有任何实现）
- **QA 修复**（`docs/QA-REPORT-2026-10-30.md`）：H1 由 U3 解决（hero 只取公开案例）；H2、M1、M2（品牌 404 + `deploy/nginx.conf`）、M3、L1、L2 已修，测试 `tests/qa-fixes.test.mjs`，前后截图 `docs/qa-screenshots/fixes/`
- 测试和 lint：2026-10-31 实测 `npm test`、`npm run test:internal`、lint 全部通过（命令见第 2 节）

### 未完成 / 待做
- 其余 30 个案例仍是 `"internal-review"`；`spin-panda`、`dr-lewinn` 已由创始人口头确认（2026-10-31），书面授权记录以后补进 `docs/`
- **U4**：创始人选定首页 6–8 个精选和顺序、餐饮合并策略、文案定稿
- **QA 剩余项**：M4 后半（已公开案例仍显示 "Public display authorised / … to confirm" 这类 `mediaNotice`，需要改成面向访客的文案或不渲染）、L3（`/work/` 缩略图 `cover` 裁切，等设计决定）
- **U5 剩余**：DNS 尚未统一，切换前仍按 `www.firstrec.work` 构建；线上旧版仍是 `hello@cheese.studio`，下次部署后替换。见 `docs/DECISIONS.md`
- **上线前**：从 Mac 拷回第 6c 节的视频，`check:public` 不加 `--allow-*` 通过后再部署；`deploy/nginx.conf` 还没在 NAS 上跑过；`Dockerfile` 镜像构建没实测
- V2 实现（自托管 Supabase、Admin/CMS、询盘 API、私有预览、媒体管线、切域）：只有 U6 / U7 / U9 / U10 的提议文档，ADR 未签批前**不动基础设施**；v0.2 规范原文仍在 Mac 上，未入库
- U11 发布前验收记录（`docs/RELEASE-CHECKLIST.md`）还没建
- 未做：NAS/Cloudflare/GoDaddy 后台配置核实

建议顺序：U4 精选（Spin Panda 已确定不进首页）→ 开发完成后在 NAS 上放入真实素材 → 按第 3 节的门槛部署 → U11 记录 → V2 签批后再拆实现单元。

## 5. 环境变量

应用变量都是**构建期**的（不是密钥）；两个 `NEXT_PUBLIC_*` 会写进 HTML，是公开值：

| 变量 | 用处 | 缺省值 |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `app/layout.tsx` 的 `metadataBase`（OG/canonical） | `http://localhost:3000` |
| `NEXT_PUBLIC_CONTACT_EMAIL` | `app/_data/site.ts` 的 `contactEmail` | `info@firstrec.com.au`（2026-10-31 创始人确认，见 `docs/DECISIONS.md`） |
| `FIRST_REC_INCLUDE_INTERNAL` | 只有等于 `1` 时做内部预览构建（36 个案例），其他值或不设都是公开构建。`vite.config.ts` 构建时内联；`scripts/prune-unpublished-media.mjs` 和测试也读它 | 不设（公开构建） |

`FIRST_REC_INCLUDE_INTERNAL=1` 只用于本地审阅：`npm run build:internal`（构建）、`npm run test:internal`（构建 + 测试）。**内部构建永远不部署**。部署构建时不要在 shell 里 export 它，也不要写进任何 `.env` 文件；测试按同一个变量判断模式，设成 `1` 时内部构建也会通过。上传前用 `env -u FIRST_REC_INCLUDE_INTERNAL npm run test:dist` 检查。

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
`app/_data/site.ts` 里这些案例的文字和图片路径**还保留着**。开发时运行 `npm run media:placeholders` 给缺的文件生成占位图 / 占位视频（带 `FIRST-REC-PLACEHOLDER` 标记，路径都在 `.gitignore` 里，不会被提交）；真实素材在 NAS 部署时再放进来（`docs/DECISIONS.md` 2026-10-31）。
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

测试只检查 HTML 里有没有这些路径字符串，不检查文件本身，所以缺视频不影响 `npm test` 通过；`npm run check:public` 会把缺的文件报成错误（见第 3 节）。

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
2. `npm ci && npm run lint && NEXT_PUBLIC_SITE_URL=https://www.firstrec.work NEXT_PUBLIC_CONTACT_EMAIL=info@firstrec.com.au npm test`，再跑一次 `npm run test:internal`
3. 读 `docs/DECISIONS.md`（创始人已确认的配置和决定），再读 `docs/HANDOFF-2026-10-17-CLAUDE.md` 第 5、7、8 节（授权、任务单元、需要创始人决定的事）
4. 部署前按第 3 节的门槛来：公开构建、`test:dist` + `check:public` 不加 `--allow-*` 通过；跑过 `test:internal` 之后 `dist/client/` 是内部版，必须重新做公开构建
