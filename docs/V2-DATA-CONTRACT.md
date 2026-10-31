# V2 数据契约（U7）

| 项 | 值 |
| --- | --- |
| 状态 | **Proposed（提议）**。前提是 ADR-0001 D1（自托管 Supabase / Postgres），该决策**尚未经创始人批准** |
| 日期 | 2026-10-31 |
| 范围 | U7（`docs/HANDOFF-2026-10-17-CLAUDE.md` §7）。只新增文档、SQL、导出脚本和测试；不改运行中的静态站、`db/schema.ts`（D1 残留）和部署配置 |
| 文件 | `db/v2-schema.sql`（DDL + RLS）、`scripts/export-v2-seed.mjs`（从 `site.ts` 生成 seed）、`tests/v2-schema.test.mjs`（临时 Postgres 验证） |
| 输入 | `docs/V2-ARCHITECTURE-ADR.md`、`docs/Website-V2-Development-Spec-v0.2.md`（重建摘要，非原文）、`docs/DECISIONS.md`、`app/_data/site.ts`、`app/_components/CaseStudyBlocks.tsx` |

> **执行门槛**：在 ADR §11 签批前，不得把 `db/v2-schema.sql` 应用到任何非临时数据库。本文没有验证过任何备份或恢复（见 §10）。

## 1. 设计原则

1. **默认非公开**：`projects.publication_status` 默认 `internal`。36 条迁移全部是 `internal`，公开数 = 0（ADR D7）。
2. **公开需要证据**：`approved` / `published` 由触发器强制要求一条 `verified` 且未过期的 `public_display` 授权；`verified` 本身由 CHECK 约束强制写明 `granted_by`、`granted_on`、`evidence_location`。没有证据就不能公开，数据库层面拒绝。
3. **不从文案推断授权**：`mediaNotice` 原文只存进 `projects.legacy_media_notice`（内部备注）。6 条「Public display authorised」只生成 `unverified_claim`，不放行。
4. **「unknown」永不渲染**：`project_facts` / `project_credits` 用 `state`（`known` / `unknown` / `withheld`）。`known` 行的 `value`（facts）/ `name`（credits）由 CHECK 保证与 `CaseStudyBlocks.tsx` 的 `known()` 判断一致：去掉首尾空白后非空，且不是占位符（同一个列表：`tbc|tbd|n/a|na|unknown|pending|-|?`，不分大小写）。「空白」就是 JS `trim()` 去掉的那组字符（ASCII 空白，加 NBSP、U+1680、U+2000–U+200A、U+2028、U+2029、U+202F、U+205F、U+3000、BOM），在正则里写成显式字符类：`btrim()` 只去空格，`\s` 随服务器 locale 变化（C locale 下只认 ASCII 空白），都会放过 `E'TBC\n'`、NBSP 包着的 `TBC` 这类值。非 `known` 的行 `value` / `name` 必须为 NULL。anon 的 RLS 和 `public_*` view 只返回 `known`。
5. **原件不上站**：`media_assets.class = 'original'` 只能有 `source_reference`（NAS / Drive 指针），不能有 `path`；anon 只能读已公开案例实际用到（`project_media` 的 media 或 poster）、且不在 private bucket 的 `derivative`（§3.4）。
6. **权限在数据库**：每张表都开 RLS；anon 只有列级 GRANT + 行级策略；私有预览只能通过 `open_preview()`。
7. **可移植**：标准 Postgres 15+ 能跑；Supabase 专属的东西集中、可识别（§7）。
8. **幂等**：schema 和 seed 都可以重复执行（`IF NOT EXISTS`、`ON CONFLICT DO NOTHING`、`DROP POLICY IF EXISTS` + `CREATE POLICY`、`CREATE OR REPLACE`）。

## 2. 表总览与关系

共 17 张表。重建规范 5.3 提到「15 张表」，但表名和字段在仓库里没有记录；本设计**不**声称与 v0.2 原文一致，原文入库后要逐表核对（ADR Q1）。

