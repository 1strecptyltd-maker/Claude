# Google Drive approved media ingestion — 2026-08-15

## Scope

The supplied CSV marked 71 Drive project folders as approved for ingestion. This pass did not download the full archive. It downloaded and visually reviewed 51 image candidates from 20 food and hospitality folders, then selected 45 non-redundant frames for the local website prototype, giving the collection 20 projects.

“Approved” here means approved in the supplied CSV for asset ingestion. It does not confirm publication clearance, final credits, project facts, or identifiable-person permissions.

## Selected local sources

| Project | Source folder | Selected source files | Website output |
| --- | --- | --- | --- |
| Spring Bistro / 春舍鲜厨 | Drive folder (internal Drive link removed) | `春舍鲜厨2639.jpg`, `0Y8A6682.jpg` | `public/portfolio/food-hospitality/spring-bistro/` |
| 春熙路北 | Drive folder (internal Drive link removed) | `Capture One Catalog1628.jpg`, `1677.jpg`, `1622.jpg`, `1644.jpg` | `public/portfolio/food-hospitality/chuanxi-road-north/` |
| Tea Spot | Drive folder (internal Drive link removed) | `0Y8A6766.jpg`, `0Y8A6737.jpg`, `0Y8A6783.jpg` | `public/portfolio/food-hospitality/tea-spot/` |
| Bengong's Tea / Ovaltine | Drive folder (internal Drive link removed) | `0Y8A6848.jpg`, `0Y8A6804.jpg`, `0Y8A6786.jpg` | `public/portfolio/food-hospitality/bengong-ovaltine/` |
| CHIMICHURI | Drive folder (internal Drive link removed) | `0Y8A9621.jpg`, `0Y8A9594.jpg`, `0Y8A9603.jpg` | `public/portfolio/food-hospitality/chimichuri/` |

## Selection notes

- The lead images prioritise food, packaging, interior context or service rather than portrait-only frames.
- Identifiable people remain in some Tea Spot and Spring Bistro frames; these pages are explicitly labelled internal review.
- Copy stays neutral and source-supported. It does not invent dates, locations, deliverables, outcomes, credits or permissions.
- The original downloaded candidates are retained under `10-资产管理/待审核/2026-08-15_GoogleDrive_审批通过_媒体/`.
- Forty-five selected originals are copied into `10-资产管理/成片库/待整理_2026-08-15_GoogleDrive_审批通过/宣传物料/`; final成片库 promotion still requires file-level and permission confirmation.
- The added second batch contains 15 projects: `泰椰奶花`, `新濠彩`, `ROBO茶餐厅`, `Nakedfoods-2`, `Goobne`, `Paparich`, `Viola Cafe`, `Tea-Struck`, `cocoa`, `曹操`, `WBCrab`, `Xinbar Photos`, `中厨点心`, `本宫杨梅` and `小鹿新店`. `Wyatt` was downloaded as a candidate during exploration but was not promoted because the inspected frame read as a portrait rather than a food or hospitality work sample.

## Website routes

- Collection: `/work/food-hospitality/`
- Case studies: `/work/spring-bistro/`, `/work/chuanxi-road-north/`, `/work/tea-spot/`, `/work/bengong-ovaltine/`, `/work/chimichuri/`

## Validation

Run from the site project:

```text
npm run lint
npm test
npm run build
```

Browser QA should confirm the collection and five case-study routes at `http://localhost:3000/` while the dev server is running. No online deployment was performed in this local-only pass.
