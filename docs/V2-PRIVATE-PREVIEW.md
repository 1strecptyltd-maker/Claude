# V2 私有客户预览链接设计（U10）

| 项 | 值 |
| --- | --- |
| 状态 | **Proposed（提议）**——整份文档未经创始人批准；只是设计，不是实现 |
| 日期 | 2026-10-31 |
| 范围 | `docs/HANDOFF-2026-10-17-CLAUDE.md` §7 U10。只写文档：不改代码、不建服务、不动 NAS / NPM / Cloudflare / DNS / Supabase |
| 前提 | `docs/V2-ARCHITECTURE-ADR.md`（ADR-0001 D2 / D3 / D4 §6.2，同为 Proposed）；`docs/Website-V2-Development-Spec-v0.2.md` §7（重建摘要，**不是** v0.2 原文）；`docs/DECISIONS.md`；`docs/V2-INQUIRY-API.md`（同期写的 U9 设计） |
| 并行依赖 | `docs/V2-DATA-CONTRACT.md`（U7）由另一个会话同时撰写，本文写作时看不到。本文用通用表名，§5 列出需要的字段供对齐 |

> **执行门槛**：标 **「Proposed — needs founder sign-off」** 的决策在 §11 签批前不得实施，也不得创建任何主机名、证书、容器、bucket、密钥或第三方配置。

## 0. 需求（只取仓库里有记录的）

| 需求 | 来源 |
| --- | --- |
| 随机 token、**7 天过期**、撤销、访问统计、下载权限、私有媒体保护 | 重建摘要 §7.1；handoff §7 U10 |
| `VIEW_ONLY` 模式；**不承诺**防截图或绝对禁止下载 | 重建摘要 §7.2；handoff §7 U10 |
| 内部记录和原图不能通过猜 URL 绕过 | handoff §7 U10 |
| 原图原片不进网站，只放衍生图（2400 / 1600 / 1200 / 800 / thumbnail） | 重建摘要 §7.3 / §7.5 |
| token 服务端 CSPRNG 生成、≥128 bit、只存哈希；预览页不进公共静态构建 | ADR D4 §6.2（Proposed） |
| 静态 HTML 不能做权限控制；`noindex`、隐藏链接都不是保护 | ADR §1.3；handoff §9 |
| 设计验收后再拆实现单元 | handoff §7 U10 |

## 1. 用户故事

- **创始人（owner）**：在 Admin 里给某个客户生成一个链接，选择要给对方看的案例和具体素材、是否允许下载衍生文件、有效期（默认 7 天），复制链接发给客户；能看到对方是否打开、看了哪些素材；能随时撤销。
- **客户（viewer）**：点开链接，不需要账号，看到一个干净的预览页（图片、网页视频、必要说明）；过期或被撤销后看到明确提示和联系邮箱 `info@firstrec.com.au`。
- **其他人**：拿不到链接就什么也看不到；就算拿到某张图的媒体 URL，过几分钟或离开那个浏览器会话也打不开；无论怎么猜 URL，都碰不到原件、内部记录或别的客户的素材。

## 2. 架构位置与和静态公共站的共存

### 2.1 三个面（沿用 ADR D2）

| 面 | 预览相关内容 |
| --- | --- |
| 公共站（静态导出，NAS Nginx） | **完全不含**预览页、预览路由、预览数据、私有媒体。公共构建不知道预览的存在 |
| 预览服务（动态） | 校验 token、建立会话、渲染预览页、发放签名媒体 URL、流式输出私有媒体、记录访问统计 |
| Admin | 创建 / 列表 / 撤销链接、查看统计（ADR D3 认证 + MFA） |

### 2.2 预览服务放在哪

| 方案 | 做法 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **H1. 独立主机名**（如 `preview.firstrec.work`，切域后 `preview.firstrec.com.au`） | NPM 新主机 → 预览服务容器 | Cookie 与公共站完全隔离；缓存 / 日志 / 安全头规则可以整站统一（全部 `no-store`）；公共站任何问题都碰不到预览会话 | 需要新 DNS 记录和证书；DNS 目前两边未统一（`DECISIONS.md`） |
| H2. 公共站同源路径（`/preview/…`） | NPM custom location，类似 U9 的 `/api/` | 不改 DNS | 与公共站同源：Cookie 只能靠 `Path` 隔离（`Path` 不是安全边界）；Cloudflare 缓存规则要逐路径排除，配错就可能缓存私有页 |

