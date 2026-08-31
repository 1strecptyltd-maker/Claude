import type { Metadata } from "next";
import { CaseStudyPage } from "../../_components/CaseStudyPage";
import { caseStudies } from "../../_data/site";

export const metadata: Metadata = { title: "Mirror & Moon | First Rec.", description: caseStudies[8].summary };
export const dynamic = "force-static";

export default function Page() { return <CaseStudyPage project={caseStudies[8]} number="09" />; }
