# V2 询盘 / CRM 表单 API 设计（U9）

| 项 | 值 |
| --- | --- |
| 状态 | **Proposed（提议）**——整份文档未经创始人批准；只是设计，不是实现 |
| 日期 | 2026-10-31 |
| 范围 | `docs/HANDOFF-2026-10-17-CLAUDE.md` §7 U9 的设计部分。只写文档：不改 `app/contact/page.tsx`，不新增 `app/api/inquiries/route.ts`，不动线上静态站、NAS、Nginx Proxy Manager、Cloudflare、DNS |
| 前提 | `docs/V2-ARCHITECTURE-ADR.md`（ADR-0001，D2 / D5，同为 Proposed）；`docs/Website-V2-Development-Spec-v0.2.md` §6（重建摘要，**不是** v0.2 原文）；`docs/DECISIONS.md`（2026-10-31） |
| 并行依赖 | `docs/V2-DATA-CONTRACT.md`（U7）由另一个会话同时撰写，本文写作时还看不到。本文只用通用表名（「询盘表」「询盘事件表」等），并在 §6 列出需要的字段，供 U7 对齐 |

> **执行门槛**：本文所有标 **「Proposed — needs founder sign-off」** 的决策，在创始人于 §15 签批前，不得创建 API 服务、容器、数据库角色、反向代理路由、Cloudflare 规则、邮件发信账号、DNS 记录或任何第三方账号。

## 0. 已确认的事实（仅这些）

| 事实 | 来源 |
| --- | --- |
| 对外联系邮箱是 `info@firstrec.com.au` | `docs/DECISIONS.md` 2026-10-31 |
| 目标 canonical 域名是 `www.firstrec.com.au`；但 `.com.au`（DNS 在 GoDaddy）目前只是 frameset 嵌入 `www.firstrec.work`（DNS 在 Cloudflare）；两边 DNS 未统一，生产构建继续用 `.work` | `docs/DECISIONS.md`；handoff §2 |
| 公共站是 `output: "export"` 纯静态导出，NAS 上 `nginx:1.27-alpine` 只读挂载 `dist/client`（`compose.truenas.yaml`，`30040:80`，用默认 Nginx 配置），前面是 Nginx Proxy Manager（NPM）和 Cloudflare 代理 | `NAS-DEPLOY.md`；`compose.truenas.yaml`；handoff §2 |
| NPM、Cloudflare 后台的实际配置**未经登录核实** | handoff §2「未解决的验证限制」 |
| 当前 `app/contact/page.tsx` 只有一个 `mailto:` 链接和四条「Goal / Channels / Timing / Budget range」提示，没有表单 | `app/contact/page.tsx` |
| 仓库里没有隐私政策页 | 2026-10-31 检查 `app/` 目录 |
| v0.2 要求：Name / Email / Message 表单、持久化、状态 `NEW`、pipeline、人工录入、AI 摘要 / 回复草稿、首封回复必须人工发送 | 重建摘要 §6（二手转述） |

其它一切（发信服务、AI 服务商、营业额、法律适用范围、Supabase 是否部署）都**未知**，本文不当作事实。

## 1. 为什么不能放进静态导出

- `output: "export"` 的产物只是 HTML / JS / CSS 文件，Nginx 只会对 `POST` 返回 405。handoff U9 草案里的 `app/api/inquiries/route.ts` 在静态导出下**不会运行**，也不会被 Nginx 调用。
- 因此 U9 的 API 必须是**独立的小服务**，公共站只放一个普通 HTML 表单（ADR D2 / D5）。
- 本文明确**否决**在本仓库 `app/api/` 下实现询盘接口（否则会改变构建模式、破坏现有 NAS 部署）。API 代码放在独立目录或独立仓库（见开放问题 OQ-12）。

## 2. 运行位置与路由

### 2.1 运行时选项

| 方案 | 说明 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **A. 独立小型 Node 服务（容器）** | 一个只做 `POST /api/inquiries` + 健康检查的 HTTP 服务（例如 Node 22 + 轻量框架），独立 compose 项目跑在 TrueNAS 上；用专用的最小权限 Postgres 角色写库 | 暴露面最小（只有一个路径）；不需要把 Supabase Kong 暴露到公网；与 Supabase 解耦，Supabase 未就绪时也可先接 staging Postgres；日志、限速完全可控 | 多一个容器要维护和打补丁 |
| B. Supabase Edge Function（自托管 edge-runtime） | ADR D2 提到的选项；函数跑在 Supabase 自托管栈的 edge-runtime 里，经 Kong 路由 | 与 Supabase 同栈，少一个部署单元 | 需要把 Kong 的 `/functions/v1/*` 暴露到公网，面比方案 A 大；自托管 edge-runtime 的升级跟着整个 Supabase 栈走；限速 / 真实 IP 处理要在 Kong 或函数里另做 |
| C. Cloudflare Worker | 在 Cloudflare 边缘运行 | 不占 NAS 上行带宽 | 生产逻辑和数据转到 Cloudflare 账号，而账号归属未核实（handoff §2）；ADR D1 已不采用 Workers 作为生产运行时 |

**提议**：方案 A。**Proposed — needs founder sign-off**（对应 ADR 开放问题 Q4）。如果创始人选 B，§3–§12 的契约不变，只是部署位置变化。

### 2.2 路由：同源路径 vs 独立子域

ADR D2 原来设想「API 挂在独立子域」。但现在 DNS 没统一（`.com.au` 在 GoDaddy、`.work` 在 Cloudflare），新增子域需要改 DNS。

| 方案 | 做法 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **R1. 同源路径 `/api/inquiries`** | 在 NPM 里给现有公共站主机名加一条 custom location：`/api/` → API 容器（如 `http://<nas>:<api-port>`），其余路径照旧到 `:30040` 的静态 Nginx | **不需要新 DNS 记录**；无 CORS；表单 `action="/api/inquiries"` 用相对路径，以后切到 `.com.au` 不用改前端；`.com.au` frameset 里的页面本来就是 `www.firstrec.work` 同源 | 公共站主机名多承担一个动态路径；NPM 配置要改（未核实现状） |
| R2. 独立子域（如 `api.firstrec.work`） | 新 DNS 记录 + NPM 新主机 + 证书 | 与公共站完全隔离，符合 ADR D2 原文 | 要改 DNS；切 `.com.au` 时还得再建一个；要处理 CORS |

