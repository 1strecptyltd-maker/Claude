# First Rec. 网站交接：Claude / airouter

日期：2026-10-17（Australia/Sydney）
目标仓库：`/Users/cheese/Documents/工作室创业/00-驾驶舱/作品集/cheese-portfolio-site`
审计基线：`8a4472ec3925a3e62d6c3c164e699de6fa5ba1a3`（main）
范围：只读现状审计；唯一新增并提交的文件是本文。没有修改业务代码、更新服务器、发布、修改 DNS、上传素材或派发开发。

## 1. 当前状态与本地/线上差异

### Git 与提交后的工作

- `git status --short`、`git diff`、`git diff --cached` 在审计开始时均为空。只有一条提交：2026-09-01 09:11:12 +1000，`Ingest five portfolio case studies`。
- `git reflog` 也只有该 initial commit；`git remote -v` 无输出，没有配置远端，不能声称已推送或远程备份。本文提交会成为第二条提交。
- 没有未提交的受跟踪代码或可见未跟踪业务文件；不能据此断言提交后从未工作。忽略的 `.wrangler/registry/` 四个文件 mtime 为 9 月 1 日 10:15，晚于提交，说明存在提交后的工具状态更新，不能证明有业务改动或部署。
- `dist/` 最新生成记录为 9 月 1 日 09:08；`outputs/`、`work/` 有历史 ZIP、备份和缓存，均不受 Git 跟踪，不能作为最新发布包。未发现这些目录中比提交更新的业务产物。mtime 不是完整操作日志。
- 功能上的未完成：公开/内部内容尚未隔离、首页仍全量罗列、V2 后台与数据迁移未开始、生产域名及邮箱配置未收口；不是发现了未提交的“半份代码”。旧 README、handoff 和 brief 的项目数、测试数与 Git 状态已过期。

### 2026-10-17 线上实测

用公开 DNS、HTTP GET/HEAD 和已知 NAS Web 地址只读核实。联网查询在沙箱外获准执行；最初沙箱内 DNS 失败不代表网站宕机。

| 检查对象 | 实测结果 | 解释 |
| --- | --- | --- |
| `https://www.firstrec.work/` | HTTP 200，`server: cloudflare`，`x-served-by: www.firstrec.work`，Last-Modified 为 2026-08-13 03:17:19 GMT | 线上仍是旧静态版 |
| `https://firstrec.work/` | 本机 curl 无法解析；A/AAAA 查询未返回记录 | 裸域当前未在本次解析链路正常工作；不能与 www 混用 |
| `http://192.168.74.200:30040/` | HTTP 200，`nginx/1.27.5`，同一 Last-Modified，首页同样 8 案例 | 与 NAS 部署记录一致；未登录核实当前 Docker mount 或反向代理配置 |
| `https://firstrec.com.au/`、`https://www.firstrec.com.au/` | GET 均 200，352 字节 frameset，`frame src="https://www.firstrec.work"` | 是遮罩/框架转发，不是 301，也不是独立 V2 网站。HEAD 返回 405，不能以 HEAD 判定 GET 不可用 |
| `https://www.firstrec.work/work/approved/` | 404 | 本地内部索引目前未在该线上路径可见；不要因本地存在就宣称已泄露 |

线上首页的 8 个案例：Geely Australia、Molly Tea、Stasis Clinic、Bentley、Eimele、Chongguang Workshop、Hatman、MalayMalay。线上仍使用 `hello@cheese.studio`。本地首页遍历全部 **36** 个 `caseStudies`，比线上首页多 28 个；这是首页对比，不等于穷举线上全部文件。

本地新增部分包括 Mirror & Moon、Spin Panda、20 个 Food + hospitality 项目、Dr. LeWinn’s、INDIBA、Jo Loves、MM Karaoke、NVIDIA、EMP Dairy / Lactoferrin。源码有 **44 个 page.tsx**：6 个核心页面、36 个案例页、2 个额外索引/集合页；构建日志 45 routes 包含框架生成页面，实际输出 45 个 HTML（44 个页面加 404）。

没有完成浏览器逐页视觉对比、全站线上爬取或线上/本地逐文件哈希一致性认证。公开首页和 NAS 首页字节哈希不同，Cloudflare 等中间层可能改写内容，因此不声称二者逐字节相同。

## 2. 部署方式（接手优先阅读）

### 当前平台判断及证据等级

**现有生产链路有力证据指向 Cloudflare 代理 + TrueNAS/Nginx 静态站；关联的 OpenAI Sites 项目没有部署。**