**提议**：H1，先用 DNS 在 Cloudflare 的 `firstrec.work` 建子域（不碰 GoDaddy），切域时再加 `.com.au` 子域并 301。**Proposed — needs founder sign-off**（涉及 DNS 变更，由主线程执行）。

与 U9 不同：询盘 API 只接收一个 POST、没有会话，同源路径的风险很小；预览服务有会话和私有内容，隔离更重要，所以两者选择不同。

### 2.3 运行时

和 U9 一样，提议用一个独立的小型 Node 服务容器（可以与询盘 API 同一代码仓库、不同进程 / 容器，也可以合并为一个服务的两个入口——由实现单元决定）。服务用**专用数据库角色**，只能读取预览相关表和媒体元数据、写入访问事件；用服务端凭据从 Supabase Storage **private** bucket 取文件。Supabase 的 Kong / Storage 端点**不暴露到公网**。**Proposed — needs founder sign-off**（ADR Q4）。

### 2.4 共存规则

1. 公共构建产物里不能出现：预览主机名、预览路由、`preview_` 开头的数据、私有 bucket 名、任何 Storage 路径。U1 / U5 的公开导出边界测试增加这几条断言。
2. 预览页的样式可以复用公共站的 CSS（作为预览服务自己的静态资源打包），但**不能**从公共站加载 JS 或数据。
3. 公共站宕机不影响预览；预览服务宕机不影响公共站（只是预览链接打不开，显示由 NPM 返回的通用错误页，页面上写 `info@firstrec.com.au`）。
4. 预览服务只渲染 owner 在链接里明确选中的内容，不读取公共站数据。

## 3. Token 设计

### 3.1 生成

- 来源：服务端 CSPRNG（Node `crypto.randomBytes`），**32 字节 = 256 bit** 熵。ADR 要求 ≥128 bit，256 bit 让离线和在线猜测都不现实，代价只是 URL 长一点。
- 编码：base64url 无填充 → 43 个字符；加固定前缀 `pv_` 便于识别和密钥扫描（例如 GitHub secret scanning 自定义模式）：`pv_` + 43 字符。
- URL 形态：`https://preview.firstrec.work/p/pv_xxxxxxxx…`。

**Proposed — needs founder sign-off**。

### 3.2 存储

- 数据库只存 `token_hash = SHA-256(token)`（32 字节，唯一索引）。token 熵已经足够高，不需要 bcrypt / argon2 这类慢哈希；慢哈希反而让每次请求都昂贵。
- 可选加固：`HMAC-SHA256(pepper, token)`，pepper 只在预览服务 env 里。好处是只泄露数据库时连「拿哈希比对候选 token」都做不到；代价是 pepper 轮换要重发所有链接。建议**不加 pepper**（256 bit 下收益很小），列为开放问题 PQ-5。
- 另存 `token_hint` = token 最后 4 个字符，Admin 列表里用来辨认链接；不足以缩小猜测空间。
- 明文 token **只在创建时**在 Admin 里显示一次（「Copy link」），之后无法再取回；丢了就撤销重建。
- 明文 token 不进日志、不进审计记录、不进错误追踪、不进分析。

### 3.3 校验

每个请求都查库，不缓存「有效」结论：

```
link = 按 token_hash 查找
不存在                     → 404 通用页（不区分「从未存在」）
link.revoked_at 不为空      → 410 「This preview link is no longer available.」
now ≥ link.expires_at       → 410 「This preview link has expired.」
否则                         → 继续
```

- 过期 / 撤销的提示只在 token 哈希命中时显示——持有 token 的人本来就知道它存在，不额外泄露信息。
- 无效 token 的尝试按 IP 限速（例如 20 次 / 10 分钟，超出 429），主要是降噪和保护 NAS 带宽；256 bit 下限速不是安全前提。
- 比较在数据库唯一索引上完成，不在应用层逐字符比较，不存在可利用的时序差。

## 4. 访问流程

### 4.1 打开链接（防链接预览机器人）

邮件安全网关、Slack / WhatsApp / iMessage 的链接预览会自动 GET 链接。如果 GET 就算「打开」并下发会话，统计会失真，机器人也会拿到会话。

