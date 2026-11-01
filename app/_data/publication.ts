import { caseStudies, type CaseStudy } from "./site";

export type PublicationStatus = "public" | "internal-review";

export type PublicationRecord = {
  status: PublicationStatus;
  /** Where the status comes from. `mediaNotice` copy is never treated as evidence on its own. */
  evidence: string;
  /** Founder decision (U4). Shown in the home page selection. */
  featured: boolean;
  /** True while `featured` is a placeholder rather than the founder's choice. */
  featuredProvisional: boolean;
  /** Founder decision (U4). `null` falls back to the order of `caseStudies` in site.ts. */
  order: number | null;
};

// Founder decision 2026-11-01 (docs/DECISIONS.md): eight cases on the home page in a fixed order; other public
// cases stay off it. `overrides` records each explicit decision; the defaults below only apply to cases without one.
const record = (status: PublicationStatus, evidence: string, overrides: Partial<PublicationRecord> = {}): PublicationRecord => ({
  status,
  evidence,
  featured: status === "public",
  featuredProvisional: status === "public",
  order: null,
  ...overrides,
});

const AUDIT = "docs/HANDOFF-2026-10-17-CLAUDE.md section 5";
const SUMMARY = "HANDOFF.md sections 4 and 6";
const PENDING = `${AUDIT}: internal review, publication clearance pending`;
const DRIVE_CSV = `${PENDING}; the 2026-08-15 Drive CSV approved ingestion only (docs/PORTFOLIO-INGESTION-2026-08-15-GOOGLE-DRIVE.md)`;
const LOCAL_2026_09_01 = `${SUMMARY}; ${AUDIT}; docs/PORTFOLIO-INGESTION-2026-09-01-LOCAL.md records the user's explicit public-display instruction. Credits and project details still to confirm`;
const FOUNDER_CONFIRMED = `${SUMMARY}; ${AUDIT} lists it as authorised from the existing marker; the founder confirmed public display on 2026-10-31 (docs/DECISIONS.md). No written client approval is stored in the repo`;
const FOUNDER_2026_11_01 = "docs/DECISIONS.md 2026-11-01: the founder made this case public, following the 2026-10-23 decision that the whole portfolio may be published";
const HOME_2026_11_01 = { featured: true, featuredProvisional: false } as const;
const OFF_HOME = { featured: false, featuredProvisional: false } as const;