1. `NAS-DEPLOY.md` 记录源站 `192.168.74.200:30040`、`30040:80`、目录 `/mnt/SSD POOL/codexdeploy/codexdeploy/cheese-portfolio`。本次该地址实际提供 nginx 旧首页，与公网内容、时间戳和案例集合相符。
2. `compose.truenas.yaml` 用 `nginx:1.27-alpine`，将 `./dist/client` 只读挂载到 `/usr/share/nginx/html`。公网响应确有 Cloudflare 代理特征。
3. 通过 Sites `get_site` 实时查询 `.openai/hosting.json` 中的项目：`latest_version_number=0`、`current_preview_url=null`、`current_live_url=null`。该项目只是登记过，不是当前生产站。只读响应未写入本文或仓库；不得复制其中任何认证字段。
4. 未登录 NAS、Nginx Proxy Manager 或 Cloudflare 控制台，不能确认实际运行的 compose revision、完整路由规则、DNS origin IP 或账户归属；当前源码中的 NAS 配置是可执行方案，尚不是远端运行配置的导出。

### `.openai/hosting.json` 与 `.wrangler`

- `.openai/hosting.json` 受 Git 跟踪；保存 Sites project ID，当前 `d1:null`、`r2:null`。ID 是项目标识，不是部署凭证，也不是 NAS 绑定或 DNS 配置。没有 `static.directory`，若未来用当前 Sites 静态托管流程，应按当时工具契约明确 `dist/client`，不能盲目用 Worker 模式发布。
- `vite.config.ts` 使用 vinext、Sites 自定义打包插件、Cloudflare Vite plugin。`build/sites-vite-plugin.ts` 会把 hosting manifest 和 drizzle 目录拷入 `dist/.openai/`。
- `.wrangler/` 被忽略，用于本地 Wrangler/Miniflare 日志、registry、生成配置。`.wrangler/deploy/config.json` 指向 `../../dist/server/wrangler.json`。这些文件存在不证明部署过 Cloudflare Workers/Pages。
- `dist/server` 的 Worker 产物与 `worker/index.ts` 是模板路径；当前 NAS 只需 `dist/client/` 静态文件。

### DNS 与域名当前指向

| 域名 | 实测 DNS | 管理判断 |
| --- | --- | --- |
| `firstrec.work` zone | NS `lucy.ns.cloudflare.com`、`santino.ns.cloudflare.com` | 权威 DNS 在 Cloudflare；具体登录账户未验证 |
| `www.firstrec.work` | A `172.67.207.185`、`104.21.66.224` | Cloudflare 边缘地址，不能用它识别源站公网 IP |
| `firstrec.com.au` zone | NS `ns07.domaincontrol.com`、`ns08.domaincontrol.com` | 权威 DNS 为 GoDaddy DomainControl；注册商、控制账户与 forwarding 面板未登录确认 |
| `firstrec.com.au` | A `3.33.251.168`、`15.197.225.128` | GET 返回到 www.firstrec.work 的 frameset |
| `www.firstrec.com.au` | CNAME `firstrec.com.au` | 同样框架转发 |

这些是审计时刻结果。V2 规范要求 `.com.au` 为 canonical、`.work` 301 到 `.com.au`，当前尚未实施。不要在核实 DNS zone、回滚记录和新站验收前切域。

### 不依赖 Codex 的重新部署路径

**可以脱离 Codex 构建并部署到既有 NAS。** Node、npm 和静态文件服务不依赖 OpenAI 账户。建议操作顺序（本文没有执行远端写入）：

```sh
npm ci
NEXT_PUBLIC_SITE_URL=https://www.firstrec.work NEXT_PUBLIC_CONTACT_EMAIL=<confirmed-email> npm test
npm run lint
```

`npm test` 已包含生产构建；环境变量必须在最后一次构建时提供。不要在它之后用缺省变量再跑一遍 build 然后部署。待生产域名切换时才将 SITE_URL 改为正式 `.com.au`。

- 先处理第 4/5 节的内部信息与授权风险，确认发布清单。
- 备份 NAS 当前 `dist/client`、compose 和代理配置；将验证过的 `dist/client/` 发布为新的 release 目录，保留回滚副本，建议采用原子切换，禁止直接覆盖唯一线上副本。
- 进入 NAS 已记录部署目录，按实际 mount 核对后运行：

```sh
sudo /usr/bin/docker compose -f compose.truenas.yaml up -d
```

- 验证首页、嵌套路由、CSS/JS、图片/视频、404、OG 正式域名与联系邮箱；确认没有内部 Drive 索引和未批准素材；失败回滚。仅运行 compose 不会自动生成或上传最新静态内容。
- `Dockerfile` 也是独立方案：Node 22 alpine 构建、Nginx 提供静态产物；本次没有实测 Docker 构建。`compose.yaml` 为通用 8080 部署，TrueNAS 文件使用 30040，勿混淆。

若改用 Sites，需要有该项目访问权的 Sites connector、源仓库临时凭证、保存版本及部署工具；普通 Claude/裸终端不能仅凭 project ID 调用这套流程。可保留 Codex/Sites 作为发布入口，或继续 NAS 静态部署；也可另行规划自己的 Cloudflare 静态托管/CI，但那是新迁移方案，不是已存在的配置。不要创建平行 Sites 项目或擅自迁移 DNS。

### 凭证存放位置（只列位置，不含值）