**提议**：R1（同源路径），并相应修改 ADR D2 中「独立子域」的表述。**Proposed — needs founder sign-off**。理由：不阻塞在 DNS 统一上，前端一行不用随切域改。

### 2.3 请求链路（R1）

```
浏览器
  │  POST https://www.firstrec.work/api/inquiries
  ▼
Cloudflare（代理；对 /api/* 不缓存；可选 WAF 限速规则）
  ▼
Nginx Proxy Manager（TrueNAS）
  ├─ location /api/  → inquiry-api 容器（只监听 NAS 内网 / Docker 网络）
  └─ location /      → cheese-portfolio 静态 Nginx（:30040，不变）
  ▼
inquiry-api ──(最小权限角色，仅 EXECUTE submit_inquiry())──▶ Postgres（Supabase 或 staging）
          └──(异步 outbox worker)──▶ SMTP / 发信服务 ──▶ info@firstrec.com.au
```

需要的配置（全部 **Proposed — needs founder sign-off**，由主线程执行，不交给 worker）：

1. **NPM**：现有主机名加 custom location `/api/`，转发到 API 容器；`client_max_body_size 32k`；转发 `CF-Connecting-IP`；该 location 关闭或精简 access log（见 §10）。
2. **Cloudflare**：Cache Rule「`/api/*` → Bypass cache」；可选 WAF Rate Limiting 规则（`POST /api/inquiries`，按 IP）作为第一道限速。
3. **真实 IP**：API 只在请求来源是 NPM（Docker 内网）时信任 `X-Forwarded-For` / `CF-Connecting-IP`；NPM 侧只在来源属于 Cloudflare IP 段时信任 `CF-Connecting-IP`。否则攻击者可伪造 IP 绕过限速。是否存在绕过 Cloudflare 直连源站的路径**未核实**（OQ-3）。
4. **API 容器端口不映射到公网**，只在 NAS 的 Docker 网络或内网可达。
5. 静态 Nginx 容器和 `compose.truenas.yaml` **不改**。

## 3. 请求 / 响应契约

### 3.1 端点

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `POST` | `/api/inquiries` | 提交询盘。接受 `application/json`（有 JS）和 `application/x-www-form-urlencoded`（无 JS） |
| `GET` | `/api/health` | 存活检查，只返回 `{"status":"ok"}`；**不**报告数据库或 SMTP 细节（内部监控另走内网 `/internal/ready`，不经 NPM 暴露） |

不提供任何读取询盘的公开端点。Admin 读取走 Admin 应用（ADR D3），不在本 API 里。

### 3.2 字段

必填三项来自 v0.2；可选项对应现有 Contact 页的四条提示（Goal / Channels / Timing / Budget range），不新编业务字段。

| 字段 | 必填 | 类型 / 约束（提议） | 说明 |
| --- | --- | --- | --- |
| `name` | 是 | string，trim 后 1–120 字符；不允许控制字符 | |
| `email` | 是 | string，trim + 小写域名部分，≤254 字符，基本语法校验（`local@domain.tld`，不做 MX 实时查询） | 不发确认邮件给对方（见 §8.3） |
| `message` | 是 | string，trim 后 10–5000 字符；保留换行；去掉 NUL 和其它控制字符 | 「10」是防误点下限，数值待批准 |
| `company` | 否 | string ≤200 | |
| `phone` | 否 | string ≤40，只允许 `+ - ( ) 空格 数字` | |
| `goal` | 否 | string ≤1000 | 对应「Goal」 |
| `channels` | 否 | string ≤500 | 对应「Channels」；先用自由文本，不做枚举（服务 / 渠道列表未定） |
| `timing` | 否 | string ≤200 | 对应「Timing」；自由文本，不解析成日期 |
| `budget_range` | 否 | enum，取值待创始人定（OQ-6）；在定下之前前端不显示此字段或显示自由文本 ≤100 | 对应「Budget range」 |
| `services` | 否 | string[]，每项 ≤60，最多 5 项；取值待五项服务定名后改为 enum | 重建摘要 §1.3：五项服务名称仓库里没有 |
| `consent` | 是（提议） | boolean，必须为 `true` | 勾选「我已阅读隐私说明」（APP 5 收集通知，见 §11）。前提是先有隐私说明页（OQ-9） |
| `source_page` | 否 | string ≤200，必须以 `/` 开头的站内路径 | 由前端自动填，例如 `/contact/` |
| `idempotency_key` | 否（JS 时有） | UUID v4 | 见 §5 |
| `website` | — | 蜜罐（honeypot），必须为空 | 见 §7 |
| `form_started_at` | 否 | 整数，毫秒时间戳 | 时间陷阱，见 §7；只作为信号，不单独拒绝 |
| `cf-turnstile-response` | 视方案 | string ≤2048 | 只在启用 Turnstile 时需要 |

规则：

- 未知字段一律 **拒绝**（422 `unknown_field`），防止有人往库里塞东西。
- 整个请求体 ≤32 KB（NPM + API 双重限制），超出返回 413。
- `Content-Type` 不是上面两种返回 415。
- 所有字符串做 Unicode NFC 规范化；存储原文，**展示时转义**（Admin 渲染不允许 HTML）。
- 不信任客户端传来的状态、时间、ID；`status` 永远由服务端写成 `NEW`。

### 3.3 响应

JSON 模式（`Accept: application/json` 或 JSON 请求）：