1. `GET /p/{token}`：校验 token；返回一个**不含任何客户内容**的落地页：「First Rec. has shared a private preview with you. [View preview]」。页面没有 OG 图、没有标题里的客户名或案例名，`X-Robots-Tag: noindex, nofollow, noarchive`。这一步只记一条 `link_fetched` 事件（标为可能是机器人）。
2. 用户点按钮 → `POST /p/{token}/open`（带 CSRF token，同源）：再次校验 → 创建**预览会话** → 设置 Cookie → `303` 到 `/v/{link_public_id}`。记一条 `opened` 事件。
3. 之后的页面和媒体请求都靠会话 Cookie，地址栏里不再有 token（浏览器历史仍保留第一步的 URL，这是可接受的残留）。

**Proposed — needs founder sign-off**（多一次点击换来更准确的统计和更少的泄露面）。

### 4.2 会话

- 会话 ID：32 字节 CSPRNG；数据库只存哈希。
- Cookie：`__Host-pv_session`，`Secure; HttpOnly; SameSite=Lax; Path=/`，无 `Domain`（`__Host-` 前缀强制这些属性，绑定到预览主机）。
- 会话有效期 = `min(link.expires_at, 创建后 12 小时)`；过了就要从收到的邮件 / 消息里重新打开原链接、再点一次「View preview」（只要链接还有效）。服务端**无法**替用户跳回落地页：数据库只有 `token_hash`（§3.2），会话、Cookie 和 `/v/{link_public_id}` 里都没有 token，拼不出 `/p/{token}`；本设计也**有意不**在任何地方保留明文或可解密的 token（威胁模型 T7）。所以会话过期时只显示一页「请重新打开收到的链接」（403，§8），不做重定向。**Proposed**。
- Cookie 的 `Max-Age` 取到链接 `expires_at` 为止的剩余时间，而不是会话的 12 小时：会话过期后浏览器仍会带上它，服务端才能认出「这是本链接一个已过期的会话」并显示上面那一页；会话是否有效只看数据库里的 `expires_at`，过期的会话行保留到所属链接过期后再清理。浏览器已经删掉 Cookie 时，服务端分不出「会话过期」和「从未打开」，按下一条的 ① 回 404，404 文案同样请对方重新打开收到的链接（§8）。
- **每个请求**都查库，按顺序判定：① 没有 Cookie、会话哈希查不到，或会话不属于 URL 里的这条链接 → 404；② 所属链接已撤销 / 已过期 → 410（§8 的文案；持有会话的人本来就知道这条链接存在）；③ 会话已过期 → 403（不用 401：这里没有 HTTP 认证质询可发）；④ 否则正常返回。撤销链接立即使所有会话失效，不需要逐个清理。媒体请求 `/m/…` 任何一步不通过都只回 404（§4.5）。
- `link_public_id` 是链接的另一个随机 ID（UUID v4），只用于 URL 路由；它**不是凭据**，没有会话 Cookie 时访问 `/v/{link_public_id}` 一律 404。

### 4.3 预览页

- 服务端渲染，内容只来自该链接的「授权素材清单」（§4.4）和 owner 为该链接写的说明文字；不读取案例的内部字段（授权依据、备注、`mediaNotice` 原文、Drive 索引、询盘等）。
- 文本内容做 HTML 转义，不允许富文本 HTML。
- 响应头（整站统一）：
  - `Cache-Control: no-store, private`
  - `X-Robots-Tag: noindex, nofollow, noarchive`
  - `Referrer-Policy: no-referrer`
  - `Content-Security-Policy: default-src 'none'; img-src 'self'; media-src 'self'; style-src 'self'; script-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`
  - `X-Content-Type-Options: nosniff`
  - `Cross-Origin-Resource-Policy: same-origin`
- **不加载任何第三方资源**（字体、分析、CDN 脚本），这样 token / 会话 / 页面内容不会通过 Referer 或第三方请求外泄。
- Cloudflare：预览主机名整站 Cache Rule「Bypass cache」，并确认不开启任何会改写 HTML 或缓存 HTML 的功能。

### 4.4 逐素材授权

- 链接授权的是**具体素材**，不是「整个案例」。创建链接时 owner 勾选素材，生成「授权素材清单」（快照）。之后往案例里加的新素材**不会**自动出现在旧链接里。**Proposed — needs founder sign-off**。
- 清单里每一项有一个**链接内别名**（`alias`，16 字节随机，base64url）。预览页和媒体 URL 只用别名，不出现内部 `media_asset_id`、Storage 路径、案例 slug 或客户名。
- 每项记录允许的衍生规格（例如 `VIEW_ONLY` 时只允许 1600 / 1200 / 800 / thumbnail 和网页视频；是否允许 2400 由 owner 选择）。
- **原件不在 Storage 里**（ADR D4 §6.1：原件留在 NAS / Drive，不进 Supabase Storage），所以系统里不存在可以指向原件的 URL——不是靠权限挡住，而是根本没有这条路。
- 每次媒体请求都重新检查：别名属于该会话的链接、该素材没有被撤回授权（例如授权依据被删除，或素材被 owner 标为「不可外发」）。授权撤回立即生效。

