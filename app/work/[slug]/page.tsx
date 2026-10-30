import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseStudyPage } from "../../_components/CaseStudyPage";
import { getCaseStudy } from "../../_data/project-access";
import { isListed, listedCaseStudies } from "../../_data/publication";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-static";
export const dynamicParams = false;

// Only cases this build may publish get a static page; internal-review cases are not exported at all in public mode.
export function generateStaticParams() {
  return listedCaseStudies().map((project) => ({ slug: project.slug }));
}

async function listedProject(params: Props["params"]) {
  const { slug } = await params;
  if (!isListed(slug)) notFound();
  return getCaseStudy(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await listedProject(params);
  return { title: `${project.client} | First Rec.`, description: project.summary };
}

export default async function Page({ params }: Props) {
  const project = await listedProject(params);
  const number = listedCaseStudies().findIndex((item) => item.slug === project.slug) + 1;
  return <CaseStudyPage project={project} number={String(number).padStart(2, "0")} />;
}
