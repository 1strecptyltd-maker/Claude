import { caseStudies, type CaseStudy } from "./site";

// Case study routes look projects up by slug so reordering `caseStudies` never changes what a URL shows.
export function getCaseStudy(slug: string): CaseStudy {
  const project = caseStudies.find((item) => item.slug === slug);
  if (!project) throw new Error(`Unknown case study slug: ${slug}`);
  return project;
}