| # | 表 | 用途 | 关键关系 |
| --- | --- | --- | --- |
| 1 | `admin_users` | Admin 账户与角色（`owner` / `editor`） | `user_id` = `auth.users.id`（Supabase） |
| 2 | `projects` | 案例主表：slug、文案、layout、publication status | — |
| 3 | `rights_clearances` | 授权 / 清权证据（公开展示、肖像、未成年人、产品声明、音乐、场地、署名） | → `projects` |
| 4 | `project_facts` | 事实列表（Channels、Role、Date、Results…），含 `state` | → `projects` |
| 5 | `project_credits` | 署名（role / name / state） | → `projects` |
| 6 | `media_assets` | 媒体文件：original vs derivative、variant、路径 | → `projects`，`derived_from` → 自身 |
| 7 | `content_blocks` | 模块化 block（11 种 type + `props jsonb`） | → `projects` |
| 8 | `project_media` | 媒体在案例里的用法：hero / gallery / film / block，含 alt、ratio、poster | → `projects`、`media_assets`、`content_blocks` |
| 9 | `collections` | 展示集合（餐饮集合、首页精选） | — |
| 10 | `collection_projects` | 集合成员与顺序 | → `collections`、`projects` |
| 11 | `inquiries` | 询盘：Name / Email / Message，状态默认 `NEW` | `assigned_to` → `admin_users` |
| 12 | `inquiry_events` | pipeline：状态变化、备注、已回复 | → `inquiries` |
| 13 | `inquiry_reply_drafts` | AI / 人工回复草稿；只有人工能标记已发送 | → `inquiries`、`admin_users` |
| 14 | `preview_links` | 私有预览链接：token 哈希、7 天过期、撤销、VIEW_ONLY | — |
| 15 | `preview_link_projects` | 每个链接能看到哪些案例 | → `preview_links`、`projects` |
| 16 | `preview_views` | 访问统计（每次打开记 granted / expired / revoked） | → `preview_links` |
| 17 | `audit_log` | 审计（append-only） | — |

```text
admin_users ─┬─< inquiries ─┬─< inquiry_events
             │              └─< inquiry_reply_drafts (sent_by → admin_users)
             └─ (actor in audit_log / preview_links.created_by, not FK)

projects ─┬─< rights_clearances
          ├─< project_facts
          ├─< project_credits
          ├─< content_blocks ─< project_media (usage = 'block')
          ├─< project_media >── media_assets ──(derived_from)── media_assets[original]
          ├─< collection_projects >── collections
          └─< preview_link_projects >── preview_links ─< preview_views
```

## 3. 逐表要点

### 3.1 `projects`

| 列 | 说明 |
| --- | --- |
| `id uuid` | 内部主键 |
| `slug` | 唯一，`^[a-z0-9]+(-[a-z0-9]+)*$`。保持现有 URL 不变（U2 已按 slug 取数） |
| `client_name`、`category`、`discipline` | `discipline` 是 enum，四个值与 `CaseStudy["discipline"]` 原样一致 |
| `scope`、`summary`、`challenge`、`response`、`outcome` | 叙述文案 |
| `hero_caption` | **公开**的 hero 说明；迁移时为 NULL |
| `layout` | `legacy_template`（固定模板）或 `blocks` |
| `sort_order` | 旧数组顺序（1–36），只作默认排序，不再作为身份 |
| `project_date date` | 能精确解析时才填（目前只有 Spin Panda：2026-08-22） |
| `publication_status` | `internal` → `in_review` → `approved` → `published` → `withdrawn` |
| `published_at`、`withdrawn_at` | 触发器自动填 |
| `legacy_media_notice`、`internal_notes` | 内部字段，anon 无列权限 |
| `version`、`updated_at`、`updated_by` | 每次 UPDATE 自增 / 自动写入（规范 8.1 version） |

**发布守卫（`projects_guard` 触发器）**

- `approved` / `published` 需要 `has_public_clearance(id)`；INSERT 时直接写这两个状态一律拒绝（还没有授权行）。
- `editor` 只能在 `internal` ↔ `in_review` 之间切换；批准、发布、撤回只有 `owner`。
- `rights_clearances` 被改成 `revoked` / `denied` 或删除后，如果项目不再有有效授权，`rights_withdraw` 触发器自动把 `approved` / `published` 改成 `withdrawn`。
- 发布仍然要「重新构建 + 原子切换」才上线（ADR D2）；数据库状态变化不会立即改变静态站。

