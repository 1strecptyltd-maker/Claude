# ADR-0001：First Rec. 网站 V2 架构

| 项 | 值 |
| --- | --- |
| 状态 | **Proposed（提议）**——整份 ADR 都还没有经过创始人批准 |
| 日期 | 2026-10-30 |
| 范围 | U6（`docs/HANDOFF-2026-10-17-CLAUDE.md` §7）。只写文档，不改代码、依赖和基础设施 |
| 输入 | `docs/Website-V2-Development-Spec-v0.2.md`（仓库内重建摘要，**不是** v0.2 原文）、`HANDOFF.md`、`docs/HANDOFF-2026-10-17-CLAUDE.md` |
| 后续 | U7 数据契约、U9 询盘 API、U10 私有预览设计都以本文为前提 |

> **执行门槛**：本文所有决策只是提议。凡标 **「Proposed — needs founder sign-off」** 的，在创始人明确批准前，不得创建服务器、容器、数据库、DNS 记录、Cloudflare / GoDaddy 配置或任何外部账号。批准时请在 §11 签批记录里逐条写上日期和范围。原 v0.2 原文入库后，如有冲突，先改本 ADR 再执行。

## 1. 背景

### 1.1 现状（以仓库和 2026-10-17 实测为准）

- 公共站：React 19 + Next App Router 兼容 API，跑在 vinext / Vite 上，`output: "export"` 纯静态导出到 `dist/client/`（`HANDOFF.md` §1）。
- 生产链路：Cloudflare 代理 → TrueNAS 上 Docker 跑的 `nginx:1.27-alpine`，只读挂载 `dist/client`；在 Mac 上构建，NAS 上不构建（`HANDOFF.md` §3；旧 handoff §2）。线上仍是 2026-08-13 的 8 案例旧版。
- `firstrec.com.au` 用 GoDaddy frameset 框架嵌入 `www.firstrec.work`，不是 301。
- 数据：内容硬编码在 `app/_data/site.ts`（36 个案例）。没有数据库，没有认证，没有 API。
- 模板残留：`db/index.ts`（Cloudflare D1 getter）、`db/schema.ts`（空）、`drizzle.config.ts`（SQLite dialect）、`examples/d1/`、`worker/index.ts`、`app/chatgpt-auth.ts`、`.openai/hosting.json`（`d1` / `r2` 均为 `null`）。都**不是**运行中的系统（旧 handoff §4）。
- 授权：6 个案例带「Public display authorised」标记（其中 Spin Panda、Dr. LeWinn 在仓库里找不到原始批准凭据），另外 30 个处于内部审核 / 授权待确认（旧 handoff §5）。

### 1.2 V2 需要什么（引自重建规范，编号对应其章节）

自托管 Supabase（5.1）、15 张表 + RLS（5.3 / 5.4）、默认非公开迁移（5.5）、Admin / CMS（8.2）、CRM 询盘（§6）、私有预览：随机 token、7 天过期、撤销、访问统计（7.1）、媒体衍生管线（7.3 / 7.4）、`.com.au` canonical + `.work` 301（8.4）、MVP 四个上线条件（8.6）。

### 1.3 硬约束

- 静态导出的 HTML **不能**做权限控制：`noindex`、隐藏链接、客户端判断都保护不了内容（旧 handoff §4、§9）。
- `NEXT_PUBLIC_*` 是构建期公开值，不能放任何密钥或 token（`HANDOFF.md` §5）。
- 旧静态站继续遵守「不依赖服务端运行」的约束；V2 只在本 ADR 批准的范围内放宽（重建规范 5.7、§10）。
- 不虚构事实、日期、授权、成果；原图原片不进 Web root（`HANDOFF.md` §7）。

## 2. 决策总览

