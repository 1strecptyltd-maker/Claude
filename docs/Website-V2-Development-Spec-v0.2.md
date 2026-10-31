# First Rec. Website V2 Development Spec v0.2（仓库内重建摘要）

> ⚠️ **Reconstructed from in-repo references; original v0.2 text still on the founder's Mac — replace verbatim when available.**
>
> 本文**不是** v0.2 原文。原文件 `First-Rec-Website-V2-Development-Spec-v0.2.md` 在创始人 Mac 的 Codex 工作目录里（完整路径见 `docs/HANDOFF-2026-10-17-CLAUDE.md` §6「规范来源与优先级」），从未入库。本文只汇总本仓库里**已经引用过**的 v0.2 要求，每条都标出处；仓库里没写到的内容一律不补、不猜。
>
> 拿到原文后：用原文**整体替换**本文件（逐字保留），在文件头记录来源与入库日期；下面的「出处」表可以移到附录，用来核对原文和此前交接文档的引用有没有出入。

整理日期：2026-10-30
整理依据（仅以下仓库文件）：

| 简称 | 文件 |
| --- | --- |
| **H** | `HANDOFF.md`（2026-10-20） |
| **A** | `docs/HANDOFF-2026-10-17-CLAUDE.md`（2026-10-17 审计） |
| **B** | `docs/WEBSITE-REFACTOR-DISCUSSION-BRIEF-2026-08-30.md`（v0.2 之前的讨论简报，**不是** v0.2 本身） |

## 0. 读法与可信度

- 下面的每一条都是**二手引用**：交接文档作者读过 v0.2 后的转述。措辞、数量和范围都可能和原文有出入。
- 「出处」列写的是转述所在位置，不是 v0.2 的章节号。v0.2 原文的章节结构未知。
- B（2026-08-30 简报）早于 v0.2，里面 A–D 方向只是讨论选项。只有在 A 明确说 v0.2 采纳了某项时，才把它列成 v0.2 要求；其余 B 的内容放在 §9「背景」，不算规范。
- A §6 明确说：先前聊天里的 Sanity / Payload 方向**不是**当前实施架构；规范里写的是目标，不能证明任何基础设施已经存在。

## 1. 定位与品牌

| # | 要求（转述） | 出处 |
| --- | --- | --- |
| 1.1 | 定位：**Boutique Commercial Film & Content Production Studio** | A §6「规范来源与优先级」 |
| 1.2 | commercial production / film 优先；餐饮内容是辅助定位 | A §8 第 2 条 |
| 1.3 | **五项服务**（具体名称仓库里没有记录；现站 `app/_data/site.ts` 只有 3 项服务，不能拿来代替） | A §6 |
| 1.4 | Equipment 进**主导航**，作为能力定位 | A §6；A §7 U4；A §8 第 2 条 |
| 1.5 | 改定位要明确记录，不必再从空白重新讨论 | A §8 第 2 条 |

## 2. 首页与 Work

| # | 要求（转述） | 出处 |
| --- | --- | --- |
| 2.1 | 首页 **6–8 个精选**案例；创始人指定名单和顺序；批准的内容不够时如实少于 6 个，不凑数 | A §6；A §7 U4；H §4 |
| 2.2 | cinematic showreel Hero | A §6 表「Phase 4 前台」 |
| 2.3 | featured case | A §6 表「Phase 4 前台」 |
| 2.4 | selected clients（没有证据的客户 logo / 评价 / 价格不填充） | A §6 表「Phase 4 前台」；A §8 第 8 条 |
| 2.5 | 多维分类（taxonomy） | A §6 表「Phase 4 前台」；A §4 |
| 2.6 | 餐饮集合策略（合并方式待创始人决定） | A §6 表「V1 精简」；A §7 U4 |

## 3. 案例页：模块化 blocks

| # | 要求（转述） | 出处 |
| --- | --- | --- |
| 3.1 | 模块化案例 block：Hero / Intro / Facts / Gallery / Video / Full-width / Two-column / Deliverables / Credits / BTS / Next | A §7 U8 |
| 3.2 | 未知事实不显示 | A §7 U8 |
| 3.3 | 旧案例兼容；图片原比例；reduced-motion 与手机布局 | A §7 U8；A §9 |

## 4. 视觉

| # | 要求（转述） | 出处 |
| --- | --- | --- |
| 4.1 | 暖中性底色、bold condensed 标题、cinematic full-width Hero、少量暗色、无鲜艳点缀 | A §9 |
| 4.2 | 反对：玻璃效果、装饰渐变、重阴影、随机 masonry、过度动画 | A §9 |
| 4.3 | 当前 CSS / 测试仍断言 Newsreader 和 butter `#efca55`；V2 视觉不能机械沿用旧断言，按批准基线调整后同步改测试 | A §9 |