### 3.2 `rights_clearances`

- `kind`：`public_display`、`client_name`、`talent_release`、`minor_release`、`product_claims`、`music`、`location`、`credits`。
- `status`：`unverified_claim`（只有说法，没有原始凭据）、`requested`、`verified`、`denied`、`revoked`。
- `verified` 的 CHECK：`granted_by`、`granted_on`、`evidence_location` 必须都有。`evidence_location` 写邮件 ID、合同路径、文档路径等，**不存文件本体**。
- `expires_on` 过期后 `has_public_clearance()` 不再成立。anon 的 RLS 和 `public_*` view 都同时检查 `published` **和** `has_public_clearance()`，所以授权一过期，anon 立即读不到该案例；但 `publication_status` 本身仍是 `published`，要靠 owner 或定时任务改成 `withdrawn`（§9）。已上线的静态站要等下一次构建才会去掉它。
- 唯一键 `(project_id, kind, source)` 让 seed 可以幂等重放。

### 3.3 `project_facts` / `project_credits`

- facts 唯一键 `(project_id, label)`；credits 唯一键 `(project_id, sort_order)`。
- `withheld` 表示「知道但不公开」（比如客户要求不写日期），与 `unknown` 一样不渲染。
- 模块化 `facts` / `credits` block 的 `items` **不**存在 `props` 里（CHECK `blocks_no_inline_facts`），渲染时从这两张表取，避免两份数据漂移。

### 3.4 `media_assets` / `project_media`

| `class` | 允许的存放 | 约束 |
| --- | --- | --- |
| `original` | 只有 `source_reference`（NAS / Drive 内部指针） | `path`、`storage_bucket` 必须为 NULL，`variant = 'source'` |
| `derivative` | `path`（`portfolio/...` 逻辑路径），非公开时可选 `storage_bucket`（有值 = 在 private bucket，anon 永远读不到） | `path` 不以 `/` 开头、不含 `..`、必须以 `portfolio/` 开头；`variant` ≠ `source` |

- `variant`：`2400` / `1600` / `1200` / `800` / `thumbnail`（规范 7.3）、`web_video`、`legacy`（现有单尺寸文件）。
- 同一个 `path` 全库唯一。导出脚本会在一个文件被两个案例共用时报错（目前没有）。
- 公开构建（ADR D4）只复制「anon 能读到的」derivative：所属案例已公开（`is_public_project()`）、`storage_bucket` 为 NULL，并且被已公开案例的 `project_media` 用作 media 或 film poster（`media_anon_read` 策略）。只登记、没放进 `project_media` 的文件（落选图、未清权的肖像帧等），放在 private bucket 里的文件，以及内部案例的文件被放到已公开案例页面上的，即使案例已发布 anon 也读不到，不会被复制进 Web root。`project_media` 行本身按案例是否公开返回，可能指向 anon 读不到的文件，渲染时跳过。原件永远不会出现在 anon 结果、`open_preview()` payload 或 Web root。
- `project_media.usage`：`hero`、`gallery`、`film`、`block`（`block` 必须带 `block_id`）。film 的 poster 用 `poster_id`。`alt`、`title`、`caption`、`aspect_ratio`（`"3 / 2"` 格式，保持原比例）放在用法层，因为同一张图作 hero 和 poster 时 alt 可能不同。

### 3.5 `content_blocks`

- `type` enum：`hero`、`intro`、`facts`、`gallery`、`video`、`fullImage`、`twoColumn`、`deliverables`、`credits`、`bts`、`next`（与 `CaseStudyBlock` 一一对应）。
- `props jsonb` = block 去掉 `type` 后的其余字段，必须是 object。媒体（`image`、`images`、`films`…）挪到 `project_media`；`next` 必须有字符串 `slug`。
- `public_content_blocks` view 会去掉指向非公开案例的 `next` block（Spin Panda 的 `next → dr-lewinn` 在 dr-lewinn 公开前不会出现）。

### 3.6 `collections` / `collection_projects`