| ID | 决策（一句话） | 状态 |
| --- | --- | --- |
| D1 | 数据平台用 TrueNAS 上自托管 Supabase；**不**把 D1 模板残留当生产库 | Proposed — needs founder sign-off |
| D2 | 公共前台保持静态导出 + NAS Nginx；动态能力放在独立的 Admin 和 API 源站，不进公共构建 | Proposed — needs founder sign-off |
| D3 | Admin / CMS 认证：Supabase Auth，仅邀请、关闭自助注册、强制 MFA，外加网络层访问限制 | Proposed — needs founder sign-off |
| D4 | 媒体分层：原件不上 Web；公开衍生图随静态构建发布；私有媒体只经签名 URL 发放；预览 token 只存哈希 | Proposed — needs founder sign-off |
| D5 | 询盘：静态表单 POST 到独立 API，写入 `NEW` 状态记录；AI 只起草，人工发送 | Proposed — needs founder sign-off |
| D6 | 部署、备份、恢复要有指名负责人；MVP 上线前必须做过一次实际恢复演练 | Proposed — needs founder sign-off（负责人待定） |
| D7 | 36 个案例按 slug 迁入数据库，**全部默认非公开**，逐条由创始人放行 | Proposed — needs founder sign-off |
| D8 | 旧静态站和 V2 并行；先做 V1 精简（U1–U5），V2 在独立分支 / 源站推进，切域最后做 | Proposed — needs founder sign-off |

## 3. D1：数据平台

**决策（提议）**：V2 的内容、CRM、预览、审计数据都放在 **TrueNAS 上的自托管 Supabase**（PostgreSQL + Auth + Storage + PostgREST），照 v0.2 执行。

### 备选方案对比

| 方案 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- |
| **A. 自托管 Supabase（TrueNAS）** | v0.2 指定；Postgres + RLS 满足权限需求；Auth / Storage 自带；数据留在自家硬件 | 组件多（Postgres、GoTrue、PostgREST、Storage、Kong、Studio…），升级、备份、安全补丁全部自己负责；家用 / 工作室网络的上行带宽和可用性有限 | **推荐**，前提是 D6 的负责人落实 |
| B. 托管 Supabase（Supabase Cloud） | 同一套 API，运维负担小得多，有官方备份 | 每月费用；数据在第三方；偏离 v0.2 | 留作备选；选 A 时 schema 保持可移植，日后可迁 |
| C. 自托管纯 PostgreSQL + 自写 API | 组件最少，最透明 | Auth、存储签名、Admin 都要自己写，工作量大 | 不推荐，除非 A 的运维成本被否决 |
| D. Cloudflare D1 + Workers（仓库模板残留） | 仓库里已有 Drizzle / D1 骨架 | SQLite 语义，没有 RLS；`db/schema.ts` 为空，没有任何业务实现；与 v0.2 不符；要把生产数据和运行时转到 Cloudflare 账号，账号归属未核实（旧 handoff §2） | **不采用为默认生产库** |
| E. Headless CMS（Sanity / Payload 等） | 现成编辑界面 | 旧 handoff §6 明确：早先聊天的这个方向不是当前实施架构；CRM / 预览仍要另外做 | 不采用 |

### 关于 D1 模板残留

- `db/`、`drizzle.config.ts`、`examples/d1/`、`worker/index.ts`、`app/chatgpt-auth.ts`、`.openai/hosting.json` **不是** V2 的起点，也不能证明任何数据库存在。
- 本 ADR 不删除它们（U6 只写文档）。建议在 V2 第一个实现单元里单独决定：删除，或移到 `examples/` 下并注明「模板，未使用」。
- 如果日后改用 Drizzle 连 Postgres，要另立 ADR，不能沿用现有 `dialect: "sqlite"` 配置。

### 部署形态（提议）

- Supabase 以官方 self-hosting Docker Compose 方式跑在 TrueNAS，和现有 Nginx 静态站分开部署（独立 compose 项目、独立数据卷）。
- Postgres 端口、Studio、Kong 管理端口**不对公网开放**；只通过反向代理暴露 D2 里列明的路径。
- 所有密钥（`service_role`、JWT secret、数据库密码、SMTP 凭证）只放在 NAS 上的 env 文件或密码管理器里，绝不入库，绝不出现在 `NEXT_PUBLIC_*`。