- 本地应用环境文件约定为忽略的 `.env*`；目前观察到 `.env.example`，没有确认实际生产 `.env`。
- Sites 凭证由连接器会话/按需源仓库凭证提供；不是 `.openai/hosting.json`。
- NAS/反向代理、Cloudflare、GoDaddy 的凭证实际保存位置未核实，需创始人交接账号访问或密码管理器条目，不能编造路径。
- airouter 的连接设置在 `~/.config/airouter-kit/ar.env`，操作规则在 `~/.config/airouter-kit/LOCAL.md`；不要将这些文件复制进站点仓库。

## 3. 构建与测试实测

为保持原仓库只读，在工作目录 `work/audit-repo/` 创建完整隔离副本，排除 Git、旧依赖和构建/备份目录；对原仓库业务/配置文件逐字节核对，副本一致。安装与构建只改变副本及独立 npm 缓存。

| 项目 | 本次结果 |
| --- | --- |
| Node / npm | `v25.3.0` / `11.7.0` |
| 项目 engines | Node `>=22.13.0`；Docker 使用 Node 22；本次未另测 Node 22 |
| `npm ci --cache /private/tmp/firstrec-audit-npm-cache --no-audit --no-fund` | exit 0，474 packages；两个 esbuild-kit deprecated 警告；未运行漏洞审计 |
| `NEXT_PUBLIC_SITE_URL=https://www.firstrec.work npm test` | exit 0，45 routes / 0 skipped，5 tests passed / 0 failed |
| `npm run lint` | exit 0，无报告错误或警告 |
| `npm run build`（独立再测） | exit 0，45 routes / 0 skipped；此轮无生产变量，仅验证构建能力，不能作为上线包 |
| 结构化媒体路径检查 | `site.ts` 引用的 `/portfolio/` 字符串路径均存在，无缺失 |

测试实际内容：`tests/rendered-html.test.mjs` 的 5 项测试读取静态 HTML 和部分源文件，检查 22 条列举页面的标题/导航/无占位内容、元数据/字体/静态导出/reduced-motion/浅色主题、部分旧案例及新增案例媒体和授权文案。它不是“测试了全部 44 页面”的证明；食物案例大多没有逐页断言。

未覆盖：真实授权、内部数据隔离、全站链接/HTTP/视频解码、全部图片尺寸/非零字节、浏览器水合与控制台、键盘/屏幕阅读器、视口截图、网络性能、NAS/Docker 实际部署、数据库/CRM/备份恢复。构建通过不代表可公开发布。

审计中第一次副本同步的排除规则误排除了 `app/work`，产生 6 routes 与 ENOENT 测试失败；已改为根目录限定排除，逐文件核对后完整重跑，上表仅报告完整副本的结果。这是审计副本错误，不是业务代码缺陷。原仓库内一次只读检查调用构建遇到沙箱写入限制，未据此修改权限或业务代码。

## 4. 代码结构与数据库现状

- `app/_data/site.ts`：`CaseStudy`（slug、client、category、discipline、scope、summary、image/alt、role、challenge/response/outcome、mediaNotice、gallery、film/films 等），另有 services、equipment、contactEmail。当前 36 个案例。授权只是自由文本，缺少正式发布状态、事实/版权核实字段、featured 排序和多维 taxonomy。
- `app/_data/approved.ts`：71 条 Drive 源文件夹索引，包含 `id/name/client/projectType`，页面根据 id 构造 Drive URL；文件头明确 ingestion approval 不等于 public clearance。不要复制其 URL 到交接或公开系统。
- 共享模板 `app/_components/CaseStudyPage.tsx`：Hero、事实、固定 Challenge/Response/Value、视频、图库；尚非 V2 模块化 block renderer。`PageShell`、`SiteHeader`、`SiteFooter`、`ContactBand` 提供共用结构。
- 路由：`/`、`/work/`、`/services/`、`/about/`、`/equipment/`、`/contact/`；`/work/food-hospitality/` 为集合；`/work/approved/` 为内部索引；其余 36 条案例路由见下一节。没有 CMS admin、CRM、私密 preview 或工作中的 API。
- 多个早期路由用 `caseStudies[n]`，后期用 `.find(slug)`。重排数组可能让旧 URL 静默展示错误案例。策展应先脱离数组顺序依赖；不能直接把数组排序作为首页精选实现。
- `/work/approved/` 无认证，Work 页面还提供入口。本次完整构建已实际生成 `dist/client/work/approved/index.html`，确认风险确实存在于产物。静态导出会包含完整内部记录。`noindex` 和隐藏导航不能保护内容；上线前必须移出公开构建，并审计 HTML、客户端 JS/RSC payload 和旧部署残留。复制整个 public 目录也会继续发布未展示的素材，不能只检查可见链接。
- `db/schema.ts` 空；`db/index.ts` 是 `getDb()` 的 D1 getter，当前没有业务调用者；`drizzle.config.ts` 为 SQLite schema 生成配置。`db:generate` 生成迁移文件，不创建远程 DB、不执行迁移、更不提供 CMS。
- `drizzle-orm`、`examples/d1/`、`worker/index.ts`、`app/chatgpt-auth.ts` 是预留/模板设施，不是已运行的数据库或认证。D1/R2 bindings 为 null；没有 Supabase/PostgreSQL 连接。V2 规划自托管 Supabase，不能把 D1 示例直接当最终数据库架构。

