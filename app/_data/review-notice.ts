import { includeInternal } from "./publication";
import type { CaseStudy } from "./site";

// `mediaNotice` is a review note ("Public display authorised / … to confirm"), never visitor copy: only the
// internal preview shows it. Kept out of publication.ts, which must not read notice text.
export function reviewNotice(project: CaseStudy): string | undefined {
  return includeInternal ? project.mediaNotice : undefined;
}

// Facts such as `role` carry review segments ("Photography / Public credits to confirm"). Public builds drop
// those segments and keep the rest; the internal preview shows the full text.
const reviewSegment = /to confirm|clearance|authori[sz]ed|internal review/i;

export function withoutReviewNotes(text: string): string {
  if (includeInternal) return text;
  return text.split(" / ").filter((segment) => !reviewSegment.test(segment)).join(" / ");
}
