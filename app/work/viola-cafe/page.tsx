import type { Metadata } from "next";
import { CaseStudyPage } from "../../_components/CaseStudyPage";
import { caseStudies } from "../../_data/site";
const project = caseStudies.find((item) => item.slug === "viola-cafe")!;
export const metadata: Metadata = { title: `${project.client} | First Rec.`, description: project.summary };
export const dynamic = "force-static";
export default function Page() { return <CaseStudyPage project={project} number="12" />; }