// Every case study needs a record here. Anything not explicitly cleared stays internal-review.
export const publication: Record<string, PublicationRecord> = {
  "geely-australia": record("public", FOUNDER_2026_11_01, { ...HOME_2026_11_01, order: 1 }),
  "molly-tea": record("internal-review", PENDING),
  "stasis-clinic": record("internal-review", PENDING),
  "bentley": record("public", FOUNDER_2026_11_01, OFF_HOME),
  "eimele": record("internal-review", PENDING),
  "chongguang-workshop": record("internal-review", PENDING),
  "hatman": record("internal-review", PENDING),
  "malaymalay": record("internal-review", PENDING),
  "mirror-and-moon": record("internal-review", PENDING),
  // Founder, 2026-10-31: public, but not strong enough for the home page selection.
  "spin-panda": record("public", FOUNDER_CONFIRMED, { featured: false, featuredProvisional: false }),
  "spring-bistro": record("internal-review", DRIVE_CSV),
  "chuanxi-road-north": record("internal-review", DRIVE_CSV),
  "tea-spot": record("internal-review", DRIVE_CSV),
  "bengong-ovaltine": record("internal-review", DRIVE_CSV),
  "chimichuri": record("internal-review", DRIVE_CSV),
  "milk-flower": record("internal-review", DRIVE_CSV),
  "xin-hao-cai": record("internal-review", DRIVE_CSV),
  "robo-tea-restaurant": record("internal-review", DRIVE_CSV),
  "nakedfoods": record("internal-review", DRIVE_CSV),
  "goobne": record("internal-review", DRIVE_CSV),
  "paparich": record("internal-review", DRIVE_CSV),
  "viola-cafe": record("internal-review", DRIVE_CSV),
  "tea-struck": record("internal-review", DRIVE_CSV),
  "cocoa": record("internal-review", DRIVE_CSV),
  "cao-cao": record("internal-review", DRIVE_CSV),
  "wcrab": record("internal-review", DRIVE_CSV),
  "xinbar": record("internal-review", DRIVE_CSV),
  "zhongchu-dim-sum": record("internal-review", DRIVE_CSV),
  "bengong-yangmei": record("internal-review", DRIVE_CSV),
  "sweet-lu": record("internal-review", DRIVE_CSV),
  "dr-lewinn": record("public", `${FOUNDER_CONFIRMED}. The direct-client claim applies to this project only`, { ...HOME_2026_11_01, order: 4 }),
  "indiba-icc": record("public", LOCAL_2026_09_01, { ...HOME_2026_11_01, order: 7 }),
  "jo-loves": record("public", LOCAL_2026_09_01, OFF_HOME),
  "mm-karaoke": record("public", LOCAL_2026_09_01, OFF_HOME),
  "nvidia": record("public", LOCAL_2026_09_01, OFF_HOME),
  "tiktok": record("public", FOUNDER_2026_11_01, { ...HOME_2026_11_01, order: 2 }),
  "srw": record("public", FOUNDER_2026_11_01, { ...HOME_2026_11_01, order: 3 }),
  "dreame": record("public", FOUNDER_2026_11_01, { ...HOME_2026_11_01, order: 5 }),
  "narwal": record("public", FOUNDER_2026_11_01, { ...HOME_2026_11_01, order: 6 }),
  "inner-health": record("public", FOUNDER_2026_11_01, { ...HOME_2026_11_01, order: 8 }),
  "emp-dairy-lactoferrin": record("internal-review", `${PENDING}; docs/PORTFOLIO-INGESTION-2026-09-01-LOCAL.md: later addition, outside the four-project authorisation`),
};

// Build-time switch, inlined by vite.config.ts. Public builds are the default.
export const includeInternal = process.env.FIRST_REC_INCLUDE_INTERNAL === "1";

export function getPublication(slug: string): PublicationRecord {
  const entry = publication[slug];
  if (!entry) throw new Error(`Missing publication record for case study slug: ${slug}`);
  return entry;
}

export function isPublic(slug: string): boolean {
  return getPublication(slug).status === "public";
}

/** Whether this build exports the case study: public cases always, internal-review cases only in the preview build. */
export function isListed(slug: string): boolean {
  return includeInternal || isPublic(slug);
}

function byPublicationOrder(a: CaseStudy, b: CaseStudy): number {
  const orderA = getPublication(a.slug).order ?? Number.POSITIVE_INFINITY;
  const orderB = getPublication(b.slug).order ?? Number.POSITIVE_INFINITY;
  if (orderA !== orderB) return orderA - orderB;
  return caseStudies.indexOf(a) - caseStudies.indexOf(b);
}

export function publicCaseStudies(): CaseStudy[] {
  return caseStudies.filter((project) => isPublic(project.slug)).sort(byPublicationOrder);
}

/** Case studies this build may render, in display order. */
export function listedCaseStudies(): CaseStudy[] {
  return caseStudies.filter((project) => isListed(project.slug)).sort(byPublicationOrder);
}

/** Home page selection: featured public cases in display order. */
export function featuredCaseStudies(): CaseStudy[] {
  return publicCaseStudies().filter((project) => getPublication(project.slug).featured);
}

// Founder decision 2026-11-01: the INDIBA photo leads the home page.
export const HOME_HERO_SLUG = "indiba-icc";

/** Hero project: a featured public case if one is set, otherwise the first public case in display order. */
export function heroCaseStudy(): CaseStudy {
  const cases = publicCaseStudies();
  const chosen = cases.find((project) => project.slug === HOME_HERO_SLUG);
  const hero = chosen ?? cases.find((project) => getPublication(project.slug).featured) ?? cases[0];
  if (!hero) throw new Error("No public case study is available for the home page hero");
  return hero;
}