## 5. 逐案例授权状态

分类中的“已授权可公开”表示仓库已有 public-display 标记；不意味着所有角色、客户关系、日期、肖像、署名、音乐或后加素材都得到额外授权。文件夹名、CSV approved、已经出现在旧线上站，都不能替代公开授权。

依据代码：`app/_data/site.ts` 每项的 `mediaNotice`；早期审核记录为 `docs/PORTFOLIO-INGESTION-2026-08-11.md`，餐饮来源为 `docs/PORTFOLIO-INGESTION-2026-08-15-GOOGLE-DRIVE.md`（明确仅入库批准），四项明确授权及 Lactoferrin 排除说明为 `docs/PORTFOLIO-INGESTION-2026-09-01-LOCAL.md`。

| 案例路由 `/work/…/` | 状态 | 可验证依据及限制 |
| --- | --- | --- |
| `geely-australia` | 内部审核 / 公开授权待确认 | `site.ts:41`：Internal review assets / Publication clearance pending |
| `molly-tea` | 内部审核 / 公开授权待确认 | `site.ts:84`：Internal review assets / Project details and publication clearance pending |
| `stasis-clinic` | 内部审核 / 公开授权待确认 | `site.ts:106`：Internal review assets / Publication clearance pending |
| `bentley` | 内部审核 / 公开授权待确认 | `site.ts:144`：Internal review assets / Project details and publication clearance pending |
| `eimele` | 内部审核 / 公开授权待确认 | `site.ts:182`：Internal review assets / Project details and publication clearance pending |
| `chongguang-workshop` | 内部审核 / 公开授权待确认 | `site.ts:220`：Internal review assets / Project details and publication clearance pending |
| `hatman` | 内部审核 / 公开授权待确认 | `site.ts:263`：Internal review assets / Project details and publication clearance pending |
| `malaymalay` | 内部审核 / 公开授权待确认 | `site.ts:306`：Internal review assets / Colour pass, project details and publication clearance pending |
| `mirror-and-moon` | 内部审核 / 公开授权待确认 | `site.ts:344`：Internal review assets / Project details and publication clearance pending |
| `spin-panda` | 已授权可公开（现有标记） | `site.ts:387`：Public display authorised / Central Park opening event；本次未找到仓库内原始授权凭据，应补可追溯批准记录 |
| `spring-bistro` | 内部审核 / 公开授权待确认 | `site.ts:442`：Internal review assets / Project details and publication clearance pending；8 月 15 日 CSV 只批准入库 |
| `chuanxi-road-north` | 内部审核 / 公开授权待确认 | `site.ts:465`：Internal review assets / Menu details and publication clearance pending；8 月 15 日 CSV 只批准入库 |
| `tea-spot` | 内部审核 / 公开授权待确认 | `site.ts:498`：Internal review assets / Project details and publication clearance pending；8 月 15 日 CSV 只批准入库 |
| `bengong-ovaltine` | 内部审核 / 公开授权待确认 | `site.ts:526`：Internal review assets / Product details and publication clearance pending；8 月 15 日 CSV 只批准入库 |
| `chimichuri` | 内部审核 / 公开授权待确认 | `site.ts:554`：Internal review assets / Menu details and publication clearance pending；8 月 15 日 CSV 只批准入库 |
| `milk-flower` | 内部审核 / 公开授权待确认 | `site.ts:582`：Internal review assets / Product details and publication clearance pending；8 月 15 日 CSV 只批准入库 |
| `xin-hao-cai` | 内部审核 / 公开授权待确认 | `site.ts:599`：Internal review assets / Menu details and publication clearance pending；8 月 15 日 CSV 只批准入库 |
| `robo-tea-restaurant` | 内部审核 / 公开授权待确认 | `site.ts:616`：Internal review assets / Venue details and publication clearance pending；8 月 15 日 CSV 只批准入库 |
| `nakedfoods` | 内部审核 / 公开授权待确认 | `site.ts:633`：Internal review assets / Product details and publication clearance pending；8 月 15 日 CSV 只批准入库 |
| `goobne` | 内部审核 / 公开授权待确认 | `site.ts:650`：Internal review assets / Venue details and publication clearance pending；8 月 15 日 CSV 只批准入库 |
| `paparich` | 内部审核 / 公开授权待确认 | `site.ts:667`：Internal review assets / Menu details and publication clearance pending；8 月 15 日 CSV 只批准入库 |
| `viola-cafe` | 内部审核 / 公开授权待确认 | `site.ts:684`：Internal review assets / Product details and publication clearance pending；8 月 15 日 CSV 只批准入库 |
| `tea-struck` | 内部审核 / 公开授权待确认 | `site.ts:701`：Internal review assets / Product details and publication clearance pending；8 月 15 日 CSV 只批准入库 |
| `cocoa` | 内部审核 / 公开授权待确认 | `site.ts:718`：Internal review assets / Menu details and publication clearance pending；8 月 15 日 CSV 只批准入库 |
| `cao-cao` | 内部审核 / 公开授权待确认 | `site.ts:735`：Internal review assets / Menu details and publication clearance pending；8 月 15 日 CSV 只批准入库 |
| `wcrab` | 内部审核 / 公开授权待确认 | `site.ts:752`：Internal review assets / Venue details and publication clearance pending；8 月 15 日 CSV 只批准入库 |
| `xinbar` | 内部审核 / 公开授权待确认 | `site.ts:769`：Internal review assets / Venue details and publication clearance pending；8 月 15 日 CSV 只批准入库 |
| `zhongchu-dim-sum` | 内部审核 / 公开授权待确认 | `site.ts:786`：Internal review assets / Menu details and publication clearance pending；8 月 15 日 CSV 只批准入库 |
| `bengong-yangmei` | 内部审核 / 公开授权待确认 | `site.ts:803`：Internal review assets / Product details and publication clearance pending；8 月 15 日 CSV 只批准入库 |
| `sweet-lu` | 内部审核 / 公开授权待确认 | `site.ts:820`：Internal review assets / Project details and publication clearance pending；8 月 15 日 CSV 只批准入库 |
| `dr-lewinn` | 已授权可公开（现有标记） | `site.ts:837`：Public display authorised / Direct client project；本次未找到仓库内原始授权凭据，应补可追溯批准记录；Dr. LeWinn 的 direct-client 声明不可推广至其他客户 |
| `indiba-icc` | 已授权可公开（现有标记） | `site.ts:870`：Public display authorised / Project details and credits to confirm；9 月 1 日入库记录记载用户明确授权；项目细节/署名仍待确认 |
| `jo-loves` | 已授权可公开（现有标记） | `site.ts:918`：Public display authorised / Project details and credits to confirm；9 月 1 日入库记录记载用户明确授权；项目细节/署名仍待确认 |
| `mm-karaoke` | 已授权可公开（现有标记） | `site.ts:961`：Public display authorised / Project details and credits to confirm；9 月 1 日入库记录记载用户明确授权；项目细节/署名仍待确认 |
| `nvidia` | 已授权可公开（现有标记） | `site.ts:1004`：Public display authorised / Project details and credits to confirm；9 月 1 日入库记录记载用户明确授权；项目细节/署名仍待确认 |
| `emp-dairy-lactoferrin` | 内部审核 / 公开授权待确认 | `site.ts:1047`：Internal review assets / Publication and product-claim clearance pending；后加文件夹不在先前四项授权内；儿童/产品声明待确认，六支源影片未加入网站 |