- 餐饮集合页 `/work/food-hospitality/` 迁成 `collections.slug = 'food-hospitality'`，成员 = `discipline = 'Food + hospitality'` 的案例。集合**不是**授权：anon 只能看到 `is_public` 的集合里**已发布**的成员。
- 首页精选：`slug = 'home-featured'`、`is_featured_list = true`、`provisional = true`，迁移时为空。按 `DECISIONS.md` 2026-10-31，选定前只能用已授权案例占位、不凑数；V2 里由 owner 在 Admin 里填。

### 3.7 `inquiries` / `inquiry_events` / `inquiry_reply_drafts`

- `inquiries`：`name`（≤200）、`email`（≤320，基本格式校验，不允许 ASCII 空白）、`message`（≤5000）。长度都按**原始值**算：anon 可以不经 API 直接经 PostgREST INSERT，用空白填充也写不进超长内容。`name` / `message` 还必须至少有一个非空白字符（「空白」同原则 4），只有空白算空。`status` 默认 `NEW`、`source` 默认 `website_form`、`dedupe_key`（API 生成的去重键，16–128 字符，唯一）。
- 状态 enum：`NEW`、`IN_PROGRESS`、`REPLIED`、`WON`、`LOST`、`SPAM`、`ARCHIVED`。除 `NEW`（规范 6.2）外都是提议，U9 可以用 `ALTER TYPE ... ADD VALUE IF NOT EXISTS` 扩展。
- `inquiry_reply_drafts.generated_by` 是 `ai` 或 `human`；CHECK `drafts_sent_by_human`：`sent_at` 有值时 `sent_by`（admin 用户）必填。数据库没有「AI 发信」这条路径（规范 6.4）。
- 审计：这两张表的 audit 只记 action 和 row id，不复制姓名 / 邮箱 / 留言（ADR D5 日志不泄露个人信息）。
- 不存 IP / UA（ADR Q9 未决）。

### 3.8 `preview_links` / `preview_link_projects` / `preview_views`

- token：`create_preview_link()` 用两次 `gen_random_uuid()`（`pg_strong_random`，共 244 bit 随机）生成 URL-safe 字符串，**只返回一次**；表里只存 `sha256(token)`（`bytea`，32 字节）。不依赖 pgcrypto。
- `expires_at` 默认 `now() + 7 days`；`revoked_at` 撤销。是否允许自定义时长、是否设上限是 ADR Q16，目前只要求 `expires_at > created_at`。
- `access`：`VIEW_ONLY`（默认）或 `DOWNLOAD_DERIVATIVES`。VIEW_ONLY **不**承诺防截图或绝对防下载；允许下载时也只给衍生文件。
- `open_preview(token)`（SECURITY DEFINER，anon 可执行）：未知 token 直接返回空；已知 token 每次都写 `preview_views`（granted / expired / revoked）；只有 granted 才返回该链接范围内的案例 payload（known facts / credits、blocks、derivative 媒体路径），不含 `legacy_media_notice`、授权记录或原件。签名 URL 由 API 根据 payload 里的路径另行签发（Supabase Storage，§7）。
- anon 对这三张表没有任何权限，不能枚举链接或统计。

### 3.9 `admin_users` / `audit_log`

- 角色：`owner`、`editor`（ADR D3；是否需要 editor 是 Q15）。`active = false` 立即失去所有 admin 权限。注册由 Supabase Auth 邀请完成，这张表只管角色。
- `audit_log`：`actor`（`auth.uid()`）、`db_role`（anon / authenticated / service_role / postgres）、`action`、`table_name`、`row_id`、`before` / `after`（jsonb，`preview_links` 去掉 `token_hash`）。
- append-only：UPDATE / DELETE / TRUNCATE 由触发器拒绝；只有 owner 能读。数据库超级用户仍可绕过（删触发器 / 删表），这一层靠运维和备份，不靠 schema。

## 4. 状态机

```text
publication_status:
  internal ⇄ in_review            (editor 或 owner)
  in_review → approved → published (owner；需要 verified public_display)
  published / approved → withdrawn (owner 手动，或授权被撤销时自动)
  withdrawn → in_review / internal (owner)

clearance_status:
  unverified_claim → requested → verified (owner，必须带证据)
                               ↘ denied
  verified → revoked               (触发项目自动 withdrawn)
```