| HTTP | `code` | 何时 | 给用户的英文文案（站点可见文案为英文） |
| --- | --- | --- | --- |
| 201 | `received` | 新询盘写入成功 | “Thanks — your message is with First Rec. We’ll reply by email.” |
| 200 | `received` | 同一 `idempotency_key` 且内容相同的重放，或 §5.2 的内容去重命中；返回第一次的 `reference` | 同上（用户看不出区别） |
| 409 | `idempotency_conflict` | 同一 key、不同内容 | “This form was already sent with different details. Please refresh the page and try again.” |
| 422 | `validation_failed` | 字段不合格；`fields` 给出字段名 → 错误码（不回显值） | 按字段：“Please enter your name.” / “Please enter a valid email address.” / “Please add a short message (at least 10 characters).” |
| 400 | `bad_request` | JSON 解析失败等 | “Something went wrong sending the form. Please try again, or email info@firstrec.com.au.” |
| 403 | `challenge_failed` | Turnstile 校验失败、Origin 不在白名单 | “We couldn’t verify this submission. Please try again, or email info@firstrec.com.au.” |
| 413 / 415 | `payload_too_large` / `unsupported_media_type` | | 同 400 文案 |
| 429 | `rate_limited`，带 `Retry-After` | 超出限速 | “Too many messages from this connection. Please wait a few minutes, or email info@firstrec.com.au.” |
| 503 | `unavailable` | 数据库不可写、维护模式 | “Our form is temporarily unavailable. Please email info@firstrec.com.au — your message hasn’t been sent.” + mailto 兜底 |
| 500 | `internal_error` | 未预期错误 | 同 503 文案 |

所有响应都带 `request_id`（随机，不含个人信息），方便用户报错时引用，日志里也用它关联。

**蜜罐命中**：返回 201 / 303 成功（不让机器人知道被识别），但**不写库或写入 `SPAM` 状态**（见 §7）。

表单模式（无 JS，`application/x-www-form-urlencoded`）：

- 成功 → `303 See Other`，`Location: /contact/sent/`（新增一个静态页，随公共站构建，是纯文案）。
- 校验失败 / 限速 / 不可用 → `303`，`Location: /contact/error/?reason=<code>`；静态页根据 `reason` 显示对应文案，并始终显示 mailto 链接。**不把用户填写的内容放进 URL**（避免 PII 进日志和浏览器历史），因此无 JS 用户在校验失败时需要重新填写——这是有意的取舍，文案里要说明。
- `reason` 只接受固定枚举值，静态页里不回显任意字符串（防 XSS）。

`reference`：形如 `FR-2026-7K3QX`（年份 + 5 位 Crockford base32 随机数）。只用于沟通，**不是**数据库主键，不能用来查询任何内容。

## 4. 校验与持久化

处理顺序（提议）：

1. 方法、Content-Type、大小检查。
2. `Origin` 检查：必须属于白名单（`https://www.firstrec.work`；切域后加 `https://www.firstrec.com.au`；白名单由环境变量配置）。没有 `Origin` 时检查 `Referer` 的 origin；两者都没有时**允许但计入更严格的限速桶**（部分隐私插件会去掉这两个头）。**Proposed — needs founder sign-off**。
3. 限速（§7）。
4. 解析、规范化、字段校验。
5. 蜜罐 / 时间陷阱 / Turnstile（如启用）。
6. 调用数据库函数 `submit_inquiry(...)`（`SECURITY DEFINER`），在一个事务里：
   - 处理幂等键 / 内容去重（§5）；
   - 写入询盘表，`status = 'NEW'`；
   - 写入询盘事件表一条 `created` 事件（actor = `public_form`）；
   - 写入通知 outbox 一条待发记录；
   - 返回 `reference` 和「新建 / 重放」标记。
7. 返回响应。**邮件不在请求内同步发送**；由 outbox worker 异步发（§8）。这样发信服务故障不会导致用户看到失败，也不会产生重复询盘。

### 4.1 数据库权限（提议）

- API 使用专用角色（暂称 `inquiry_api`），**只有** `EXECUTE submit_inquiry()` 权限；对询盘表没有 `SELECT` / `UPDATE` / `DELETE`。即使 API 被攻破，也读不到已有询盘。
- 不使用 Supabase `service_role` key（权限过大）。
- 如果走 Supabase PostgREST 匿名插入，RLS 必须是「anon 只能 INSERT、不能 SELECT」（ADR D5 第 3 条）；但本文推荐方案 A 直接连库，不经 PostgREST，减少暴露面。
- Admin 的读取 / 状态变更权限由 U7 / ADR D3 的 `owner` / `editor` 角色和 RLS 决定。

**Proposed — needs founder sign-off**。

## 5. 幂等与重复提交控制

| 层 | 机制 | 覆盖场景 |
| --- | --- | --- |
| 前端 | 提交中禁用按钮；同一页面只生成一个 `idempotency_key`（`crypto.randomUUID()`），失败重试复用同一个 key；成功后再生成新 key | 双击、网络重试 |
| 服务端：幂等键 | 询盘表 `idempotency_key` 唯一约束。同 key + 同内容哈希 → 返回第一次的 `reference`（200）；同 key + 不同内容 → 409。key 保留 24 小时后可置空 | 客户端重试、浏览器重复提交 |
| 服务端：内容去重 | `content_hash = SHA-256(lower(email) ‖ NFC(message))`；同一 `content_hash` 在 **10 分钟**内再次出现 → 视为重复，返回第一次的 `reference`，不新建、不再通知 | 无 JS 表单重复提交（没有幂等键）、用户刷新后重发 |
| 服务端：同邮箱频率 | 同一邮箱（以 HMAC 后的值比较）1 小时内超过 3 条 → 429 | 刷单 |

时间窗、次数都是 **Proposed — needs founder sign-off**。`content_hash` 只用于去重，不用于其它用途；去重窗口过后可以置空。

## 6. 需要 U7 数据契约提供的表和字段

表名为通用描述，最终以 `docs/V2-DATA-CONTRACT.md` 为准。

**询盘表**（inquiries）