合计：6 项现有公开授权标记、30 项内部审核/授权待确认。餐饮集合页不是额外授权案例；71 条 Drive 索引也不是 71 个可公开客户。NVIDIA 不新增未核实的主办/直接客户/人物身份或商业成果声明。没有重新取得合同、release、音乐许可或客户批准邮件，不能将本次审计当法律授权复核。

## 6. V1 精简与 V2 开发规范对照

### 规范来源与优先级

- 历史讨论：仓库 `docs/WEBSITE-REFACTOR-DISCUSSION-BRIEF-2026-08-30.md`，A–D 是当时选项，不是完成记录。
- 实际 V2 v0.2 源文件在仓库外：`/Users/cheese/Documents/Codex/2026-08-30/referenced-chatgpt-conversation-this-is-an/work/references/First-Rec-Website-V2-Development-Spec-v0.2.md`。接手前须将这份完整规范纳入受控文档或获得副本；本文没有另行提交规范文件。
- v0.2 已指定 Boutique Commercial Film & Content Production Studio、五项服务、Equipment 主导航、6–8 精选、`.com.au` canonical、TrueNAS 上自托管 Supabase。先前聊天的 Sanity/Payload 方向不能当作当前实施架构。规范内容是目标，不证明基础设施已存在。
- v0.2 的“V1”表示 V2 平台的首轮 MVP；与现有旧静态站的“V1 精简”须分开。没有找到独立签署的 V1 精简实施清单，以下以仓库 brief 和 v0.2 对照，不编造验收。