### 4.5 签名的短时效媒体 URL

媒体不用 Supabase 自带的签名 URL（那要把 Storage 端点暴露到公网），而是由预览服务自己签名、自己转发：

```
/m/{alias}/{variant}?exp={unix_ts}&sig={base64url(HMAC-SHA256(media_key, session_id_hash ‖ alias ‖ variant ‖ exp))}
```

请求处理：

1. 检查 `exp` 未过期、`sig` 用常量时间比较正确。
2. 检查会话 Cookie 有效，且签名里的 `session_id_hash` 就是当前会话——**签名 URL 绑定会话**，复制到别的浏览器或发给别人打不开。
3. 检查链接状态（§3.3）和素材授权（§4.4）。
4. 服务端用 Storage 服务凭据取对象，**流式**返回；视频支持 HTTP `Range`（拖动进度条）。
5. 响应头：`Cache-Control: no-store, private`；`VIEW_ONLY` 时 `Content-Disposition: inline`，允许下载时对「Download」链接用 `attachment; filename="<友好文件名>"`（文件名不含内部 ID）。
6. 记访问事件（§6），视频的 Range 请求合并计数，不按分片计。

时效（**Proposed — needs founder sign-off**）：图片 10 分钟；视频 60 分钟（避免播放中途过期）；页面每次加载重新签。`media_key` 只在预览服务 env 里，支持新旧两把并存以便轮换。

失败一律返回 404（不区分「签名错」「过期」「无权限」），避免给探测者提供信号。

**残留窗口**：撤销链接后，已经签出的 URL 因为第 2、3 步每次都查库，会**立即**失效；已经下载到客户设备上的文件（包括浏览器缓存外被保存的）无法收回——这一点必须在 Admin 界面写明。

### 4.6 `VIEW_ONLY` 与下载权限

| 模式 | 行为 |
| --- | --- |
| `VIEW_ONLY`（默认，提议） | 页面上没有下载按钮；媒体 `Content-Disposition: inline`；只发放 owner 选定的、不高于 1600 的衍生规格（2400 需单独勾选）；视频加 `controlsList="nodownload"`、禁用画中画按钮；可选：服务端生成的可见水印衍生图（PQ-7） |
| `DOWNLOAD_DERIVATIVES` | 页面提供每项和「全部」的下载按钮；下载的仍是**衍生文件**，绝不是原件；每次下载记 `downloaded` 事件 |

**明确声明（写进 Admin 和本文，不可删）**：`VIEW_ONLY` 只是「不提供下载入口、降低随手保存的便利」。浏览器里能显示的东西都能被截图、录屏、用开发者工具或网络抓包保存。**本系统不承诺防截图，也不承诺绝对阻止下载。** 面向客户的文案不得使用 “protected”“cannot be downloaded”“secure from copying” 之类的说法；可以用 “for review only — please don’t share”。`controlsList`、禁右键这类手段只是礼貌提示，不是安全控制，不计入威胁模型的缓解措施。

### 4.7 有效期、撤销、延期

- 默认 `expires_at = created_at + 7 天`（v0.2）。是否允许 owner 调成更短 / 更长、上限多少（建议上限 30 天）——PQ-2。
- 撤销：Admin 一键撤销，写 `revoked_at`、`revoked_by`、可选原因；立即生效（§4.2、§4.5）。
- 延期：建议**不支持原地延期**，到期后重新生成新链接（旧 token 不会无限期存活，泄露面更小）。若创始人希望能延期，则每次延期写审计事件，且不超过上限。**Proposed — needs founder sign-off**。
- 到期 / 撤销的链接保留记录用于统计，按 §6.3 的保留期清理。

## 5. 需要 U7 数据契约提供的表和字段

表名为通用描述，最终以 `docs/V2-DATA-CONTRACT.md` 为准。

**预览链接表**（preview links）