## 5. 平台与数据

| # | 要求（转述） | 出处 |
| --- | --- | --- |
| 5.1 | **TrueNAS 上自托管 Supabase** | A §6；H §4 |
| 5.2 | 网络隔离、备份与恢复 | A §6 表「Phase 1–3」 |
| 5.3 | **15 张表**（表名和字段仓库里没有记录） | A §6 表「Phase 1–3」 |
| 5.4 | RLS | A §6 表「Phase 1–3」；A §7 U7 |
| 5.5 | 迁移**默认非公开** | A §6 表「Phase 1–3」；A §7 U7 |
| 5.6 | publication / rights / facts 字段 | A §7 U7 |
| 5.7 | V2 允许「静态优先但非静态唯一」，要由 ADR 写清放宽旧站 server-only 限制的范围 | A §8 第 6 条 |

## 6. CRM / 询盘

| # | 要求（转述） | 出处 |
| --- | --- | --- |
| 6.1 | Name / Email / Message 表单；询盘持久化 | A §6 表「Phase 5 CRM」；A §7 U9 |
| 6.2 | 新询盘状态 `NEW` | A §7 U9 |
| 6.3 | pipeline、人工录入 | A §6 表「Phase 5 CRM」 |
| 6.4 | AI 摘要 / 回复草稿；**首封回复必须人工发送** | A §6 表「Phase 5 CRM」；A §7 U9；A §9 |

## 7. 私有预览与媒体

| # | 要求（转述） | 出处 |
| --- | --- | --- |
| 7.1 | 私有预览：随机 token、**7 天过期**、撤销、访问统计、下载权限、私有媒体保护 | A §6 表「Phase 6」；A §7 U10 |
| 7.2 | `VIEW_ONLY` 模式（交接文档补充：不承诺防截图或绝对禁止下载） | A §7 U10 |
| 7.3 | 媒体衍生：**2400 / 1600 / 1200 / 800 / thumbnail** | A §6 表「Phase 7 媒体」 |
| 7.4 | 后台上传 / 处理队列 | A §6 表「Phase 7 媒体」 |
| 7.5 | 原图原片不进网站，只放衍生图 | H §7；A §9 |

## 8. AI / Admin / Analytics / 切域 / 上线条件

| # | 要求（转述） | 出处 |
| --- | --- | --- |
| 8.1 | 人工 override、version、audit；AI 不得静默覆盖人工选择 | A §6 表「Phase 8–10」；A §9 |
| 8.2 | 受控发布 / 撤回、通知、Admin | A §6 表「Phase 8–10」 |
| 8.3 | 转化分析（Analytics） | A §6 表「Phase 8–10」 |
| 8.4 | `.com.au` 为 canonical，`.work` **301** 到 `.com.au` | A §2「DNS 与域名当前指向」；A §6；H §4 |
| 8.5 | 切域前 staging 验收、数据库恢复验证 | A §6 表「Phase 11」 |
| 8.6 | **V2 MVP 四个上线条件**：公共网站可靠；CRM 记录询盘；Admin 管理内容；数据库备份恢复已验证 | A §6 |

## 9. 阶段划分（仅知道名称）

A §6 对照表用到了这些阶段名，各阶段的详细内容和验收标准仓库里没有：

Phase 0 基线 → Phase 1–3 后台 / schema / 迁移 → Phase 4 前台 → Phase 5 CRM → Phase 6 私有预览 → Phase 7 媒体 → Phase 8–10 AI / Admin / Analytics → Phase 11 切域。

术语提示（A §6）：v0.2 里的「V1」指 **V2 平台的首轮 MVP**，和现有旧静态站的「V1 精简」不是一回事。

## 10. 背景（v0.2 之前，不算规范）

B（2026-08-30）给出过的约束有：「保持静态导出和 NAS/Nginx 部署兼容」「不引入必须依赖服务端运行的功能」。这些是**旧站**约束；按 A §8 第 6 条和 A §9，V2 可以有限放宽，放宽范围以 `docs/V2-ARCHITECTURE-ADR.md` 为准，旧静态站本身继续遵守。

## 11. 已知缺口（等原文补齐）

- 五项服务的名称和描述
- 15 张表的表名、字段、关系
- 各 Phase 的详细范围、验收标准和顺序依赖
- Admin 角色 / 权限模型；认证方式
- Analytics 的指标定义与工具
- 通知渠道
- v0.2 的作者、日期、版本历史
- 原文有、但交接文档没有转述的其它要求（数量未知）