| 范围 | 已有实现 | 未完成/未验证 |
| --- | --- | --- |
| 现有静态站 | 多页、共享模板、媒体衍生物、设备/服务/联系页、测试、NAS 部署方案 | 内容发布隔离、授权收口、生产配置、视觉与线上全站 QA |
| V1 精简 | 有可复用模板与少量已授权案例可作为起点 | 首页仍全量 36 案例；6–8 精选/排序、餐饮合并策略、公开清单、内部索引移除未完成 |
| Phase 0 基线 | 单一 initial commit，本地版本可定位 | 无 remote、无 legacy 生产 tag、无 V2 分支；不能把当前本地 commit 标成线上版本；staging/admin DNS、源站配置与回滚备份未核实 |
| Phase 1–3 后台/schema/迁移 | 空 D1 模板可供辨认 | 自托管 Supabase、网络隔离、备份与恢复、15 张表、RLS、非公开默认迁移均无实施证据 |
| Phase 4 前台 | 旧站页面骨架 | cinematic showreel Hero、6–8 精选、featured case、selected clients、模块化案例、多维分类尚未按新规范实现 |
| Phase 5 CRM | contact 是 mailto 和 brief 提示 | Name/Email/Message 表单、inquiry 持久化、pipeline、人工录入、AI 摘要/回复草稿未实现 |
| Phase 6 私有预览 | 无 | 随机 token、7 天过期、撤销、访问统计、下载权限、私有媒体保护均无 |
| Phase 7 媒体 | 人工选择/压缩、部分 H.264 MP4 | 2400/1600/1200/800/thumbnail 自动衍生、后台上传/队列尚无 |
| Phase 8–10 AI/Admin/Analytics | 无运行模块 | 人工 override/version/audit、受控发布/撤回、通知、Admin、转化分析均无 |
| Phase 11 切域 | `.com.au` 框架转发旧站 | canonical/301、staging验收、数据库恢复与正式切换未做 |

V2 MVP 的四个上线条件：公共网站可靠、CRM 记录询盘、Admin 管理内容、数据库备份恢复验证。目前只有旧公共站可访问，不能声称 V2 MVP 已完成。

建议顺序：**先建立可回滚的线上基线并移除内部索引风险 → 确认公开名单/首页精选 → 做一版可安全部署的精简静态站 → 再独立开展 V2 基础设施、schema、迁移与 Admin/CRM。** 不要在一次 unit 中同时重写视觉、数据库、部署和全部内容。

## 7. 可改写为 airouter / opencode units 的待办

以下是任务边界与验收草案，不是已批准发布或已派工的计划。新文件名称为建议允许路径；派发前须逐一核对实际接口，按精确文件列 `allowed_paths`，禁止用整目录通配。重叠文件的单元必须顺序执行，后续 unit 以已 land 的 commit 为基线。