| 字段 | 类型（建议） | 说明 |
| --- | --- | --- |
| `id` | uuid PK | 内部 ID，不对外 |
| `reference` | text unique | 对外编号 |
| `status` | enum | 至少包含 `NEW`；pipeline 建议见 §9.1 |
| `source` | enum：`public_form` / `manual` / `email_import` | v0.2「人工录入」 |
| `name`, `email`, `message` | text | 必填 |
| `company`, `phone`, `goal`, `channels`, `timing`, `budget_range`, `services` | text / text[] | 可选 |
| `source_page` | text | |
| `consent_given_at`, `consent_notice_version` | timestamptz, text | 同意时看到的是哪一版隐私说明 |
| `idempotency_key` | uuid unique nullable | |
| `content_hash` | bytea nullable | |
| `client_ip_hmac` | bytea nullable | 见 §10；有保留期 |
| `spam_signals` | jsonb | 例如 `{"honeypot":false,"fast_submit":true,"turnstile":"pass"}`；不存原始 IP / UA |
| `assigned_to` | uuid nullable → 用户表 | |
| `created_at`, `updated_at` | timestamptz | |
| `retain_until` | timestamptz | 按 §11 保留策略计算 |
| `anonymised_at`, `deleted_at` | timestamptz nullable | |

**询盘事件表**（inquiry events / audit）：`id`、`inquiry_id`、`type`（`created` / `status_changed` / `note_added` / `draft_generated` / `draft_edited` / `reply_sent` / `anonymised` …）、`from_status`、`to_status`、`actor_type`（`public_form` / `user` / `ai` / `system`）、`actor_id`、`payload`（jsonb，不复制正文）、`created_at`。可以并入 ADR D3 的统一审计表，由 U7 决定。

**回复草稿表**（inquiry reply drafts）：`id`、`inquiry_id`、`body`、`origin`（`ai` / `human`）、`ai_provider`、`ai_model`、`prompt_version`、`created_at`、`edited_by`、`edited_at`、`approved_by`、`sent_at`、`sent_by`、`sent_message_id`。约束：`sent_by` 必须是人类用户，不能为空、不能是系统账号。

**通知 outbox 表**（notification outbox）：`id`、`kind`（`inquiry_created`）、`inquiry_id`、`status`（`pending` / `sent` / `failed`）、`attempts`、`next_attempt_at`、`last_error_code`（不含 PII）、`created_at`、`sent_at`。

**限速**：建议放在 API 进程内存（单实例足够）或一张 `rate_limit_buckets`（`bucket_key_hmac`、`window_start`、`count`）；不进 U7 主契约也可以。

**数据库函数**：`submit_inquiry(...)` → `(reference, replayed boolean)`，`SECURITY DEFINER`，`search_path` 固定。

## 7. 反滥用

### 7.1 方案对比

| 手段 | 效果 | 隐私影响 | 无 JS 可用 | 成本 / 依赖 |
| --- | --- | --- | --- | --- |
| **蜜罐字段**（隐藏的 `website` 输入框，`tabindex=-1`、`autocomplete=off`，对读屏隐藏并带说明） | 挡住大量通用表单机器人；挡不住针对性脚本 | 无 | 是 | 几乎为零 |
| **时间陷阱**（`form_started_at`，<3 秒提交视为可疑） | 补充信号；可伪造 | 无 | 否（无 JS 时没有该字段，不惩罚） | 零 |
| **限速**（API 内 + 可选 Cloudflare WAF 规则） | 限制量级和成本；挡不住分布式 | 需要 IP（只存 HMAC，短期） | 是 | 低 |
| **Origin 白名单** | 挡住跨站直接 POST、部分脚本 | 无 | 是 | 零 |
| **内容规则**（链接数 >3、全是 URL、已知垃圾词） | 标记为可疑而不是拒绝 | 无 | 是 | 低；需维护 |
| **Cloudflare Turnstile** | 对自动化效果好，通常无需用户操作 | 浏览器要加载 Cloudflare 脚本，Cloudflare 会处理访客信号——要写进隐私说明；可能属于跨境披露（APP 8） | **否**——无 JS 时无法通过，只能走 mailto 兜底 | 需要 Cloudflare 账号里建 widget（账号归属未核实）；需要 secret key 存在 API 服务端；CSP 要放行 `challenges.cloudflare.com` |

### 7.2 提议

**Proposed — needs founder sign-off**（对应 ADR Q6）：