## 5. 迁移映射（`app/_data/site.ts` → V2）

由 `scripts/export-v2-seed.mjs` 实现。所有 36 条：`publication_status = 'internal'`、`published_at = NULL`。

### 5.1 `CaseStudy` 字段

| `CaseStudy` 字段 | V2 位置 | 规则 |
| --- | --- | --- |
| `slug` | `projects.slug` | 原样；冲突键 |
| `client` | `projects.client_name` | 原样（含中文名，如 `春舍鲜厨`） |
| `category` | `projects.category` | 原样 |
| `discipline` | `projects.discipline` | enum 值与原字符串一致 |
| `image` | `media_assets`（derivative / `legacy`，`path` 去掉开头 `/`）+ `project_media`（`usage = 'hero'`、`position = 0`） | |
| `alt` | `project_media.alt`（hero 行） | |
| `scope`、`summary`、`challenge`、`response`、`outcome` | `projects` 同名列 | 原样 |
| `channels` | `project_facts`：label `Channels` | 占位 / 空 → `unknown` |
| `role` | `project_facts`：label `First Rec. role` | 同上；「Public credits to confirm」这类原文保留为 `known`，不擅自改写 |
| `mediaPartner?` | `project_facts`：label `Media partner` | 只在有该字段时生成 |
| `date?` | `project_facts`：label `Date`；能解析为 `D Month YYYY` 时同时写 `projects.project_date` | 解析失败只保留文本 |
| `mediaNotice` | `projects.legacy_media_notice`（内部） | **不**解析为授权；见 5.3 |
| `gallery[]` | 每张图 → `media_assets` + `project_media`（`usage = 'gallery'`，`position` = 数组下标，`alt`、`aspect_ratio` = `ratio`） | |
| `film` / `films[]` | `src` → `media_assets`（`kind = 'video'`，`mime_type` = `type` 或按扩展名推断）；`poster` → `media_assets`（image）；`project_media`（`usage = 'film'`，`title`，`poster_id`） | `film` 视为长度 1 的 `films` |
| `blocks?` | 见 5.2；`projects.layout = 'blocks'`，否则 `legacy_template` | |
| 数组下标 | `projects.sort_order`（1–36） | 只作默认排序 |
| （新） `hero_caption` | NULL | 见 5.4 |

### 5.2 `blocks`（目前只有 `spin-panda`，10 个 block）

| block | 迁移 |
| --- | --- |
| 所有 block | `content_blocks(position = 数组下标, type, props = 其余字段)` |
| `facts.items[]` | 合并进 `project_facts`（按 label 去重；与字段值冲突时脚本报错）。没有 `value` 的（Spin Panda 的 `Results`）→ `state = 'unknown'`、`value = NULL` |
| `credits.items[]` | `project_credits`；没有 `name` → `unknown` |
| `gallery.images` / `bts.images` / `video.films` / `fullImage.image` | 若存在，挪到 `project_media(usage = 'block', block_id)`；目前 Spin Panda 这些 block 都没有内联媒体，渲染时回退到案例本身的 hero / gallery / film |
| `next.slug` | 留在 `props.slug` |
| `deliverables.items`、`twoColumn.columns`、`intro.text` 等 | 原样留在 `props` |

### 5.3 授权依据

| 案例 | 迁移结果 |
| --- | --- |
| 6 条 `Public display authorised`：`spin-panda`、`dr-lewinn`、`indiba-icc`、`jo-loves`、`mm-karaoke`、`nvidia` | 各一条 `rights_clearances(kind = 'public_display', status = 'unverified_claim', source = 'app/_data/site.ts mediaNotice')`，`notes` 写原文。`indiba-icc` / `jo-loves` / `mm-karaoke` / `nvidia` 的 `evidence_location` 指向 `docs/PORTFOLIO-INGESTION-2026-09-01-LOCAL.md`（仓库内记录了用户的明确指示，但不是原始客户批准）；`spin-panda`、`dr-lewinn` 为 NULL（仓库里找不到原始凭据，旧 handoff §5） |
| 其余 30 条 | 不生成授权行（没有证据就是空） |

