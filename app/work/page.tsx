import type { Metadata } from "next";
import Image from "next/image";
import { ContactBand } from "../_components/ContactBand";
import { PageShell } from "../_components/PageShell";
import { caseStudies } from "../_data/site";

export const metadata: Metadata = { title: "Work | First Rec.", description: "Selected visual production relationships across brands, hospitality and live events." };
export const dynamic = "force-static";

const workGroups = [
  {
    id: "film-production",
    label: "Film + production",
    description: "Launches, openings and ongoing visual production relationships shaped for moving image and live moments.",
  },
  {
    id: "photography",
    label: "Photography",
    description: "Brand, editorial and lifestyle image studies selected for how they hold a frame, a product or a person.",
  },
  {
    id: "food-menu",
    label: "Food + menu",
    description: "Food and hospitality imagery built around appetite, context and the practical needs of a menu.",
  },
  {
    id: "food-hospitality",
    label: "Food + hospitality",
    description: "Newly ingested Drive selections across food, service, spaces and social-ready product imagery.",
  },
] as const;

export default function WorkPage() {
  return (
    <PageShell>
      <header className="page-hero page-hero--work">
        <p className="eyebrow">Selected work</p>
        <h1>Built for the moment.<br />Useful after it.</h1>
        <p>Photography, short-form film and production support shaped around how each team needs to use the work.</p>
      </header>
      <aside className="preview-note">Geely, Molly Tea, Eimele, Bentley, Chongguang Workshop, Hatman, MalayMalay, Mirror &amp; Moon, Stasis and EMP Dairy / Lactoferrin media is included for internal review only. Publication clearance is pending.</aside>
      <p className="work-archive-link"><a className="text-link" href="/work/food-hospitality/">Open the local Food + hospitality selection</a></p>
      <nav className="work-category-nav" aria-label="Work categories">
        {workGroups.map((group, index) => {
          const count = caseStudies.filter((project) => project.discipline === group.label).length;
          return <a href={`#${group.id}`} key={group.id}><span>{String(index + 1).padStart(2, "0")} / {group.label}</span><em>{String(count).padStart(2, "0")}</em></a>;
        })}
      </nav>
      <section className="work-index" aria-label="Case studies">
        {workGroups.map((group, groupIndex) => {
          const projects = caseStudies.filter((project) => project.discipline === group.label);
          return (
            <section className="work-category" id={group.id} aria-labelledby={`${group.id}-heading`} key={group.id}>
              <header className="work-category-heading">
                <div><p className="eyebrow">{String(groupIndex + 1).padStart(2, "0")} / Category</p><h2 id={`${group.id}-heading`}>{group.label}</h2></div>
                <p>{group.description}</p>
              </header>
              <div className="work-category-list">
                {projects.map((project) => {
                  const index = caseStudies.findIndex((item) => item.slug === project.slug) + 1;
                  return (
                    <article className={`work-entry work-entry--${index}`} key={project.slug}>
                      <a className="work-entry-image" href={`/work/${project.slug}/`}>
                        <Image src={project.image} alt={project.alt} fill sizes="(max-width: 767px) 100vw, 72vw" />
                      </a>
                      <div className="work-entry-copy">
                        <p className="case-category">{project.category}</p>
                        <h3><a href={`/work/${project.slug}/`}>{project.client}</a></h3>
                        <p>{project.summary}</p>
                        <p className="case-scope">{project.scope}</p>
                        <a className="text-link" href={`/work/${project.slug}/`}>View project</a>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </section>
      <ContactBand />
    </PageShell>
  );
}
