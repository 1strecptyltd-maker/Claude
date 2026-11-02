import type { Metadata } from "next";
import Image from "next/image";
import { ContactBand } from "../../_components/ContactBand";
import { PageShell } from "../../_components/PageShell";
import { isPublic, listedCaseStudies } from "../../_data/publication";

export const metadata: Metadata = {
  title: "Food + hospitality | First Rec.",
  description: "Food, service and hospitality imagery shaped around appetite, spaces and social-ready product frames.",
};
export const dynamic = "force-static";

const projects = listedCaseStudies().filter((project) => project.discipline === "Food + hospitality");
const hasInternalReview = projects.some((project) => !isPublic(project.slug));

// vinext's static export fails the build on a non-200 static route, so this page cannot be skipped when it is
// empty. It renders an honest empty state instead, and /work/ stops linking to it.
export default function FoodHospitalityPage() {
  return (
    <PageShell current="/work/">
      <header className="page-hero page-hero--work">
        <p className="eyebrow">Food + hospitality</p>
        <h1>Made to be<br />looked at hungry.</h1>
        <p>Food, spaces, service and social-ready product frames for hospitality teams.</p>
      </header>
      {hasInternalReview ? <aside className="preview-note">Internal review assets / The Drive approval record does not confirm public clearance, final credits or identifiable-person permissions.</aside> : null}
      <section className="work-index" aria-label="Food and hospitality case studies">
        <div className="section-heading">
          <h2>{projects.length ? `${projects.length} selected ${projects.length === 1 ? "project" : "projects"}.` : "No projects published yet."}</h2>
          <p>{projects.length ? "Each set is intentionally compact." : "Food and hospitality projects will appear here once they are cleared for publication."}</p>
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