| 字段 | 类型（建议） | 说明 |
| --- | --- | --- |
| `id` | uuid PK | 内部 |
| `public_id` | uuid unique | URL 路由用，非凭据 |
| `token_hash` | bytea unique not null | SHA-256(token) |
| `token_hint` | text | 最后 4 字符 |
| `label` | text | owner 自己看的备注，例如「Client X — round 1」 |
| `recipient_name`, `recipient_email` | text nullable | 可选；是个人信息，计入保留期 |
| `intro_text` | text nullable | 预览页上显示的说明 |
| `permission` | enum `VIEW_ONLY` / `DOWNLOAD_DERIVATIVES` | |
| `created_by` | uuid → 用户 | |
| `created_at`, `expires_at` | timestamptz | `expires_at` 默认 +7 天，有 CHECK 上限 |
| `revoked_at`, `revoked_by`, `revoke_reason` | nullable | |
| `last_opened_at` | timestamptz nullable | 冗余字段，便于列表显示 |
| `retain_until` | timestamptz | |

**链接素材清单表**（preview link assets）：`link_id`、`media_asset_id`、`alias`（unique within link）、`allowed_variants`（text[]）、`sort_order`、`caption_override`（nullable）。唯一约束 `(link_id, media_asset_id)`。

**预览会话表**（preview sessions）：`id`、`session_hash` unique、`link_id`、`created_at`、`expires_at`、`client_ip_hmac`、`ua_family`（粗粒度，如 “Safari / iOS”，不存完整 UA）。

**访问事件表**（preview access events）：`id`、`link_id`、`session_id` nullable、`type`（`link_fetched` / `opened` / `asset_viewed` / `downloaded` / `denied_expired` / `denied_revoked`）、`link_asset_id` nullable、`variant`、`occurred_at`、`client_ip_hmac`、`country`（来自 `CF-IPCountry`，可选，PQ-4）、`likely_bot` boolean。

**媒体资产表**（media assets，由 U7 / 媒体单元定义；本设计需要的字段）：`id`、所属案例、`kind`（image / video）、`storage_bucket`、`storage_key`（随机 UUID 命名，不含 slug / 客户名）、可用衍生规格、`visibility`（`public` / `private`）、`external_share_allowed`（是否允许放进预览链接）、授权依据引用。原件**不**作为媒体资产存储，只可记录「原件位置说明」这一文本字段（admin-only，绝不出现在预览服务的查询里）。

**审计**：创建、撤销、延期（若允许）、素材清单变更都写统一审计表（ADR D3）。

**数据库权限（提议）**：预览服务角色只能 `SELECT` 上述预览表 + 媒体资产表的必要列（通过视图限制列），`INSERT` 会话和访问事件；不能读询盘、授权依据详情、内部备注或用户表。Admin 的创建 / 撤销走 Admin 应用的 owner 权限。

## 6. 访问统计

### 6.1 Admin 里显示

每条链接：状态（有效 / 过期 / 撤销）、创建时间、到期时间、首次打开、最近打开、打开次数（`opened` 事件数）、不同会话数、每个素材的查看次数和下载次数、被拒绝次数（过期 / 撤销后仍有人尝试）。

### 6.2 准确性说明（写进 Admin）

- 「打开」= 有人在落地页点了按钮。链接预览机器人通常不会点击，但不保证。
- 同一个人换浏览器 / 设备会算多个会话；多人共用一个转发的链接无法区分。
- 统计是参考，不是证据。

### 6.3 隐私与保留（**Proposed — needs founder sign-off**，对应 ADR Q9）

- 不存原始 IP，只存 `HMAC(daily_salt, ip)`（与 U9 相同做法），30 天后置空；不存完整 User-Agent。
- 国家字段可选（PQ-4）。
- 访问事件保留 12 个月；链接记录（含 `recipient_name` / `recipient_email`）在过期后保留 12 个月，然后删除个人字段。
- 预览访问者也是被收集信息的个人：隐私政策（U9 OQ-9）需要提到预览链接的访问记录。落地页加一行 “Views of this preview are logged for First Rec.’s records. Privacy notice →”。
- 日志：NPM 对预览主机名的 access log 会记录 URL 路径，第一步的 URL 里有明文 token。**必须**为该主机关闭 access log，或配置成不记录路径；预览服务自己的日志只记 `link.id`，不记 token、会话 ID、签名。

## 7. 威胁模型

