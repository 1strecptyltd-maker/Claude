# 创始人决策记录

按日期记录已确认的对外配置和产品决定。代码、构建参数和 handoff 文档与这里冲突时，以这里最新一条为准，并同步修正。

## 2026-10-31

### 联系邮箱：`info@firstrec.com.au`

- 网站对外联系邮箱改为 `info@firstrec.com.au`，替换 `hello@cheese.studio`。
- 已改：`app/_data/site.ts` 的默认值、`compose.yaml` 构建参数默认值、`Dockerfile` 的 `ARG NEXT_PUBLIC_CONTACT_EMAIL` 默认值、`.env.example`。
- 线上旧版（2026-08-13 构建）仍显示 `hello@cheese.studio`，下次部署后才会更新。

### 正式域名：`firstrec.com.au`（暂缓切换）

- 目标：以 `https://www.firstrec.com.au` 作为 canonical 域名，`firstrec.work` 最终 301 到它。
- 现状（见 `docs/HANDOFF-2026-10-17-CLAUDE.md` 第 2 节）：`firstrec.com.au` 的 DNS 在 GoDaddy，用 frameset 框架嵌入 `www.firstrec.work`；`firstrec.work` 的 DNS 在 Cloudflare。两边账户和 DNS 管理尚未统一。
- 在 `.com.au` 直接提供网站内容之前，**生产构建继续用 `NEXT_PUBLIC_SITE_URL=https://www.firstrec.work`**。原因：如果现在把 canonical/OG 指向 `.com.au`，搜索引擎和社交卡片会指向一个只有 frameset、没有实际内容的页面。
- 切换前需要创始人完成：
  1. 确认 `firstrec.com.au` 注册商与 DNS 控制账户，决定 DNS 统一放在 Cloudflare 还是 GoDaddy。
  2. 让 `www.firstrec.com.au` 直接解析到现有 Cloudflare → NAS 链路（Nginx Proxy Manager 增加该主机名和证书），取消 GoDaddy frameset 转发。
  3. 裸域 `firstrec.com.au` 301 到 `https://www.firstrec.com.au`；`firstrec.work` / `www.firstrec.work` 301 到 `.com.au` 对应路径。
  4. 以上验证通过后，用 `NEXT_PUBLIC_SITE_URL=https://www.firstrec.com.au` 重新构建并部署。

### 首页精选：先用占位

- 创始人尚未选定首页 6–8 个精选案例和顺序。
- 在选定之前，精选位暂用已取得公开授权的案例按现有顺序填充，并在数据里标为占位（provisional），不代表最终选择。已授权案例不足 6 个时如实显示，不凑数。

### `spin-panda`、`dr-lewinn`：创始人确认可以公开

- 创始人 2026-10-31 确认这两个案例已获客户同意，可以公开展示，保持 `"public"`。
- 仓库里仍没有书面授权（邮件、合同条款等）；`app/_data/publication.ts` 的 `evidence` 引用本条记录。以后拿到书面记录，存进 `docs/` 再改 `evidence`。

### 首页精选：Spin Panda 不进首页

- 创始人认为 Spin Panda 不算特别好的案例：保持公开（Work 页和直接链接都在），但不进首页精选，也不做首页大图。
- `app/_data/publication.ts` 里 `spin-panda` 记为 `featured: false`（明确决定，不再是占位）。其余 5 个公开案例仍按现有顺序作首页精选占位（`featuredProvisional`），等创始人选定。

### 开发期媒体：用占位文件，真实素材在 NAS 上填充

- 不把真实照片、视频拷进仓库或云端开发环境。开发时运行 `npm run media:placeholders`，给 `app/_data/site.ts` 引用但本地缺失的每个文件生成占位：图片按数据里的比例，视频是几 KB 的 H.264 短片，画面写着 PLACEHOLDER。已有文件不会被覆盖；`npm run media:placeholders:clean` 只删除带标记的占位文件。
- 每个占位文件都嵌了 `FIRST-REC-PLACEHOLDER` 标记；`npm run check:public` 发现标记就报错，不让上线（预览可加 `--allow-placeholders` 降为警告）。占位文件所在路径都已在 `.gitignore` 里，不会被提交。
- 开发完成后，创始人在 NAS 上部署时把真实素材放进 `public/portfolio/` 对应位置，重新构建，`check:public` 不加 `--allow-*` 通过后再上线。

### 案例文案：按 2026-10-31 草稿替换

- 创始人 2026-10-31 确认 `docs/COPY-DRAFTS-2026-10-31.md` 的新文案，已替换到 `app/_data/site.ts`、`app/about/page.tsx`。
- Dr. LeWinn's：品牌直接委托，没有代理；First Rec. 负责制作与后期；周年影片用了一部分素材库素材，客户提供的素材基本没用。三支影片（含周年影片）都交付了带字幕和无字幕两个版本。
- Spin Panda：Starlink 统一称为 "agency partner"（不用 "media partner" / "media intermediary"），包括页面上的标签。
- 草稿里列出的其他问题（展会名称、日期、委托关系等）还没回答，新文案没有写这些内容。

### 2026-11-01 首页改版：新阵容、全部公开、竖屏区

- 创始人选定首页新设计（杂志巨字版式 + 9:16 竖屏轮播，原型见设计稿 dir-4）。第一轮范围：首页按新设计重做、全站换字体颜色和页头页脚、新案例先做简版案例页、作品页加竖屏 Short-form 区。作品页、案例页的重新排版放第二轮。
- 公开：`geely-australia`、`bentley` 改为公开；新增案例 TikTok、SRW Laboratories、Dreame、Narwal、Inner Health，均公开。延续 2026-10-23「作品集、客户名单都可公开」的决定。`.gitignore` 里 Geely、Bentley 两个图片目录据此删除。
- 委托关系：TikTok、SRW、Narwal、Coach 都经 agency 接单，案例页写 agency partner，不写直客。Dreame、Inner Health 的委托关系待确认，页面暂不写。
- Hennessy：成片库里的 Hennessy 竖屏片是客户提供的混剪素材，不是 First Rec. 拍摄的。全站不使用这条片，也不写 Hennessy 现场。
- 首页精选 8 个，顺序为：Geely、TikTok、SRW、Dr. LeWinn's、Dreame、Narwal、INDIBA、Inner Health。Spin Panda、Jo Loves、MM Karaoke、NVIDIA、Bentley 保持公开，但不进首页精选。
- 首页竖屏区 6 支：Bentley、Coach、Bvlgari、Range Rover、TikTok Creators Party、Geely EE Show 2026。作品页再加 MG、TikTok Creator Summit、Dangerously Modern，共 9 支（Cartier 已于 11-02 撤下，见下）。Dior 确认交付版之前不放。
- 英文文案先用草稿，上线前由创始人统一修改。
- 公开 slug：`geely-australia`、`bentley`、`tiktok`、`srw`、`dreame`、`narwal`、`inner-health`。

### 2026-11-02 撤下 Cartier 竖屏片

- 创始人确认 Cartier 那条竖屏片不是 First Rec. 制作的，全站不使用，和 Hennessy 同样处理。作品页 short-form 区改为 9 支。