都保持 `internal`。要公开，owner 必须补一条带证据的 `verified` 记录再逐条发布（ADR D7 第 5 条）。

### 5.4 渲染层需要跟着改的地方（V2 前台实现单元）

- 现在 `CaseStudyBlocks.tsx` 的 `fullImage` caption 和 `video` note 会回退到 `project.mediaNotice`。V2 里 `mediaNotice` 是内部字段，公开快照里没有；改为回退到 `hero_caption`（或不显示）。
- `facts` / `credits` block 从 `public_project_facts` / `public_project_credits` 取数据。
- `next` block 只用 `public_content_blocks`。

### 5.5 迁移数量（以 2026-10-31 的 `site.ts` 为准，测试会核对其中关键项）

36 projects、0 published、75 facts（74 known + 1 unknown）、3 credits、10 blocks、136 media assets（全部 derivative / legacy）、134 placements、6 unverified claims、2 collections。现有 30 个非授权案例的衍生图在创始人 Mac 上，不在仓库里（`HANDOFF.md` §6b）；seed 只登记路径，不搬文件。

## 6. RLS 设计

角色：`anon`（未登录，公开构建快照 / 询盘表单 / 预览页）、`authenticated`（登录用户，权限再由 `admin_users.role` 决定）、`service_role`（服务端：API、构建脚本、迁移；`BYPASSRLS`）。

**先撤后授**：Supabase 默认给 `anon`、`authenticated` 授予 public schema 新表的全部权限，所以 schema 先 `REVOKE ALL`，再按下表精确 GRANT。辅助函数 `is_admin()`、`is_owner()`、`is_public_project()`、`has_public_clearance()` 都是 `SECURITY DEFINER`、固定 `search_path`。

| 表 | anon | authenticated（非 admin） | editor | owner | service_role |
| --- | --- | --- | --- | --- | --- |
| `projects` | SELECT 公开列，仅 `published` 且授权未过期的行 | 无行 | 读写；不能 approve / publish / withdraw | 全部 | 全部 |
| `rights_clearances` | 无权限 | 无行 | 只读 | 读写 | 全部 |
| `project_facts` / `project_credits` | 仅已发布案例的 `known` 行 | 无行 | 读写 | 读写 | 全部 |
| `content_blocks` / `project_media` | 仅已发布案例 | 无行 | 读写 | 读写 | 全部 |
| `media_assets` | 仅已发布案例**实际引用**（`project_media` 的 media / poster）且 `storage_bucket` 为 NULL 的 `derivative`；无 `source_reference` / `storage_bucket` 列 | 无行 | 读写 | 读写 | 全部 |
| `collections` / `collection_projects` | 仅 `is_public` 集合 × 已发布案例 | 无行 | 读写 | 读写 | 全部 |
| `inquiries` | **只 INSERT**（name、email、message、dedupe_key 列）；策略要求 `status = 'NEW'`；不能 SELECT，因此也不能 `RETURNING` | 无行 | 无行 | 读写 | 全部 |
| `inquiry_events` / `inquiry_reply_drafts` | 无权限 | 无行 | 无行 | 读写 | 全部 |
| `preview_links` / `preview_link_projects` | 无权限（只能调用 `open_preview()`） | 无行 | 无行（不能建链接） | 读写、撤销 | 全部 |
| `preview_views` | 无权限 | 无行 | 无行 | 只读 | 全部 |
| `admin_users` | 无权限 | 无行 | 只读自己那一行 | 读写 | 全部 |
| `audit_log` | 无权限 | 无行 | 无行 | 只读 | 写（仍被 append-only 触发器限制） |

公开 view（`security_invoker = true`，调用者的 RLS 照样生效）：`public_projects`、`public_project_facts`、`public_project_credits`、`public_content_blocks`。构建脚本建议用 anon 角色（或专用只读角色）读这些 view 生成快照，而不是用 `service_role`——这样 RLS 出错时最多漏掉内容，不会多放内容（ADR D2 第 2 条）。

## 7. Supabase 专属部分与可移植性

