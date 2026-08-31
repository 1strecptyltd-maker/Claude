import type { Metadata } from "next";
import { CaseStudyPage } from "../../_components/CaseStudyPage";
import { caseStudies } from "../../_data/site";

export const metadata: Metadata = { title: "Molly Tea | First Rec.", description: caseStudies[1].summary };
export const dynamic = "force-static";
export default function Page() { return <CaseStudyPage project={caseStudies[1]} number="02" />; }
