# First Rec. portfolio

A multi-page static portfolio for First Rec., an independent visual production studio founded by Cheese in Sydney.

## Pages

- Home
- Work index
- Nine internal-review case studies across film, photography and food
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

## Content

- Shared project, service and equipment content: `app/_data/site.ts`
- Page layouts and copy: `app/`
- Images: `public/portfolio/`
- Public URL and contact email: `.env`

The reviewed case studies use selected local media in an internal-review draft. Public-display permissions, project facts and credits remain unconfirmed, so the UI labels the work as pending publication clearance. See `docs/PORTFOLIO-INGESTION-2026-08-11.md` for the selection record and release blockers.