1. 第一阶段：蜜罐 + 时间陷阱（仅信号）+ Origin 白名单 + 限速 + 内容规则。**不启用 Turnstile**，保持无 JS 可用、不引第三方脚本。
2. Turnstile 做成开关（环境变量 `TURNSTILE_ENABLED`，site key 是公开值，可以作为 `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 构建进静态站；secret key 只在 API 服务端）。上线后若一周内垃圾询盘超过约定阈值（例如 >5 条 / 周，待定）再开启。
3. 可疑但不确定的提交写入 `SPAM` 以外的正常状态 `NEW`，`spam_signals` 标记，Admin 列表里排后；**蜜罐命中**直接丢弃（只记一条计数指标，不存内容）。理由：误杀真实客户比收到垃圾更贵。

### 7.3 限速数值（提议，待批准）

| 桶 | 限额 |
| --- | --- |
| 每 IP | 5 次 / 10 分钟；20 次 / 天 |
| 无 Origin / Referer 的请求，每 IP | 2 次 / 10 分钟 |
| 每邮箱 | 3 次 / 小时 |
| 全局熔断 | 200 次 / 天；超出后 API 返回 503，前端自动显示 mailto，并给创始人发一封告警 |

## 8. 通知邮件

### 8.1 机制

- outbox worker（同一个 API 容器里的后台循环，或独立进程）轮询 `pending` 记录，发信成功标 `sent`，失败指数退避重试（1 分钟、5 分钟、30 分钟、2 小时、12 小时），5 次后标 `failed`，并在健康监控里报警。
- 收件人：`info@firstrec.com.au`（`DECISIONS.md`）。收件人做成环境变量，不硬编码。
- 发信服务和发件地址**未定**（ADR Q7，本文 OQ-4）。选型前提：
  - 若用 `@firstrec.com.au` 作发件域，需要在该域 DNS（目前在 GoDaddy）加 SPF / DKIM / DMARC 记录——这是 DNS 变更，要创始人批准，且与「DNS 未统一」的决定有关。
  - 也可以先用发信服务自带的已验证域名发到 `info@`，避免改 DNS；代价是更容易进垃圾箱。
- SMTP 凭证只在 NAS 的 env 文件 / 密码管理器里（ADR D1「部署形态」）。

### 8.2 邮件内容（提议）

两种选择，**Proposed — needs founder sign-off**：

| 选项 | 内容 | 取舍 |
| --- | --- | --- |
| **N1. 只发提醒** | 主题 `New inquiry FR-2026-7K3QX`；正文只有编号、时间、Admin 链接；不含姓名、邮箱、留言 | PII 不进邮箱；但 Admin 上线前没地方看内容 |
| N2. 发完整内容 | 主题含编号；正文含全部字段（纯文本，转义）；`Reply-To` 设为询盘人邮箱 | Admin 上线前就能用；PII 会长期留在邮箱里（要计入 §11 保留策略） |

建议：**Admin 上线前用 N2，Admin 上线后切到 N1**。

无论哪种：

- 邮件头里的任何用户输入（姓名进主题、`Reply-To`）都要去掉 CR/LF，防邮件头注入；`Reply-To` 只在邮箱通过校验后设置。
- 只发纯文本，不渲染用户 HTML。
- 回信由人工从自己的邮箱发出（§9）。

### 8.3 不给询盘人发自动确认邮件（提议）

自动回执会让表单变成「向任意地址发信」的工具（攻击者填别人的邮箱）。网页上的成功提示已足够。**Proposed — needs founder sign-off**。如果创始人要回执，必须在开启 Turnstile 之后，并且回执不回显留言内容。

## 9. AI 起草首封回复、人工发送

v0.2 要求：AI 可以做摘要和回复草稿，**首封回复必须人工发送**（重建摘要 §6.4）。

### 9.1 Pipeline 状态（提议，待与 U7 对齐）

`NEW` → `IN_REVIEW` → `REPLIED` → `QUALIFIED` → `WON` / `LOST`；旁路：`SPAM`、`ARCHIVED`。只有 `NEW` 是 v0.2 明确要求的，其余名称都是 **Proposed — needs founder sign-off**。

### 9.2 流程

1. 询盘写入，状态 `NEW`。
2. （可选，需 OQ-5 批准）Admin 里由人点击「Generate draft」，或询盘创建后后台任务自动生成：调用 AI 生成**摘要 + 回复草稿**，写入回复草稿表，`origin = 'ai'`，记录服务商、模型、prompt 版本。
3. 人在 Admin 里阅读、编辑草稿。编辑记事件。
4. 发送：
   - 第一阶段（推荐）：Admin 只提供「Copy」和「Open in mail client（mailto 预填）」，由人从 `info@firstrec.com.au` 邮箱亲手发出，然后人工点「Mark as replied」→ `REPLIED`。系统本身**没有**发信给询盘人的能力。
   - 第二阶段（可选）：Admin 里「Send」按钮通过 SMTP 发出。要求：已登录的 `owner` 会话 + MFA（ADR D3）+ 二次确认弹窗；后端检查请求来自人类会话，而不是 AI 任务或系统账号；`sent_by` 记录操作人。
5. 所有步骤写事件表。

### 9.3 硬性约束

- AI 任务使用的凭据**不能**访问发信能力（没有 SMTP 凭证、不能调用发送端点）。
- AI 输出只写草稿表，不能改状态、不能改联系人信息、不能覆盖人工编辑过的草稿（v0.2 8.1「AI 不得静默覆盖人工选择」）。
- 询盘正文是**不可信输入**：可能含有提示注入（prompt injection）。AI 调用不给任何工具 / 函数调用能力，输出只当作文本显示；Admin 里显示「AI draft — review before sending」标记。
- 草稿里不能编造事实（报价、档期、过往客户），prompt 里要明确只基于询盘内容和创始人提供的固定模板回答；有疑问写成待确认的占位。
- 把询盘内容发给第三方 AI 服务属于对外披露个人信息，可能跨境（APP 6 / APP 8）。**未经创始人批准（OQ-5）不得启用**；启用后隐私说明要写明。

## 10. 日志与 PII

原则：日志里**不出现**姓名、邮箱、电话、留言、公司、原始 IP、完整 User-Agent。

| 日志 | 允许记录 | 禁止 |
| --- | --- | --- |
| API 应用日志 | `request_id`、时间、路径、HTTP 状态、耗时、`code`、校验失败的**字段名和错误码**、`reference`、是否重放、限速桶名、`client_ip_hmac` 的前 8 个十六进制字符 | 请求体、任何字段值、查询串、`Authorization` / Cookie 头、Turnstile token |
| 数据库错误 | 错误类型 / SQLSTATE | 带参数值的 SQL |
| outbox worker | outbox ID、`reference`、尝试次数、SMTP 返回码类别 | 收件人以外的地址、正文 |
| NPM access log（`/api/` location） | 默认会记录 IP 和路径；路径里没有 PII（POST 体不记录）。建议关闭该 location 的 access log 或设置短轮转 | 不要开启 request body 日志 |
| 错误追踪（如果以后接 Sentry 一类服务） | 必须配置 scrub，默认不开 | |

- IP：`client_ip_hmac = HMAC-SHA256(daily_salt, ip)`，salt 每天轮换、只在内存 / env 里，旧 salt 丢弃。只用于限速和滥用排查；询盘表里的这个字段 30 天后清空（**Proposed**）。
- 测试里要有一条断言：用固定测试邮箱 / 留言跑完整流程后，grep 所有日志输出，找不到这些值（§13）。
- 这些规则同样适用于 staging。

## 11. 数据保留与澳大利亚隐私法

> 以下不是法律意见。First Rec. 的营业额、是否属于 *Privacy Act 1988 (Cth)* 的 APP entity（小企业豁免一般以年营业额 300 万澳元为界，并有例外）**未知**，需要创始人或其顾问确认（OQ-8）。无论是否适用，本文都建议**按 Australian Privacy Principles（APPs）的要求设计**，因为改起来比一开始就做难，且 2024 年的修法和后续改革讨论都在收紧。

| APP | 对本设计的要求（提议） |
| --- | --- |
| APP 1 公开透明 | 需要一份隐私政策页（仓库里目前**没有**，OQ-9）：收集什么、为什么、存在哪、给谁（发信服务、可选 Turnstile、可选 AI 服务）、保留多久、怎么查询 / 更正 / 删除、联系方式 `info@firstrec.com.au` |
| APP 3 收集 | 只收必要字段；可选字段明确标「optional」 |
| APP 5 收集通知 | 表单旁边一段短说明 + 隐私政策链接；`consent` 勾选框记录版本号 |
| APP 6 使用与披露 | 只用于回复询盘和相关业务沟通；不加入营销名单（营销邮件另受 *Spam Act 2003* 约束，需要单独同意） |
| APP 8 跨境披露 | 发信服务、Turnstile、AI 服务若在海外处理数据，要在隐私政策里说明，并评估服务商条款 |
| APP 11 安全与销毁 | 加密传输（HTTPS）；数据库只在内网；备份加密（ADR D6）；到期删除或匿名化 |
| APP 12 / 13 访问与更正 | Admin 里能按邮箱查到某人的全部询盘并导出 / 更正 / 删除；收到请求的处理流程写进运维文档 |
| Notifiable Data Breaches | 若适用，发生可能造成严重伤害的数据泄露时须评估并通知 OAIC 和当事人；需要一份简短的泄露响应预案（谁负责、怎么判断） |

**保留期（全部 Proposed — needs founder sign-off）**：

| 数据 | 保留 | 到期动作 |
| --- | --- | --- |
| 未成交询盘（`LOST` / `ARCHIVED` / 长期无回应的 `NEW`） | 最后一次活动后 24 个月 | 删除个人字段（匿名化），只留状态、日期、来源用于统计 |
| `SPAM` | 30 天 | 删除 |
| 成交客户（`WON`） | 转为客户记录，按业务 / 税务记录义务保存（具体年限由会计确认，本文不假设） | — |
| `client_ip_hmac` | 30 天 | 置空 |
| `idempotency_key` / `content_hash` | 24 小时 / 10 分钟后可置空 | 置空 |
| API 应用日志、NPM 日志 | 30 天 | 轮转删除 |
| 通知邮件（N2 模式下在 `info@` 邮箱里） | 与询盘相同；需要人工或邮箱规则清理 | 写进运维清单 |
| 备份 | 按 ADR D6（30 天日备 / 12 个月月备）；删除请求在备份里自然过期，恢复时要重放删除 | 写进恢复流程 |

到期清理由每日定时任务执行（数据库函数 + 调度），每次运行写审计事件。

## 12. 渐进增强：API 挂了也能联系

现状（`app/contact/page.tsx`）是纯 mailto。V2 表单上线后必须保证：**任何情况下用户都能看到 `info@firstrec.com.au`**。

1. **mailto 链接永远存在**：表单下方固定一行「Prefer email? info@firstrec.com.au」，不依赖 JS、不依赖 API。
2. **无 JS**：`<form method="post" action="/api/inquiries">` 普通提交 → 303 到静态 `/contact/sent/` 或 `/contact/error/?reason=…`（§3.3）。
3. **有 JS**：拦截提交，`fetch` JSON；超时 10 秒。网络错误、超时、5xx、`503 unavailable`、`429` 时：在表单内显示错误文案，并生成一个**预填的 mailto 链接**（`subject=Inquiry from <name>`，`body` 为用户填的内容，URL 编码；超过约 1800 字符时截断并提示「message shortened — please paste the rest」），用户点一下就能用自己的邮件客户端发出，填写内容不丢。
4. **构建期开关**：`NEXT_PUBLIC_INQUIRY_FORM_ENABLED`（公开值，不是秘密）。为 `false` 或未设时，Contact 页保持现在的纯 mailto 形态。**只有在 API 和 NPM 路由在生产验证通过之后**才用 `true` 构建上线——否则无 JS 用户提交会撞上 Nginx 的 405 页面。
5. **维护模式**：API 环境变量 `INQUIRY_MAINTENANCE=1` 时直接返回 503，前端走 mailto 兜底，不用重新构建公共站。
6. 公共站本身不依赖 API 才能渲染；API 宕机不影响任何其它页面（ADR D2 第 5 条）。
7. `.com.au` frameset 期间：表单页在 `www.firstrec.work` 的 frame 里，提交同源，正常；`/contact/sent/` 也在 frame 里显示。mailto 链接在 frame 里点击可能被浏览器限制，需在 QA 中实测（OQ-10）。

## 13. 测试计划（只用隔离的临时后端）

**绝不**连接生产数据库、生产 NPM、生产邮箱或真实 Turnstile widget。

### 13.1 环境

- 临时 Postgres：`docker compose -p inquiry-test`（或 testcontainers）每次测试启动、结束销毁；schema 用 U7 的 migration 文件建出，加上 `submit_inquiry()`。若 U7 选 Supabase，可用 Supabase CLI 的本地栈，同样用后即删。
- 假 SMTP：Mailpit / smtp4dev 一类的本地收信容器，断言邮件内容；不向外网发信。
- Turnstile：使用 Cloudflare 官方提供的**测试 site key / secret key**（总是通过 / 总是失败的那组）或直接 mock 校验函数。
- 公共站：用 `npm run build` 的静态产物 + 一个本地反向代理（模拟 NPM 的 `/api/` 分流），Playwright 跑浏览器测试。

### 13.2 用例

| # | 用例 | 预期 |
| --- | --- | --- |
| T1 | 合法 JSON 提交 | 201；库里一条 `NEW`；事件表 `created`；outbox 一条；假 SMTP 收到一封给 `info@` 的邮件 |
| T2 | 合法表单（urlencoded）提交 | 303 → `/contact/sent/` |
| T3 | 每个必填字段缺失 / 超长 / 邮箱格式错 | 422，`fields` 正确；表单模式 303 → error 页；库里无记录 |
| T4 | 未知字段、超大 body、错误 Content-Type | 422 / 413 / 415 |
| T5 | 同一 `idempotency_key` 重放 3 次 | 只有一条记录；后两次 200 且 `reference` 相同；只有一封通知 |
| T6 | 同 key 不同内容 | 409 |
| T7 | 无 key、同邮箱 + 同留言 10 分钟内两次 | 一条记录 |
| T8 | 蜜罐有值 | 对外 201 / 303；库里无内容 |
| T9 | 超过各限速桶 | 429 + `Retry-After`；伪造 `X-Forwarded-For`（非可信代理来源）不能绕过 |
| T10 | Origin 不在白名单 | 403 |
| T11 | 停掉 Postgres | 503 `unavailable`；无 PII 日志 |
| T12 | 停掉假 SMTP | 提交仍 201；outbox 重试；恢复后补发一次，不重复 |
| T13 | `inquiry_api` 角色直接 `SELECT` / `UPDATE` 询盘表 | 权限拒绝 |
| T14 | 若用 PostgREST：anon key `SELECT` 询盘 | RLS 拒绝 |
| T15 | 日志 PII 扫描：跑完 T1–T12 后 grep 所有容器日志中的测试邮箱、姓名、留言片段、原始 IP | 零命中 |
| T16 | 邮件头注入：姓名含 `\r\nBcc:` | 头部被清洗，无额外收件人 |
| T17 | 浏览器（Playwright）：JS 开、API 正常 | 表单内成功提示 |
| T18 | 浏览器：JS 开、API 停掉 / 超时 | 错误文案 + 预填 mailto 链接；页面上的 `info@firstrec.com.au` 始终可见 |
| T19 | 浏览器：JS 关 | 普通提交走 303；mailto 可见 |
| T20 | 构建：`NEXT_PUBLIC_INQUIRY_FORM_ENABLED` 未设 | Contact 页与现状一致（只有 mailto） |
| T21 | 公共站构建产物检查 | `dist/client` 里没有 API 代码、没有任何密钥或 Turnstile secret、没有 `service_role` |
| T22 | 保留期任务（时间快进） | 到期询盘被匿名化，`SPAM` 被删除，事件表有记录 |
| T23 | 隐私访问请求：按邮箱导出 / 删除 | 导出完整；删除后查不到个人字段 |

测试结束销毁所有容器和数据卷。测试报告里只写真实跑过的结果；没跑的不能写成通过。

## 14. 后续实现单元（建议拆分）

| 单元 | 依赖 | 范围 | 验收 |
| --- | --- | --- | --- |
| U9-a 数据库对象 | U7 | 询盘 / 事件 / 草稿 / outbox 表的 migration、`submit_inquiry()`、`inquiry_api` 角色、RLS | T5–T7、T13、T14、T22 在临时库通过 |
| U9-b API 服务 | U9-a、OQ-1 / OQ-12 | 独立目录或仓库中的服务、Dockerfile、校验、限速、日志规则、outbox worker | T1–T12、T15、T16 |
| U9-c 公共站表单 | U9-b | `app/contact/page.tsx` 表单 + 极少量 JS、`/contact/sent/`、`/contact/error/` 静态页、构建开关 | T17–T21；开关关闭时与现站一致 |
| U9-d 隐私说明页 | OQ-8 / OQ-9 | 隐私政策页文案（需创始人或顾问审定，不由 worker 编写法律承诺） | 创始人签字 |
| U9-e 基础设施 | 上述全部 + 签批 | NPM `/api/` location、Cloudflare cache / 限速规则、API 容器上线、发信服务配置 | 主线程执行；staging 先验证；写进 `docs/RELEASE-CHECKLIST.md`（U11） |
| U9-f Admin CRM | ADR D3 | 询盘列表、详情、状态变更、草稿、人工发送、导出 / 删除 | 另立设计 |

## 15. 待创始人签批的决策

| ID | 决策 | 状态 | 签批（日期 / 结果） |
| --- | --- | --- | --- |
| I1 | API 用独立 Node 小服务（方案 A），不用 Edge Function / Worker | Proposed — needs founder sign-off | |
| I2 | 同源路径 `/api/inquiries`（NPM custom location），不新建 API 子域；相应修改 ADR D2 表述 | Proposed — needs founder sign-off | |
| I3 | 字段集与长度限制（§3.2），`consent` 必填 | Proposed — needs founder sign-off | |
| I4 | 无 Origin / Referer 时允许但更严格限速 | Proposed — needs founder sign-off | |
| I5 | API 用只有 `EXECUTE submit_inquiry()` 的专用角色，不用 `service_role` | Proposed — needs founder sign-off | |
| I6 | 去重窗口与次数（§5） | Proposed — needs founder sign-off | |
| I7 | 第一阶段不启用 Turnstile，做成开关；限速数值（§7.3） | Proposed — needs founder sign-off | |
| I8 | 通知邮件 N2 → Admin 上线后 N1；不给询盘人发自动回执 | Proposed — needs founder sign-off | |
| I9 | Pipeline 状态名（§9.1）；第一阶段系统不具备发信给询盘人的能力 | Proposed — needs founder sign-off | |
| I10 | 保留期表（§11） | Proposed — needs founder sign-off | |
| I11 | 构建开关 `NEXT_PUBLIC_INQUIRY_FORM_ENABLED`，API 生产验证前不打开 | Proposed — needs founder sign-off | |

## 16. 开放问题

1. **OQ-1** 确认 API 运行时（I1；ADR Q4）。谁负责这个容器的补丁和监控？
2. **OQ-2** NPM 当前对 `www.firstrec.work` 的实际配置是什么？能否加 custom location？（未登录核实）
3. **OQ-3** 源站是否只能经 Cloudflare 访问？NAS 的 30040 端口或 NPM 是否有不经 Cloudflare 的公网入口？这决定真实 IP 和限速能否被绕过。
4. **OQ-4** 发信服务选哪家？发件地址用 `@firstrec.com.au`（需改 GoDaddy DNS 加 SPF / DKIM / DMARC）还是服务商域名？（ADR Q7）
5. **OQ-5** 是否启用 AI 草稿？用哪家服务？是否允许把询盘内容发给海外服务商？（ADR Q10）
6. **OQ-6** `budget_range` 的选项；五项服务的正式名称（`services` 字段）。
7. **OQ-7** 是否要 Turnstile？Cloudflare 账号归属谁？（ADR Q6）
8. **OQ-8** First Rec. 是否属于 *Privacy Act 1988* 的 APP entity？是否需要律师意见？
9. **OQ-9** 隐私政策页由谁写、谁审？上线表单前必须有。
10. **OQ-10** `.com.au` frameset 期间 mailto 和表单在 frame 里的实际表现（需 QA 实测）；切域时间点会影响 Origin 白名单。
11. **OQ-11** 询盘数据的备份放哪里（ADR Q11），备份里的个人信息如何处理删除请求？
12. **OQ-12** API 代码放在这个 public 仓库的独立目录，还是单独私有仓库？（ADR Q13）
13. **OQ-13** 是否需要「人工录入」以外的导入渠道（例如把 `info@` 收到的邮件导入 CRM）？v0.2 只提到人工录入。
14. **OQ-14** v0.2 原文入库后，核对本文所有「二手转述」的要求（ADR Q1）。

## 附录 A：OpenAPI 3.1

```yaml
openapi: 3.1.0
info:
  title: First Rec. Inquiry API
  version: 0.1.0-proposed
  summary: Public inquiry submission endpoint (design proposal, not implemented).
  description: >
    Status: Proposed — needs founder sign-off. Served same-origin under /api/
    via the reverse proxy; the public site remains a static export.
    No endpoint returns stored inquiries.
