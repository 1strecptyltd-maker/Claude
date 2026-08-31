import type { Metadata } from "next";
import { CaseStudyPage } from "../../_components/CaseStudyPage";
import { caseStudies } from "../../_data/site";

export const metadata: Metadata = { title: "Stasis Clinic | First Rec.", description: caseStudies[2].summary };
export const dynamic = "force-static";
export default function Page() { return <CaseStudyPage project={caseStudies[2]} number="03" />; }
