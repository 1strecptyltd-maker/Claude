import type { Metadata } from "next";
import { CaseStudyPage } from "../../_components/CaseStudyPage";
import { caseStudies } from "../../_data/site";

export const metadata: Metadata = { title: "Chongguang Workshop | First Rec.", description: caseStudies[5].summary };
export const dynamic = "force-static";

export default function Page() { return <CaseStudyPage project={caseStudies[5]} number="06" />; }
