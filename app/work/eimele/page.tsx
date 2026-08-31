import type { Metadata } from "next";
import { CaseStudyPage } from "../../_components/CaseStudyPage";
import { caseStudies } from "../../_data/site";

export const metadata: Metadata = { title: "Eimele | First Rec.", description: caseStudies[4].summary };
export const dynamic = "force-static";
export default function Page() { return <CaseStudyPage project={caseStudies[4]} number="05" />; }
