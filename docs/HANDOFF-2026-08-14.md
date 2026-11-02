# First Rec. portfolio handoff

Last updated: 2026-08-14 (Australia/Sydney)

This is the compact handoff for the next session. The full asset audit remains in [`docs/PORTFOLIO-INGESTION-2026-08-11.md`](docs/PORTFOLIO-INGESTION-2026-08-11.md), and the workspace-level rules are in [`AGENTS.md`](../../../AGENTS.md).

## Start here

- Project: `/Users/cheese/Documents/工作室创业/00-驾驶舱/作品集/cheese-portfolio-site`
- Working directory for the next session: the project path above.
- Local preview: `http://localhost:3000/`; run `npm run dev` from the project directory when needed.
- The user wants a portfolio for **First Rec.**, with **Cheese as Founder**. Keep the site in English and preserve the current warm editorial direction.
- This is an internal-review portfolio. Do not publish externally until project permissions and facts are confirmed.

## Current implementation

- Next/vinext static export with `images.unoptimized: true` and NAS/Nginx deployment support.
- Fifteen directory-style HTML pages are exported under `dist/client/`.
- Work index is statically grouped into:
  - Film + production
  - Photography
  - Food + menu
- All case-study media uses explicit per-asset ratios and `object-fit: contain`; do not force portrait assets into landscape crops or the reverse.
- Shared data is in `app/_data/site.ts`; shared presentation is in `app/_components/CaseStudyPage.tsx`.
- Shared shell files are `app/_components/SiteHeader.tsx`, `SiteFooter.tsx`, `PageShell.tsx` and `ContactBand.tsx`.
- The fixed paper/warm palette and reduced-motion CSS behaviour are intentional. Do not reintroduce automatic dark mode or scroll listeners.

## Routes

`/`, `/work/`, `/work/geely-australia/`, `/work/molly-tea/`, `/work/stasis-clinic/`, `/work/bentley/`, `/work/eimele/`, `/work/chongguang-workshop/`, `/work/hatman/`, `/work/malaymalay/`, `/work/mirror-and-moon/`, `/services/`, `/about/`, `/equipment/`, `/contact/`.

## First Rec. brand integration

- Logo archive: `/Users/cheese/Documents/工作室创业/10-资产管理/品牌资产/First_Rec_Logo_Suite/`
- Website logo assets: `public/brand/first-rec/`
  - `wordmark.svg`: header and footer wordmark
  - `icon.svg`: favicon and About hero mark
  - `website-header-paper.png`: supplied platform asset, retained for future use
- Social preview: `public/og-first-rec.png` (1920 × 1080 supplied First Rec. title card). The old `public/og-v2.png` Cheese card is retained but unused.
- `app/layout.tsx` contains First Rec. metadata, favicon, Open Graph and Twitter metadata.
- `app/about/page.tsx` identifies Cheese as Founder.
- Case-study fact label is `First Rec. role`.
- Existing contact address remains `hello@cheese.studio` because no replacement address was supplied.

## Current case studies and asset status

All nine are labelled as internal review or pending clearance. The route copy is intentionally neutral and avoids unsupported dates, credits, outcomes and claims.

| Route | Selected media | Main unresolved items |
| --- | --- | --- |
| `/work/geely-australia/` | 5 photographs + selected launch film | public-display permission, client/crew facts, event and third-party marks |
| `/work/molly-tea/` | `Green Sq.mov` opening film + poster; `未命名项目.mov` retained as alternate | guests/staff/minors, location/brand permission, credits and public release |
| `/work/stasis-clinic/` | 4 representative frames + brand film | treatment participants, clinic/location, talent and third-party product permissions; avoid medical efficacy claims |
| `/work/bentley/` | 5 photographs from SATASSD Work | client, date, credits, model and public-display permission |
| `/work/eimele/` | 5 photographs from 亦餐 | model/brand/music permissions and final product-claim clearance |
| `/work/chongguang-workshop/` | 6 vertical studio portraits | title is provisional; model, styling, credits and release unknown |
| `/work/hatman/` | 6 landscape catalog images | client details, model/animal permission and hat graphic rights |
| `/work/malaymalay/` | 5 food/menu photographs | source notes request more saturation/retouch; client, menu facts, final colour and release unknown |
| `/work/mirror-and-moon/` | 6 portrait photographs | title follows the supplied folder name; client relationship, date, location, credits, model/jewellery permissions and release unknown |

Source archives are under `/Users/cheese/Documents/工作室创业/10-资产管理/待审核/`; the exact intake paths and audit evidence are documented in the portfolio ingestion report. The Dropbox `lumiere.mov` is a separate Lumière Cosmetic Clinic social cut and is intentionally excluded from Molly Tea.

## Validation already completed

- `npm test`: passed; static build completed, 16 routes prerendered by vinext, 15 directory-style HTML files emitted, and 3 rendered-HTML tests passed.
- `npm run lint`: passed.
- `git diff --check`: passed.
- Static output: `dist/client/`.
- Refreshed deliverables:
  - `outputs/cheese-static-site.zip`
  - `outputs/cheese-portfolio-nas.zip`
- Previous deliverables are preserved as `work/cheese-static-site-before-first-rec.zip` and `work/cheese-portfolio-nas-before-first-rec.zip`.
- The pre-Mirror & Moon deliverables are also preserved as `work/cheese-static-site-before-mirror-and-moon.zip` and `work/cheese-portfolio-nas-before-mirror-and-moon.zip`.
- Desktop logo smoke check confirmed header/footer wordmark, favicon path, metadata title and First Rec. natural dimensions. Existing case-study responsive QA confirmed no forced cross-orientation cropping and no horizontal overflow on reviewed routes. Mirror & Moon responsive QA at 1280 × 720 and 390 × 844 confirmed the hero and five gallery assets loaded at native dimensions, with no horizontal overflow or browser warnings/errors.

## Commands

```sh
npm ci
npm run dev
npm test
npm run lint
npm run build
```

The deployable static root is `dist/client/`. Docker/NAS instructions are in `NAS-DEPLOY.md`; `compose.yaml` serves the built output through Nginx.

## Recommended next actions

1. Confirm written portfolio/public-display permission for every reviewed project, especially identifiable people, minors, event music, clinic/treatment content, third-party products and brand marks.
2. Confirm missing dates, locations, credits, client names and roles before adding them to visible copy.
3. Review the remaining SATASSD Work folders before adding more cases; do not promote assets based on filenames alone.
4. Confirm the final domain and contact email, then rebuild with `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_CONTACT_EMAIL`.
5. Test the refreshed static zip on the target NAS web root or reverse proxy before public launch.

## Guardrails

- Do not invent testimonials, client logos, social handles, pricing, dates, credits, outcomes or permissions.
- Keep visible site copy in English unless the user explicitly changes that decision.
- Preserve route slugs, static export, NAS compatibility, accessibility and reduced-motion behaviour.
- Keep internal-review/publication-clearance notices until written approval exists.
- Prefer editing `app/_data/site.ts` and shared components over bespoke pages.
- Do not use automatic dark mode, server-only dependencies or client-side scroll state without explicit approval.
