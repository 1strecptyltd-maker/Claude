import type { Metadata } from "next";
import { CaseStudyPage } from "../../_components/CaseStudyPage";
import { getCaseStudy } from "../../_data/project-access";
const project = getCaseStudy("robo-tea-restaurant");
export const metadata: Metadata = { title: `${project.client} | First Rec.`, description: project.summary };
export const dynamic = "force-static";
export default function Page() { return <CaseStudyPage project={project} number="08" />; }