| 位置 | Supabase 行为 | 纯 Postgres 行为 |
| --- | --- | --- |
| 角色 `anon` / `authenticated` / `service_role` | 已存在，schema 跳过创建 | schema 创建（NOLOGIN；`service_role` BYPASSRLS） |
| `auth.uid()` | GoTrue 自带，schema 跳过 | 创建兼容 shim，读 `request.jwt.claim.sub` / `request.jwt.claims` |
| `admin_users.user_id → auth.users(id)` FK | `auth.users` 存在时自动加 | 不加；应用层保证 |
| RLS、列权限、`security_invoker` view、`SECURITY DEFINER` 函数 | 标准 Postgres | 相同 |
| Storage（private bucket、签名 URL） | **不在本 SQL 里**。建议另写 Supabase-only migration：建 private bucket（如 `media-private`），`storage.objects` 只允许 `service_role`；API 用 service key 签发短时效 URL | 换成 S3 / MinIO 预签名 URL，同样只由 API 签发 |
| Auth 设置（关闭注册、强制 MFA、邀请） | Supabase 配置，不在 SQL 里 | 自建认证 |

其他依赖都是 Postgres 内置：`gen_random_uuid()`（13+）、`sha256()`（11+）、`UNIQUE NULLS NOT DISTINCT`（15+）、`security_invoker`（15+）、`CREATE OR REPLACE TRIGGER`（14+）。**最低 Postgres 15**；没有用扩展。

## 8. 迁移流程与 schema 变更

1. staging（隔离库，不连生产）执行 `psql -v ON_ERROR_STOP=1 -f db/v2-schema.sql`（以库 owner / `postgres` 身份）。
2. `node scripts/export-v2-seed.mjs > seed.sql`，检查后执行 `psql -v ON_ERROR_STOP=1 -f seed.sql`。也可 `--format json` 生成规范化 JSON 交给其他导入工具。
3. 核对：36 条、slug 不变、公开数 = 0（测试里的查询可直接复用）。
4. 重放安全：schema 和 seed 都可以重复执行；seed 用 `ON CONFLICT DO NOTHING`，**不会覆盖**导入后在 Admin 里改过的内容。若要按 `site.ts` 重新同步，需要另写明确的 upsert，不能默认覆盖人工修改（规范 8.1）。
5. **schema 变更**：`CREATE TABLE IF NOT EXISTS` 不会修改已有表的列或约束。`db/v2-schema.sql` 是基线；上线后的任何变更都要写成新的、带编号的 migration 文件（例如 `db/migrations/0002_*.sql`，用 `ALTER ... IF NOT EXISTS` / `ALTER TYPE ... ADD VALUE IF NOT EXISTS`），先在 staging 跑。格式最终由实现单元确定。

**为什么用 Node 直接 import `site.ts`**：Node 22.18+ 默认开启 type stripping，可以直接 `import()` `.ts` 文件；`site.ts` 只用了可擦除的语法（类型注解和 `import type`），不需要 tsc / esbuild。`package.json` 允许 `>=22.13`，22.13–22.17 需要 `--experimental-strip-types`，脚本检测到 `ERR_UNKNOWN_FILE_EXTENSION` 时会自动带上这个参数重新执行自己。这样不用写一个脆弱的 `site.ts` 文本解析器，数据和运行中的站点完全同源。本机实测 Node 22.22.0 直接可用；22.13–22.17 的回退路径**没有**实测。

## 9. 遗留与开放问题

- **授权过期**：读取层已经隐藏（§3.2），但状态不会自动改成 `withdrawn`，也不会自动触发重新构建；是否加定时任务由实现单元决定。
- **预览链接时长上限 / 密码**：ADR Q16。
- **询盘状态枚举**：除 `NEW` 外均为提议，U9 定稿。
- **IP / UA 是否记录**：ADR Q9；目前 `preview_views`、`inquiries` 都不存。
- **反滥用**：`dedupe_key` 重复会报唯一约束错误，API 要把它当作「已收到」处理，不要把错误回显给用户；限速、honeypot、Turnstile 在 API 层（ADR D5）。
- **71 条内部 Drive 索引**：不在本 schema 里（ADR Q8）。
- **Analytics、通知**：未建表（规范 8.3、8.2 细节未知）。
- **与 v0.2 原文核对**：表数（17 vs 15）、角色、状态名都要在原文入库后重核。