| # | 威胁 | 攻击方式 | 缓解 | 残留风险 |
| --- | --- | --- | --- | --- |
| T1 | 猜 token | 枚举 `/p/…` | 256 bit 随机；无效尝试限速；无效统一 404 | 可忽略 |
| T2 | 猜内部 URL / 媒体路径 | 枚举 `/v/{id}`、`/m/{alias}`、Storage key、公共站 `/portfolio/…` | `/v` 需会话；`/m` 需签名 + 会话 + 授权；别名随机；Storage 不暴露公网、key 为 UUID；公共构建只含已发布素材（ADR D4） | 可忽略 |
| T3 | 越权看别的素材（IDOR） | 在合法会话里改 alias / variant | 别名按链接隔离；每次请求校验「别名 ∈ 本链接」「variant ∈ allowed_variants」 | 低 |
| T4 | 拿到原件 | 任何路径 | 原件不在 Storage、不在 Web root；预览服务没有访问原件位置的权限 | 无（设计上不存在路径） |
| T5 | 看到内部记录 | 通过预览页、错误信息、API 响应 | 预览服务角色只能读视图里的必要列；错误页不带堆栈 / SQL；页面只渲染清单内容 | 低 |
| T6 | token 被转发 / 泄露给第三人 | 客户转发邮件、群聊 | 7 天过期；随时撤销；统计里能看到异常的多会话 / 多国家；`recipient` 标签便于追溯 | **接受**：持有链接即可查看，这是「无账号链接」的本质。需要更强时用 PQ-6 的第二因子 |
| T7 | token 进日志 / 历史 / Referer / Cookie | 代理日志、浏览器历史、外链 Referer、被盗的 Cookie | 关闭预览主机 access log；落地页后立刻换成会话、地址栏去 token；`Referrer-Policy: no-referrer`；页面无外链 / 第三方资源；明文或可解密的 token 不进 Cookie、会话表或任何 URL（偷到 Cookie 最多拿到一个 12 小时的会话，拿不到 7 天的链接）——代价是会话过期后服务端拼不出 `/p/{token}`，只能请对方重新打开原链接（§4.2、§8） | 浏览器历史残留：接受；会话过期后要回原邮件重新打开链接：接受 |
| T8 | 链接预览机器人 | 邮件网关 / IM 自动抓取 | GET 只给无内容落地页；POST 才开会话；落地页无 OG 内容 | 统计偶有误差 |
| T9 | 签名 URL 被分享 | 复制 `/m/…` 发给别人 | 签名绑定会话 Cookie；10 / 60 分钟过期 | 低 |
| T10 | 撤销后继续访问 | 撤销前已打开的页面、已签 URL | 每个请求查库；撤销立即生效 | 已下载 / 已截图的内容：**接受，无法收回** |
| T11 | 截图、录屏、开发者工具保存 | 客户端 | 不可防；`VIEW_ONLY` 降低便利；可选可见水印 | **接受，明确不承诺** |
| T12 | 数据库泄露 | 备份被盗、SQL 注入 | 只存 token / 会话哈希；参数化查询；备份加密（ADR D6）；最小权限角色 | 链接元数据（标签、收件人）泄露：低-中 |
| T13 | Cloudflare / 代理缓存私有内容 | 缓存规则配错 | 整站 `no-store, private`；Cloudflare 主机级 bypass；上线检查用两个独立会话交叉验证 | 低（要靠上线检查） |
| T14 | 被搜索引擎收录 | 链接被贴到公开网页 | `X-Robots-Tag`；落地页无内容；需 POST 才能看内容 | 低 |
| T15 | XSS 偷会话 | 注入说明文字 / 文件名 | 全部转义；严格 CSP；HttpOnly Cookie | 低 |
| T16 | Admin 被攻破后批量发链接 | 盗号 | ADR D3：仅邀请、MFA、网络层限制；所有创建 / 撤销写审计；Admin 列表能一键撤销全部 | 中，取决于 D3 落实 |
| T17 | CSRF 撤销 / 创建链接 | Admin 被跨站请求 | Admin 用 SameSite Cookie + CSRF token；落地页 POST 带 CSRF token | 低 |
| T18 | 带宽耗尽 / DoS | 反复拉大视频 | Cloudflare 代理；每会话 / 每 IP 媒体限速；视频只发网页规格 | NAS 上行有限，中（ADR §12 已列） |
| T19 | 授权撤回后仍可外发 | 素材授权被取消但旧链接还在 | 每次媒体请求检查 `external_share_allowed` 和授权状态 | 低 |
| T20 | public 仓库暴露路由和字段名 | 读源码 | 安全性不依赖保密路由；无密钥入库（ADR Q13） | 接受 |