servers:
  - url: https://www.firstrec.work
    description: Current public origin (until firstrec.com.au serves the site directly)
  - url: https://www.firstrec.com.au
    description: Target canonical origin (after DNS cut-over)
paths:
  /api/inquiries:
    post:
      operationId: submitInquiry
      summary: Submit a new inquiry (stored with status NEW)
      parameters:
        - in: header
          name: Idempotency-Key
          required: false
          description: Optional alternative to the idempotency_key body field. If both are present they must match.
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/InquiryRequest' }
          application/x-www-form-urlencoded:
            schema: { $ref: '#/components/schemas/InquiryRequest' }
            encoding:
              services: { style: form, explode: true }
      responses:
        '201':
          description: Inquiry stored.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Received' }
        '200':
          description: Duplicate or idempotent replay; returns the original reference.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Received' }
        '303':
          description: Form (non-JS) submission result. Redirects to /contact/sent/ or /contact/error/?reason=<code>.
          headers:
            Location:
              schema: { type: string }
        '400': { $ref: '#/components/responses/Error' }
        '403': { $ref: '#/components/responses/Error' }
        '409': { $ref: '#/components/responses/Error' }
        '413': { $ref: '#/components/responses/Error' }
        '415': { $ref: '#/components/responses/Error' }
        '422':
          description: Validation failed.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ValidationError' }
        '429':
          description: Rate limited.
          headers:
            Retry-After:
              schema: { type: integer, minimum: 1 }
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Error' }
        '500': { $ref: '#/components/responses/Error' }
        '503':
          description: Temporarily unavailable; client must show the mailto fallback.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Error' }
  /api/health:
    get:
      operationId: health
      summary: Liveness only; reveals no dependency details.
      responses:
        '200':
          description: Process is up.
          content:
            application/json:
              schema:
                type: object
                required: [status]
                properties:
                  status: { const: ok }
