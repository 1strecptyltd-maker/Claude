import type { Metadata } from "next";
import { CaseStudyPage } from "../../_components/CaseStudyPage";
import { caseStudies } from "../../_data/site";

export const metadata: Metadata = { title: "Geely Australia | First Rec.", description: caseStudies[0].summary };
export const dynamic = "force-static";
export default function Page() { return <CaseStudyPage project={caseStudies[0]} number="01" />; }