## 8. 错误与用户可见文案（英文）

| 情况 | HTTP | 文案 |
| --- | --- | --- |
| 无效 token / 无会话（含浏览器已删掉过期会话的 Cookie）/ 媒体 404 | 404 | “This page isn’t available. If you were sent a preview link, please open it again from the message you received, or contact info@firstrec.com.au.” |
| 已过期 | 410 | “This preview link has expired. Please contact info@firstrec.com.au for a new one.” |
| 已撤销 | 410 | “This preview link is no longer available. Please contact info@firstrec.com.au.” |
| 会话已结束（浏览器带着本链接已过期的会话 Cookie，链接仍有效；§4.2 ③） | 403 | “Your viewing session has ended. Please open the preview link you were sent again to keep viewing, or contact info@firstrec.com.au.” 不重定向：服务端没有 token，拼不出落地页地址（§4.2）。页面和落地页一样不含任何客户或案例内容 |
| 限速 | 429 | “Too many requests. Please wait a few minutes and try again.” |
| 服务故障 | 503 | “The preview is temporarily unavailable. Please try again later or contact info@firstrec.com.au.” |

## 9. 测试计划（只用隔离临时后端）

- 临时 Postgres（或 Supabase CLI 本地栈）+ 临时 Storage（本地 MinIO 或 Supabase 本地 Storage），每次测试创建、结束销毁；样例图片 / 视频用自己生成的测试文件，**不用任何客户素材**。
- 用例至少覆盖：token 生成长度 / 字符集 / 唯一性；数据库里只有哈希；明文不出现在任何日志（grep）；7 天边界（时钟模拟）；撤销后页面、已签 URL、会话立即失效；会话过期（时钟快进 12 小时、链接仍有效）：带旧 Cookie 访问 `/v/{public_id}` 得到 403「session ended」页，没有 `Location`、不含客户内容，不带 Cookie 得到 404，`/m/…` 得到 404，重新打开 `/p/{token}` 并点击后恢复访问，带旧 Cookie 但链接已撤销 / 过期得到 410；签名篡改 / 过期 / 换会话 / 换 alias / 换 variant 全部 404；跨链接 IDOR；`VIEW_ONLY` 下无下载入口、`Content-Disposition: inline`、不发 2400（未勾选时）；`DOWNLOAD_DERIVATIVES` 只给衍生文件；GET 落地页不创建会话；所有响应头（§4.3）；Range 请求；统计计数正确、机器人 GET 不计入 `opened`；公共站构建产物里没有任何预览痕迹。
- 上线前在 staging 由人工用两台设备 / 两个浏览器交叉验证 Cloudflare 不缓存。

## 10. 后续实现单元

每个单元的精确文件路径在派工前按实际仓库结构列出（handoff §7 派工规则）。

| 单元 | 依赖 | 范围 | 验收 |
| --- | --- | --- | --- |
| **P1 数据契约对齐** | U7 | 把 §5 的表 / 字段 / 角色 / 视图并入 `docs/V2-DATA-CONTRACT.md` 和 migration；RLS / 列级权限 | 临时库测试：预览角色读不到询盘、授权详情、内部备注 |
| **P2 token 与签名库** | P1 | token 生成 / 哈希 / 校验、会话 ID、媒体 URL HMAC 签名与校验、密钥轮换（双 key） | 单元测试：长度、熵来源、常量时间比较、篡改 / 过期 / 跨会话失败 |
| **P3 预览服务骨架** | P2、PQ-1 | 独立服务（不在公共站静态导出里）：`/p/{token}` 落地页、`POST /open`、会话 Cookie、`/v/{public_id}` 渲染、统一安全头、错误页、限速 | §9 的流程与响应头用例；公共构建边界测试新增断言通过 |
| **P4 媒体授权与流式输出** | P3、媒体单元（私有 bucket 和衍生规格就绪） | `/m/{alias}/{variant}`：签名 + 会话 + 授权校验、Storage 流式读取、Range、`inline` / `attachment` | IDOR、撤销、签名、Range 用例；原件无法访问（设计审查 + 测试） |
| **P5 Admin：链接管理** | ADR D3 Admin、P1 | 创建（选素材、权限、有效期）、一次性显示链接、列表、撤销、审计；`VIEW_ONLY` 免责说明 | owner 才能创建 / 撤销；明文只显示一次；审计完整 |
| **P6 访问统计** | P3、P4、P5 | 事件写入、机器人标记、Admin 统计视图、保留期清理任务 | 计数用例；30 天 IP HMAC 置空；12 个月清理 |
| **P7 基础设施（主线程执行）** | P3–P6 在 staging 验收 + §11 签批 | DNS 子域、NPM 主机（关闭 access log）、证书、Cloudflare bypass 规则、容器部署、密钥写入 NAS env | 写进 `docs/RELEASE-CHECKLIST.md`（U11）；两设备交叉验证不缓存 |
| **P8 安全复核** | P7 前 | 按 §7 威胁模型逐条复核（可用 `/security-review` 或人工）；检查日志里无 token | 复核记录入库 |
| **P9 文案与隐私说明** | U9-d 隐私政策 | 落地页、错误页、Admin 免责说明、隐私政策中预览访问记录一节 | 创始人审定；不出现「防下载 / 防截图」承诺 |

