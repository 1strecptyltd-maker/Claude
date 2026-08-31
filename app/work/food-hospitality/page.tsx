import type { Metadata } from "next";
import Image from "next/image";
import { ContactBand } from "../../_components/ContactBand";
import { PageShell } from "../../_components/PageShell";
import { caseStudies } from "../../_data/site";

export const metadata: Metadata = {
  title: "Food + hospitality | First Rec.",
  description: "A locally ingested selection of food, service and hospitality imagery prepared for internal review.",
};
export const dynamic = "force-static";

const projects = caseStudies.filter((project) => project.discipline === "Food + hospitality");

export default function FoodHospitalityPage() {
  return (
    <PageShell>
      <header className="page-hero page-hero--work">
        <p className="eyebrow">Food + hospitality</p>
        <h1>Made to be<br />looked at hungry.</h1>
        <p>A first local selection from the user-approved Google Drive archive, shaped around food, spaces, service and social-ready product frames.</p>
      </header>
      <aside className="preview-note">Internal review assets / The Drive approval record does not confirm public clearance, final credits or identifiable-person permissions.</aside>
      <section className="work-index" aria-label="Food and hospitality case studies">
        <div className="section-heading">
          <h2>{projects.length} selected projects.</h2>
          <p>Each set is intentionally compact and uses only images downloaded from the approved source folders.</p>
        </div>
        <div className="work-category-list">
          {projects.map((project, index) => (
            <article className="work-entry" key={project.slug}>
              <a className="work-entry-image" href={`/work/${project.slug}/`}>
                <Image src={project.image} alt={project.alt} fill sizes="(max-width: 767px) 100vw, 72vw" />
              </a>
              <div className="work-entry-copy">
                <p className="case-category">{String(index + 1).padStart(2, "0")} / {project.category}</p>
                <h3><a href={`/work/${project.slug}/`}>{project.client}</a></h3>
                <p>{project.summary}</p>
                <p className="case-scope">{project.scope}</p>
                <a className="text-link" href={`/work/${project.slug}/`}>View project</a>
              </div>
            </article>
          ))}
        </div>
      </section>
      <ContactBand />
    </PageShell>
  );
}