## 10. 验证记录（2026-10-31，本容器）

`tests/v2-schema.test.mjs` 在**临时**集群上运行：`initdb` 到系统临时目录，只开 Unix socket（`listen_addresses=''`），测试结束 `pg_ctl stop` 并删除目录；不连接任何已有数据库。找不到 PostgreSQL 时整组测试 skip 并打印「V2 schema NOT verified」。

已在本容器的 **PostgreSQL 16**（`/usr/lib/postgresql/16/bin`）上实际通过：

- schema 连续执行两次成功；17 张表全部开启 RLS。
- seed 连续执行两次，各表行数不变；36 条全部 `internal`、`published_at` 为空；6 条授权全部 `unverified_claim`；没有 original 媒体；Spin Panda 为 10 个 block，facts / credits 的 `items` 不在 `props`，`Results` 为 `unknown`。
- 约束：无证据的 `verified`、直接插入 `published`、未授权就发布、`TBC` 作为 known fact、unknown 带值、无名 known credit、带 path 的 original、绝对路径 / `..` 路径、inline facts、无 slug 的 `next`、非法邮箱 / 空姓名、未标人工就「已发送」的草稿、过期时间早于创建时间、修改 / 删除 `audit_log`——全部被拒绝。
- known 值与 `known()` 一致：`E'TBC\n'`、`E'\tTBC'`、只有换行、NBSP / U+3000 / BOM 包着的占位符或空白作为 known fact，`TBC`、`E'n/a\n'`、只有 NBSP 的 known credit，全部被拒绝；`E' 2025\n'`、`Pending approval`、`N/A Studio` 这类 `known()` 会显示的值仍可写入。
- anon：发布前读到 0 行；发布 2 条（测试用 fixture 证据）后只看到这 2 条；读内部列、`SELECT *`、授权表、admin / audit / preview / CRM 表、UPDATE 都 permission denied；facts 只有 known，媒体只有 derivative，`next → 非公开案例` 被 view 去掉；私有集合不可见。
- 媒体：已发布案例下只登记没放置的、放在 private bucket 的（包括已放置的）derivative，以及内部案例放到已发布案例页面上的 derivative，anon 都读不到；只作 film poster 的能读到；anon 能读到的每个文件都被 `project_media` 引用。
- 询盘：anon 能 INSERT，不能 SELECT、不能 `RETURNING`、不能设 `status`、不能 UPDATE；落库状态 `NEW`；审计不含个人信息。用空白把 name 填到 201 字符、message 填到 5001 字符、email 末尾加空白，以及只有空白的 name / message，都被拒绝；恰好 200 / 5000 / 320 字符可以写入。
- authenticated：非 admin 看到 0 行；editor 能改文案、不能撤回 / 发布、不能写授权、看不到询盘和审计；owner 能看到询盘；审计记录了 editor 的 `actor` 和 `db_role = authenticated`。
- 预览：editor 不能建链接；owner 建的链接默认 7 天；明文 token 不出现在审计里；anon 不能读 `preview_links`；有效 token 只返回该链接范围内的案例，payload 里无 `legacy_media_notice`；错误 / 未知 token、撤销后、过期后都返回 0 行；访问统计按 granted / revoked / expired 记录。
- 授权撤销后，已发布案例自动变为 `withdrawn`，anon 不再看到。
- 授权过期（`expires_on` 已过）但状态仍是 `published` 时，anon 对该案例的 projects / view / facts / media 都读到 0 行。

**没有验证的**：

- 真实 Supabase（GoTrue `auth.uid()`、PostgREST、`auth.users` FK 分支、Supabase 默认权限下的行为、Storage 签名 URL）——测试用的是 shim 和本地角色。
- PostgreSQL 15 / 17（只测了 16）。
- 任何 staging / 生产数据库；任何**备份或恢复**——一次都没有做，不能据此勾选 MVP 条件「数据库备份恢复已验证」。
- 并发、性能、大数据量。
- Node 22.13–22.17 上的 `--experimental-strip-types` 回退路径。
- 媒体文件本身（只登记路径，没有检查文件存在、尺寸或 checksum）。