## 4. D2：服务端 / 静态边界与公共前台

**决策（提议）**：分成三个面，权限边界在网络和服务端，不在 HTML 里。

| 面 | 内容 | 运行方式 | 对公网 |
| --- | --- | --- | --- |
| **公共站** | 首页、Work、已公开案例、Services、Equipment、About、Contact | 继续静态导出 → NAS Nginx（现有 `compose.truenas.yaml` 方式），Cloudflare 代理 | 是 |
| **API** | 询盘写入（D5）、私有预览校验和签名 URL 发放（D4） | 小型服务端（Supabase Edge Functions 或独立 Node 服务，见开放问题 Q4），挂在独立子域 | 仅这几个路径 |
| **Admin / CMS** | 内容编辑、发布 / 撤回、CRM、预览链接管理、审计 | 独立的动态应用（可以用同一 repo 的独立 app，也可以是独立项目），需登录 | 受 D3 保护；最好只对受信网络开放 |

### 公共站怎么继续工作

1. **构建方式不变**：仍然 `npm run build` → `scripts/normalize-static-export.mjs` → `dist/client/`，Nginx 只读挂载。V2 初期不要求 Nginx 改动。
2. **数据来源换成「发布快照」**：V2 下，构建前先从 Supabase 导出一份**只包含 `published` 案例**的 JSON 快照（用只读、仅能读公开视图的凭据），代替手写的 `site.ts`。快照纳入构建产物检查（U1 / U5 的 public-export 测试也要覆盖它）。
3. **发布 = 重新构建 + 原子切换**：Admin 里点「发布 / 撤回」只改数据库状态；真正上线要触发一次构建，生成新的 release 目录，再切换 Nginx 挂载（或 symlink），保留上一版用于回滚（沿用旧 handoff §2 的 release / rollback 建议）。撤回要等下一次构建上线才生效——这个延迟要写进 Admin 界面说明。
4. **构建在哪跑**：现在在 Mac 上。V2 需要一台能连到 Supabase、并能拿到公开衍生媒体的构建机（NAS 上的构建容器或 CI）。具体选哪个是开放问题 Q5。
5. **静态站降级**：Supabase 或 API 宕机时，公共站照常提供（它只是静态文件）；只有询盘表单受影响，此时显示 mailto 兜底（D5）。
6. **公共站不直连 Supabase**：浏览器端不放 Supabase URL 和 anon key 来读内容，内容全部在构建期写进静态文件。这样 RLS 出错也不会通过公共站泄露内部记录。

### 放宽旧站约束的范围

只允许：API 子域上的询盘写入和预览校验、Admin 子域上的登录应用。公共站本身仍是纯静态，不加 SSR、不加客户端数据请求（询盘表单的 POST 除外）。

## 5. D3：Admin / CMS 认证

**决策（提议）**：

- 用 **Supabase Auth（GoTrue）**，邮箱 + 密码或 magic link，**关闭自助注册**，只能由 owner 邀请。
- **强制 MFA（TOTP）**。
- 角色先只设两种：`owner`（创始人，可发布 / 撤回 / 管理用户 / 看 CRM）和 `editor`（可编辑草稿，不能发布）。角色存在数据库表里，RLS 按角色判断；具体表结构交给 U7。
- Admin 子域额外加网络层保护（方案任选其一，见开放问题 Q3）：Cloudflare Access / Zero Trust、只在 VPN / 局域网内可访问、或 IP 白名单。理由：自托管 Auth 的补丁和暴力破解防护都靠自己，多一层能降低风险。
- `service_role` key 只在服务端（API、构建脚本）使用，浏览器端永远只拿 anon key + 用户 JWT。
- 所有发布、撤回、授权状态变更、预览链接创建 / 撤销都写审计记录（谁、何时、改了什么），对应重建规范 8.1。
- 现有 `app/chatgpt-auth.ts` 不使用。

## 6. D4：媒体权限与私有预览链接

### 6.1 媒体分层（提议）

