import type { Metadata } from "next";
import { CaseStudyPage } from "../../_components/CaseStudyPage";
import { caseStudies } from "../../_data/site";

export const metadata: Metadata = { title: "Hatman | First Rec.", description: caseStudies[6].summary };
export const dynamic = "force-static";

export default function Page() { return <CaseStudyPage project={caseStudies[6]} number="07" />; }
