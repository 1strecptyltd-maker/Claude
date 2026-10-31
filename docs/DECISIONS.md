# 创始人决策记录

按日期记录已确认的对外配置和产品决定。代码、构建参数和 handoff 文档与这里冲突时，以这里最新一条为准，并同步修正。

## 2026-10-31

### 联系邮箱：`info@firstrec.com.au`

- 网站对外联系邮箱改为 `info@firstrec.com.au`，替换 `hello@cheese.studio`。
- 已改：`app/_data/site.ts` 的默认值、`compose.yaml` 构建参数默认值、`.env.example`。
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
