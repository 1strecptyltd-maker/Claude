# First Rec. portfolio

A multi-page static portfolio for First Rec., an independent visual production studio founded by Cheese in Sydney.

## Pages

- Home
- Work index
- Case studies at `/work/<slug>/` and a Food + hospitality collection (which cases are built depends on publication status, below)
- Services
- About
- Equipment hire
- Contact

## Local development

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Static build

```bash
npm run build
```

The deployable static site is written to `dist/client/`. See `NAS-DEPLOY.md` for direct upload and Docker instructions.

## Publication status

Every case study has a record in `app/_data/publication.ts`: `status` (`"public"` or `"internal-review"`), `evidence` (the document that clears it), `featured` and `order`. Anything not explicitly cleared stays `"internal-review"`; the `mediaNotice` caption is never treated as approval on its own. Four public cases (`indiba-icc`, `jo-loves`, `mm-karaoke`, `nvidia`) cite the public-display instruction recorded in `docs/PORTFOLIO-INGESTION-2026-09-01-LOCAL.md`. The other two, `spin-panda` and `dr-lewinn`, are public only on the pre-existing "Public display authorised" marker: no original approval record for them is in `docs/`. They stay public pending the founder's confirmation (open item in `docs/DECISIONS.md`).

| Build | Command | Case studies |
| --- | --- | --- |
| Public (default) | `npm run build` / `npm test` (rebuilds, then tests) / `npm run test:dist` (tests the current `dist/client/` only) | Only `"public"` cases. Internal-review case pages are not exported at all, their names and media paths appear nowhere in `dist/client/`, and unreferenced files under `dist/client/portfolio/` are removed. |
| Internal-review preview | `FIRST_REC_INCLUDE_INTERNAL=1 npm run build` (or `npm run build:internal`, `npm run test:internal`) | All 36 cases, with internal-review notices. Never deploy this build. |

`npm run build` ends with `scripts/prune-unpublished-media.mjs`, which removes unreferenced files under `dist/client/portfolio/` in the public build (it does nothing in the internal preview). Before uploading a `dist/client/`, run `env -u FIRST_REC_INCLUDE_INTERNAL npm run test:dist` and `npm run check:public` on it (`NAS-DEPLOY.md`). Never export `FIRST_REC_INCLUDE_INTERNAL` or set it in any `.env` file for a deploy build.

`FIRST_REC_INCLUDE_INTERNAL` is read at build time only (inlined by `vite.config.ts`); any value other than `1` gives the public build. Case pages come from one route, `app/work/[slug]/page.tsx`, whose `generateStaticParams()` returns only the cases the current build may publish. To publish another case, add the approval record to `docs/`, cite it in its `evidence`, set its `status` to `"public"`, and commit its images under `public/portfolio/`.

## Content

- Shared project, service and equipment content: `app/_data/site.ts`
- Publication status, featured flag and order per case study: `app/_data/publication.ts`
- Page layouts and copy: `app/`
- Images: `public/portfolio/`
- Public URL and contact email: `.env`

Internal-review case studies use selected local media whose public-display permissions, project facts and credits remain unconfirmed; they only appear in the internal-review preview build, labelled as pending publication clearance. See `docs/PORTFOLIO-INGESTION-2026-08-11.md` for the selection record and release blockers.