components:
  schemas:
    InquiryRequest:
      type: object
      additionalProperties: false
      required: [name, email, message, consent]
      properties:
        name: { type: string, minLength: 1, maxLength: 120 }
        email: { type: string, format: email, maxLength: 254 }
        message: { type: string, minLength: 10, maxLength: 5000 }
        company: { type: string, maxLength: 200 }
        phone: { type: string, maxLength: 40, pattern: '^[0-9+()\- ]*$' }
        goal: { type: string, maxLength: 1000 }
        channels: { type: string, maxLength: 500 }
        timing: { type: string, maxLength: 200 }
        budget_range:
          type: string
          maxLength: 100
          description: Free text until the founder defines an enum (open question OQ-6).
        services:
          type: array
          maxItems: 5
          items: { type: string, maxLength: 60 }
          description: Becomes an enum once the five service names are confirmed.
        consent:
          type: boolean
          const: true
          description: Visitor confirms they have read the privacy notice.
        source_page: { type: string, maxLength: 200, pattern: '^/' }
        idempotency_key: { type: string, format: uuid }
        website:
          type: string
          maxLength: 0
          description: Honeypot. Must be empty; non-empty submissions are silently discarded.
        form_started_at:
          type: integer
          description: Client epoch milliseconds when the form was rendered (spam signal only).
        cf-turnstile-response:
          type: string
          maxLength: 2048
          description: Required only when Turnstile is enabled.
    Received:
      type: object
      required: [code, reference, request_id]
      properties:
        code: { const: received }
        reference:
          type: string
          pattern: '^FR-[0-9]{4}-[0-9A-HJKMNP-TV-Z]{5}$'
        request_id: { type: string }
    Error:
      type: object
      required: [code, message, request_id]
      properties:
        code:
          type: string
          enum: [bad_request, validation_failed, challenge_failed, idempotency_conflict, payload_too_large,
                 unsupported_media_type, rate_limited, unavailable, internal_error]
        message:
          type: string
          description: User-facing English text; always includes the fallback email where relevant.
        fallback_email:
          type: string
          format: email
          examples: [info@firstrec.com.au]
        request_id: { type: string }
    ValidationError:
      allOf:
        - $ref: '#/components/schemas/Error'
        - type: object
          required: [fields]
          properties:
            code: { const: validation_failed }
            fields:
              type: object
              description: Field name → error code. Submitted values are never echoed.
              additionalProperties:
                type: string
                enum: [required, too_short, too_long, invalid_format, invalid_value, unknown_field]
  responses:
    Error:
      description: Error.
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }
```

注：422 用 `ValidationError`（在 `Error` 基础上增加 `fields`）。草案中 `budget_range` / `services` 仍是自由文本，待 OQ-6 定稿后改为 enum。