## 11. 待创始人签批的决策

| ID | 决策 | 状态 | 签批（日期 / 结果） |
| --- | --- | --- | --- |
| P-D1 | 预览服务用独立主机名（先 `preview.firstrec.work`），不用公共站同源路径 | Proposed — needs founder sign-off | |
| P-D2 | 运行时：独立 Node 小服务容器，专用最小权限数据库角色；Supabase Storage 不暴露公网 | Proposed — needs founder sign-off | |
| P-D3 | token 256 bit、`pv_` 前缀、只存 SHA-256、明文只显示一次 | Proposed — needs founder sign-off | |
| P-D4 | GET 落地页 + POST 开会话的两步打开方式 | Proposed — needs founder sign-off | |
| P-D5 | 会话最长 12 小时，且不超过链接有效期；过期后显示「请重新打开收到的链接」页（403），不跳回落地页（服务端不保留 token） | Proposed — needs founder sign-off | |
| P-D6 | 逐素材授权，链接素材清单为快照 | Proposed — needs founder sign-off | |
| P-D7 | 自签名、绑定会话的媒体 URL；图片 10 分钟、视频 60 分钟 | Proposed — needs founder sign-off | |
| P-D8 | 默认 `VIEW_ONLY`；`VIEW_ONLY` 默认只发 ≤1600 规格；不承诺防截图 / 防下载的声明 | Proposed — needs founder sign-off | |
| P-D9 | 默认 7 天；不支持原地延期（或有上限的延期） | Proposed — needs founder sign-off | |
| P-D10 | 统计与保留：IP 仅 HMAC 30 天、事件 12 个月、关闭预览主机 access log | Proposed — needs founder sign-off | |

## 12. 开放问题

1. **PQ-1** 预览主机名用哪个域？DNS 统一前先放在 `firstrec.work`（Cloudflare）可以吗？切域后旧子域如何 301？
2. **PQ-2** 有效期能否按链接调整？上限多少？是否允许延期？（ADR Q16）
3. **PQ-3** 是否需要按链接限制最大打开次数或最大会话数？
4. **PQ-4** 是否记录国家（`CF-IPCountry`）？这会多一项个人相关数据。
5. **PQ-5** token 哈希是否加 pepper（§3.2）？
6. **PQ-6** 是否需要可选的第二因子（例如链接 + 单独发送的短口令，或发到 `recipient_email` 的一次性验证码）？（ADR Q16）
7. **PQ-7** `VIEW_ONLY` 是否需要可见水印（如 “Preview — Client X — 2026-11”）？水印要服务端生成衍生图，影响媒体管线。
8. **PQ-8** 预览里是否需要展示视频？网页视频的衍生规格和码率由谁定？9 个现有网页视频（`HANDOFF.md` §6c）是否都能外发？
9. **PQ-9** 哪些素材允许外发（`external_share_allowed`）？默认值是 `false` 吗？谁来逐条设置？（与 ADR D7 授权依据相关）
10. **PQ-10** 客户反馈 / 批注功能是否在范围内？v0.2 摘要里没有提到，本文不包含。
11. **PQ-11** 30 个未授权案例的衍生图和视频目前只在 Mac 上（ADR Q12）；在上传到 private bucket 之前，预览只能用已有的素材。
12. **PQ-12** v0.2 原文入库后，核对本文依据的二手转述（ADR Q1）。