| 层 | 内容 | 存放 | 谁能访问 |
| --- | --- | --- | --- |
| 原件 | 原图、原片、工程 | 保持现状：NAS / Google Drive，**不进** Supabase Storage，不进 Web root | 内部 |
| 私有衍生 | 未公开案例、预览用的 2400 / 1600 / 1200 / 800 / thumbnail 衍生图和网页视频 | Supabase Storage **private** bucket | 只通过短时效签名 URL |
| 公开衍生 | 已发布案例用到的衍生媒体 | 构建时复制进 `dist/client/portfolio/`（与现在一样） | 公开 |

- 公开构建**只**复制已发布案例实际引用的文件，不再复制整个 `public/portfolio/`（旧 handoff §4 指出复制整个 public 目录会把未展示素材也发出去）。
- 衍生图生成（重建规范 7.3 / 7.4）用后台队列，在 NAS 上跑；原件只读。具体工具留给媒体实现单元。
- 71 条内部 Drive 索引（`approved.ts`，不在本仓库）**不**进公开数据；是否进 V2 数据库的 admin-only 表由创始人决定（开放问题 Q8）。

### 6.2 私有预览链接（提议，细节交给 U10）

- token：服务端用 CSPRNG 生成，≥128 bit，URL-safe。数据库**只存哈希**，明文只在创建时显示一次。
- 默认 `expires_at = 创建时间 + 7 天`；有 `revoked_at`；过期或撤销后立即失效（服务端每次请求都校验，不靠缓存）。
- 每个链接绑定明确的案例 / 媒体范围，不能借一个 token 看到别的内部记录。
- 访问统计：记录时间、链接 ID、命中的资源；IP / UA 是否保存、保存多久要定隐私策略（开放问题 Q9）。
- 下载权限：`VIEW_ONLY` 时不给原始文件下载链接、签名 URL 时效短；**明确不承诺**防截图或彻底防下载（旧 handoff §7 U10）。允许下载时给的也只是衍生文件，不是原件。
- 预览页由 API / Admin 源站动态渲染，**不**进公共静态构建，也不能通过猜 URL 访问到。
- 预览页加 `noindex` 和 `Referrer-Policy: no-referrer`，但这只是辅助，不是权限控制。

## 7. D5：询盘 / CRM 表单后端

**决策（提议）**：

1. 公共站 Contact 页的表单（Name / Email / Message）用普通 HTML `<form>` + 极少量 JS，POST 到 API 子域的 `/inquiries`。没有 JS 时也能用普通表单提交。
2. API 校验字段长度和格式，做反滥用：honeypot 字段、按 IP 限速、可选 Cloudflare Turnstile（开放问题 Q6）。CORS 只允许正式公共域名。
3. 通过服务端凭据写入 `inquiries`，状态 `NEW`。匿名用户在数据库层面**只有插入权限，没有读取权限**（RLS）。
4. 用重复提交键 / 时间窗去重。
5. 写入成功后给创始人发通知（邮件渠道和发件域名待定，开放问题 Q7）。日志里不记录留言正文和邮箱。
6. API 不可用时，前端显示 mailto 兜底，邮箱用已确认的公开联系邮箱 `info@firstrec.com.au`（2026-10-31 创始人确认，见 `docs/DECISIONS.md`）。
7. AI 摘要 / 回复草稿只在 Admin 里生成，存为草稿；**首封回复必须人工发送**，AI 不自动发信（重建规范 6.4）。用哪家 AI 服务、能否把询盘内容发给第三方，要单独批准（开放问题 Q10）。
8. pipeline 状态和人工录入询盘放在 Admin 里；状态枚举交给 U7 / U9。

## 8. D6：部署、备份、恢复与负责人

### 8.1 负责人（全部待定，不能当作已确认）

