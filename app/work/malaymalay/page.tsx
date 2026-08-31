import type { Metadata } from "next";
import { CaseStudyPage } from "../../_components/CaseStudyPage";
import { caseStudies } from "../../_data/site";

export const metadata: Metadata = { title: "MalayMalay | First Rec.", description: caseStudies[7].summary };
export const dynamic = "force-static";

export default function Page() { return <CaseStudyPage project={caseStudies[7]} number="08" />; }