| Unit / 依赖 | 精确文件范围（建议） | 交付与验收标准 |
| --- | --- | --- |
| U0 基线和部署清单；优先 | `docs/DEPLOYMENT-INVENTORY.md`、`NAS-DEPLOY.md` | 基于主线程只读采集，记录实际 volume/proxy/DNS、release/rollback 方法和生产标识；不得含凭证。还原旧生产到本地预览可验证；业务 worker 不登录服务器。源站/域名操作由主线程执行 |
| U1 内部索引隔离；优先 | `app/work/approved/page.tsx`、`app/work/page.tsx`、`app/_data/approved.ts`、`tests/public-export-boundary.test.mjs`、`package.json` | 从公开编译图移出内部索引并保留私有来源，删除入口；clean build 不输出该路由、Drive URL/内部记录到 HTML/JS/RSC。检查静态 public 资产；测试要能抓到恢复导入后的泄露。历史源站残留清理由主线程单独处理 |
| U2 slug 稳定引用；U1后 | 新 `app/_data/project-access.ts`、以下现有路由 `app/work/geely-australia/page.tsx`、`molly-tea/page.tsx`、`stasis-clinic/page.tsx`、`bentley/page.tsx`、`eimele/page.tsx`、`chongguang-workshop/page.tsx`、`hatman/page.tsx`、`malaymalay/page.tsx`、`mirror-and-moon/page.tsx`、`spin-panda/page.tsx`、`tests/project-routes.test.mjs`（各简写路由均以 `app/work/` 为前缀） | 先枚举实际数组下标使用点并补入精确路径；全部改按 slug 取数。重排 fixture 后 URL 与 client 不变，缺 slug 明确失败，全部路由仍可构建。不可让 worker 改授权或页面文案 |
| U3 发布状态与公开数据；U1/U2后 | `app/_data/site.ts`、新 `app/_data/publication.ts`、`app/page.tsx`、`app/work/page.tsx`、`app/work/food-hospitality/page.tsx`、`tests/publication.test.mjs`；另须列明所有需阻止导出的案例 `page.tsx` 的精确路径 | 建立结构化状态/授权依据/featured/order；未经确认默认非公开。首页、Work、集合、直接路由、客户端 payload、部署资产全部一致过滤；不能只从列表隐藏。内部素材仍留在源库而非生产根目录。迁移后 36 项均有可追溯状态，不从 `mediaNotice` 猜批准 |
| U4 V1 精选与文案；公开名单确认且U3后 | `app/page.tsx`、`app/work/page.tsx`、`app/_data/site.ts`、`app/services/page.tsx`、`app/equipment/page.tsx`、`tests/rendered-html.test.mjs` | 创始人给定6–8项和顺序；无足够批准内容则如实少于6，不凑数。五项服务、Equipment能力定位、餐饮集合按决定实现；英文、无虚构事实，桌面/移动视觉QA通过。新文案同步替换过时硬编码断言 |
| U5 生产配置与可重复构建；U1–U4后 | `package.json`、新 `.node-version`、`app/layout.tsx`、`NAS-DEPLOY.md`、`README.md`、新 `scripts/check-public-build.mjs` | 锁定实际验证的Node LTS；明确最终域名/邮箱，缺生产参数时拒绝发布包。自动检查localhost、内部链接、缺资产、404和嵌套路由。干净安装/test/lint/build通过；回滚步骤可复现。不得修改 DNS 或上传 |
| U6 规范入库与 V2 架构决策；可与U1独立 | `docs/Website-V2-Development-Spec-v0.2.md`、`docs/V2-ARCHITECTURE-ADR.md` | 原规范逐字保留并记录来源；ADR明确Supabase/服务端边界、静态前台策略、认证/媒体权限、部署与恢复责任。不得将D1示例默认选为生产库；创始人批准后才能执行基础设施变更 |
| U7 V2数据契约；U6后 | 新 `docs/V2-DATA-CONTRACT.md`、`db/v2-schema.sql`、`tests/v2-schema.test.mjs`（名称需按ADR调整） | 完整表关系、publication/rights/facts字段、迁移映射、RLS设计；36条迁移为非公开默认。隔离临时数据库验证约束/访问边界/迁移幂等，不触碰生产；不得凭空声称备份恢复已验证 |
| U8 模块化案例；U3和数据契约后 | `app/_components/CaseStudyPage.tsx`、新 `app/_components/CaseStudyBlocks.tsx`、`app/_data/site.ts`、`app/globals.css`、新 `tests/case-blocks.test.mjs` | 支持规范所列Hero/Intro/Facts/Gallery/Video/Full-width/Two-column/Deliverables/Credits/BTS/Next；未知事实不显示；旧案例兼容、图片原比例、reduced-motion与手机布局通过 |
| U9 V2询盘/API契约；U6/U7后 | 新 `docs/V2-INQUIRY-API.md`、`app/contact/page.tsx`、新 `app/api/inquiries/route.ts`、`tests/inquiries.test.mjs`（须先确认运行架构） | Name/Email/Message持久化、NEW状态、验证/反滥用/失败处理；重复提交控制、日志不泄露个人信息。AI只草拟首封回复，人工发送。仅临时隔离后端测试；静态NAS仍可运行则需独立API，不得直接塞入 export 破坏现站 |
| U10 V2私有预览设计；U6/U7后 | 新 `docs/V2-PRIVATE-PREVIEW.md` | 精确随机token、7天过期/撤销、访问统计与媒体授权方案；VIEW_ONLY不承诺防截图或绝对禁止下载。内部记录和原图不能被猜URL绕过。设计验收后再拆实现单元 |
| U11 发布前验收记录；U5后 | 新 `docs/RELEASE-CHECKLIST.md` | 主线程记录批准范围、完整构建标识、桌面/移动截图、媒体/HTTP/SEO、备份和回滚证据；源站部署与DNS变更留给主线程。没有真实验收不得把清单勾为已完成 |

U2 表格中的简写路径仅为可读性；正式 spec 必须展开为每个完整仓库相对文件名。U3 也必须在 lint 前列全受影响路由，不允许把“所有页面”当目录权限。

派工操作规则：

- Claude 接手为 Control Plane：范围、架构、验收、采纳与外部操作由主线程负责；实现经 airouter 到 opencode，禁止直接在 worker host 运行 `claude`、`codex exec`、`opencode run`。
- 先读 `~/.config/airouter-kit/LOCAL.md`、skill、worker host 上 RUNBOOK/USAGE/NEXT_SESSION_PROMPT，再检查 `airouter quota`、`airouter pools`、`airouter models` 和项目 `allowed_workers/read_only/test_command`。本次未连接 worker host，也未确认该站点已注册为 airouter project。
- 不擅自创建 project 或修改 `projects.yaml` 的 read_only；若网站尚未注册，需要创始人明确授权配置。远程 worker 必须使用独立项目 checkout，不可依赖这个本机绝对路径。
- `airouter plan` → role/allowed_paths核对 → `dispatch --dry-run` → `dispatch --review --lint --triage`。Opus作计划/评审，opencode实现；Codex只读lint/triage。COMPLETED仅候选提交，评审和验收后才 `airouter land`，禁止手工merge。
- 当前本机 operator note 记载 Go池已停、GLM为主力，但本次未实时核实配额/模型；不可把旧AGENTS默认池当当前可用池，不自动fallback。
- operator note 还指出 opencode write worker 没有 shell；安装、生成、测试必须由 airouter 项目的 `test_command` / 主线程验证执行，不要要求worker伪造测试记录。每份回报应含结果、文件、实际验证和阻塞。

## 8. 创始人需要决定或提供的事项