| 事项 | 负责人 | 现状 |
| --- | --- | --- |
| NAS / TrueNAS 管理与补丁 | **待创始人指定** | 未核实访问权（旧 handoff §8 第 5 条） |
| 反向代理（Nginx Proxy Manager）配置 | **待创始人指定** | 未登录核实 |
| Cloudflare（`firstrec.work`）、GoDaddy（`firstrec.com.au`） | **待创始人指定** | 账号归属未核实 |
| Supabase 升级 / 安全补丁 | **待创始人指定** | 尚不存在 |
| 备份执行与监控 | **待创始人指定** | 尚不存在 |
| 恢复演练与签字 | **待创始人指定** | 尚不存在 |
| 公共站发布 / 回滚 | **待创始人指定**（旧 handoff §7 规定由主线程执行，不交给 worker） | 流程见 `HANDOFF.md` §3，2026-10-20 未重新验证 |

### 8.2 备份（提议）

- Postgres：每天 `pg_dump`（或 WAL 归档，按维护能力选），加密后保存。
- Storage：私有 bucket 定期同步。
- **3-2-1 原则**：至少一份放在 NAS 之外（异地或云端存储，具体选哪家由创始人决定，开放问题 Q11）。只放在同一台 NAS 上不算备份。
- 保留期：建议日备份保留 30 天、月备份保留 12 个月（数字是提议，待批准）。
- 备份里有询盘个人信息，存放位置要符合隐私要求（开放问题 Q9）。
- 公共静态站：每次发布保留上一版 release 目录用于回滚；`dist/client`、compose 和代理配置在变更前备份（`HANDOFF.md` §3）。

### 8.3 恢复

- MVP 上线条件之一就是「数据库备份恢复已验证」（重建规范 8.6）。至少在隔离环境做一次**从异地备份完整恢复**的演练，记录耗时和结果，写进 `docs/RELEASE-CHECKLIST.md`（U11）。没有真实演练不能勾选。
- 目标 RPO / RTO 待创始人定（建议起点：RPO 24 小时，RTO 1 个工作日）。

### 8.4 环境

- 至少两套：staging（验收用）和 production。staging 用独立数据库，不连生产。
- 所有 schema 变更走版本化 migration 文件（在 U7 定格式），先在 staging 跑。

## 9. D7：36 个案例的迁移路径

**决策（提议）**：

1. **前置**：U2（按 slug 取数）完成，保证迁移以 slug 为主键，不依赖数组下标。
2. 写一次性导入脚本：读 `app/_data/site.ts`，按 slug 生成数据库记录。slug 保持不变，旧 URL 不变。
3. **全部 36 条默认非公开**（例如 `publication_status = 'internal'`，具体枚举交给 U7）。
   - 包括那 6 个带「Public display authorised」标记的案例：导入时也是非公开，只把现有标记记成一条「待核实的授权依据」，不自动放行。理由：Spin Panda、Dr. LeWinn 在仓库里找不到原始授权凭据；另外 4 项署名 / 细节仍待确认（旧 handoff §5）。
   - **不**从 `mediaNotice` 文案解析出批准状态（旧 handoff §7 U3）。`mediaNotice` 原文只存为备注。
4. 授权依据单独成表（例如 rights / approvals），每条写来源、日期、范围、证据位置；没有证据就是空，不补。
5. 放行要由 owner 在 Admin 里逐条操作，留审计记录。放行后进入下一次公开构建。
6. 媒体：只迁衍生文件。现在仓库里只有 6 个已授权案例的衍生图；其余 30 个的衍生图在 Mac 上（`HANDOFF.md` §6b），要上传到 **private** bucket，不进 Git、不进公开构建。9 个网页视频同理（`HANDOFF.md` §6c）。
7. 餐饮集合页（`/work/food-hospitality/`）是展示结构，不是额外的授权；在数据库里怎么表示由 U7 决定。
8. 迁移脚本要幂等，在 staging 先跑，可以核对：36 条都在、slug 不变、公开数 = 0。
9. 如果 U3（V1 精简的发布状态）先完成，V2 迁移以 U3 的结构化状态为准，不重新从 `site.ts` 推断。

## 10. D8：推进顺序与并行

- 先完成 U0–U5（部署基线、内部索引隔离、slug、发布状态、精选、生产配置），让旧静态站能安全发布。V2 不阻塞这些。
- V2 在独立分支和独立源站推进；现有 NAS Nginx 公共站在 V2 验收前不动。
- 切域（`.com.au` canonical、`.work` 301）在 V2 staging 验收、恢复演练通过之后单独执行，并且要先核实 DNS zone 和回滚记录（旧 handoff §2）。DNS 操作由主线程执行，不交给 worker。

## 11. 签批记录

| 决策 | 结果（批准 / 修改 / 否决） | 日期 | 签批人 | 备注 |
| --- | --- | --- | --- | --- |
| D1 | | | | |
| D2 | | | | |
| D3 | | | | |
| D4 | | | | |
| D5 | | | | |
| D6 | | | | |
| D7 | | | | |
| D8 | | | | |

（目前全部空白：没有任何决策获批。）

## 12. 后果

**正面**：公共站的可用性和现在一样，不受后台故障影响；权限全在服务端；未授权内容默认不出现；数据在自家硬件。

**负面 / 风险**：
- 自托管 Supabase 的运维（升级、补丁、备份、监控）全部落在工作室身上，目前没有指定负责人。
- 「发布 = 重新构建」意味着发布 / 撤回有延迟，并且依赖一台构建机。
- Admin 和 API 暴露到公网会扩大攻击面；需要网络层保护和持续补丁。
- NAS 所在网络的上行带宽、电力和可用性会影响 API 和预览链接（公共静态站有 Cloudflare 缓存缓冲，但预览和私有媒体没有）。

## 13. 开放问题

1. **Q1** v0.2 原文何时入库？入库后要逐条核对本 ADR 和重建规范，尤其是 15 张表、五项服务、Admin 角色、认证方式这些仓库里没有记录的内容。
2. **Q2** 确认继续用自托管 Supabase（D1 方案 A），还是因运维负担改用托管 Supabase（方案 B）？谁负责升级和补丁？
3. **Q3** Admin 的网络层保护选哪种：Cloudflare Access、VPN / 局域网、还是 IP 白名单？
4. **Q4** API 用 Supabase Edge Functions 还是独立 Node 服务？放在哪个子域？（子域需要创始人批准 DNS 变更）
5. **Q5** V2 的公共站构建在哪里跑：NAS 构建容器、CI，还是继续在 Mac 上？发布触发方式（手动按钮 / webhook）？
6. **Q6** 询盘反滥用要不要用 Cloudflare Turnstile？
7. **Q7** 询盘通知发到哪个邮箱、走哪个发件服务和发件域名？（公开联系邮箱已定为 `info@firstrec.com.au`，见 `docs/DECISIONS.md`；这里只剩通知邮箱和发件服务未定。）
8. **Q8** 71 条内部 Drive 索引（`approved.ts`）迁到哪里：V2 数据库的 admin-only 表、独立内部工具，还是不迁？
9. **Q9** 询盘和预览访问日志的个人信息（邮箱、IP、UA）保存多久？适用哪些隐私义务（如澳大利亚隐私法规）？需要隐私政策页吗？
10. **Q10** AI 摘要 / 回复草稿用哪家服务？是否允许把询盘内容和内部素材发给第三方 AI？
11. **Q11** 异地备份放在哪里？RPO / RTO 目标？保留期？
12. **Q12** 构建机和 Admin 要读取的衍生媒体：30 个未授权案例的衍生图和 9 个视频目前只在 Mac 上，何时、由谁上传到 private bucket？
13. **Q13** 仓库是 public。V2 的 Admin / API 代码要不要放在同一个 public 仓库？（代码里不能有密钥，但内部字段名、路由也会公开。）
14. **Q14** D1 / Workers / Sites 模板残留什么时候删、谁批准？
15. **Q15** `editor` 角色是否需要？是否有外部协作者要登录 Admin？
16. **Q16** 预览链接默认 7 天是否允许按链接调整（更短 / 更长）？是否需要密码作为第二因子？