1. 公开项目的准确名单、首页顺序、客户关系/角色可公开表述；优先补 Spin Panda、Dr. LeWinn 授权依据归档，确认四项现有授权的适用素材与用途。其余30项逐项决定，不能默认放行。
2. 精简静态站是否先上线；是否继续以 v0.2 的 commercial production / film优先、Equipment主导航、餐饮辅助定位为准。定位已写进规范，不必重新从空白讨论，但更改需明确记录。
3. 最终公开邮箱和对外品牌姓名/角色；当前网站仍是 `hello@cheese.studio`，不能因为别处存在其他邮箱就擅自替换。
4. `.com.au` 切换时机、GoDaddy/Cloudflare访问权、DNS owner和回滚负责人；是否先修复 `.work` 裸域。当前框架转发对SEO和分享不理想。
5. NAS/反向代理管理入口与访问权、部署目录是否仍正确、备份存储及恢复负责人；不能把本次未登录核实写成已确认。
6. V2是否继续自托管Supabase、可接受维护成本/恢复责任、独立API或动态运行时选择；V2明确允许静态优先但非静态唯一，须以ADR明确放宽旧站server-only限制的范围。
7. 71条内部索引迁往何处、谁可访问、是否允许外部平台上传内部源代码/媒体；项目公开授权不等于整仓外传授权。
8. V2所需Hero/showreel、客户logo、featured案例的真实素材与发布批准；没有证据的客户logo/评价/价格不填充。
9. 是否授权在airouter注册站点项目，以及远端checkout/测试命令/允许写入范围。上线部署和域名变更应作为主线程明确执行的独立动作，不交给worker自行决定。

## 9. 已知技术和设计约束

- 这是 **React 19 + Next App Router兼容API + vinext 1.0.0-beta.2 / Vite 8**，不是普通 `next build` 项目，也不是另一个已完成的React/Vite重写。`next`并未列为常规依赖，不要绕过vinext脚本随意升级。
- `npm run build` 必须包含 `scripts/normalize-static-export.mjs`，把生成的非index HTML移为目录式 `route/index.html`；NAS的clean URLs依赖它。只跑 `vinext build` 可能漏这一步。
- 构建会启动loopback预渲染服务，沙箱可能报listen EPERM或写入`.vite-temp`失败；先排查执行环境，不要把它当业务错误。Vite配置已有Seatbelt轮询兼容。
- `output: "export"`、`images.unoptimized:true`：部署包不能提供运行时认证/数据库/API、token到期撤销或实时CRM。`app/chatgpt-auth.ts`存在也不能保护静态页面。V2必须明确服务端边界和动态运行时，不能靠静态HTML模拟权限。
- `NEXT_PUBLIC_*` 是构建期公开值，不是秘密，不可放token；正式URL必须随最终构建提供，否则OG回落localhost。产物应只选择经过批准的公开文件，不能复制全量内部源仓库作为Web root。
- 图片在图库数据中携带 `ratio`，共享模板控制 lead/hero 的布局；案例lead和gallery使用 `object-fit: contain`。不把竖图硬裁成横图，不把横图强裁成竖图；卡片cover裁切与案例保真展示是不同需求，需逐视口视觉检查。
- 原图/原片/工程保留在NAS或Drive，网页仅用衍生物；不覆盖原件。旧M4V/MOV浏览器兼容需验证，新增MP4的历史转码记录不代表本次所有视频都实测解码。
- 继承上级 `AGENTS.md`：英文可见文案、First Rec.品牌、多页架构、固定暖浅色、无自动dark mode、无scroll listeners或无必要JS动画、无障碍和reduced-motion、不虚构事实/日期/授权/成果；优先共享数据与模板，避免每项目造组件。
- 当前CSS/测试仍断言Newsreader和butter `#efca55`等旧视觉；v0.2锁定暖中性底、bold condensed标题、cinematic full-width Hero、少量暗色、无鲜艳点缀。V2视觉不能机械沿用旧断言：按批准基线调整后同步改测试，但本次不改视觉。当前静态站先保持旧约束，服务端放宽仅限经确认的V2方案。
- v0.2明确反对玻璃效果、装饰渐变、重阴影、随机masonry、过度动画；尊重手动override，AI不得静默覆盖人工选择，首封询盘回复必须人工发送。
- `docs/PORTFOLIO-INGESTION.md` 被历史说明引用，但仓库实际仅有日期版入库文档；不要在接手时把该缺失路径当完整现行SOP。

### 未解决的验证限制 / 接手第一步

- 未登录NAS、代理、Cloudflare/GoDaddy后台，因此账户归属、远端mount/compose和完整DNS路由/回滚仍待核实；公网+已知NAS HTTP证据与记录一致，不能替代配置审计。
- 没有线上全站哈希清单、浏览器逐页视觉QA、Docker实测、Node22实测、授权原始文件重审、V2数据库恢复测试或worker host实时项目/配额检查。
- 此次不部署、不切域、不新增授权、不修改业务代码；交接commit仅本文。后续首先核对最新 `git status/log` 和本文基线，再按U0/U1处理，不把历史ZIP或这次无生产环境变量的独立构建直接上线。
