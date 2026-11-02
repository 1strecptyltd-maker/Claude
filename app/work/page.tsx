import type { Metadata } from "next";
import { ContactBand } from "../_components/ContactBand";
import { PageShell } from "../_components/PageShell";
import { FilmPlayer } from "../_components/home/FilmPlayer";
import { ShortFilmRow } from "../_components/home/ShortFilmRow";
import { includeInternal, listedCaseStudies } from "../_data/publication";
import { shortFilms } from "../_data/shorts";
import { WorkSets, type WorkSetItem } from "./WorkSets";
import "./work-sets.css";
import "./work-shorts.css";

export const metadata: Metadata = { title: "Work | First Rec.", description: "Selected visual production relationships across brands, hospitality and live events." };
export const dynamic = "force-static";

const caseStudies = listedCaseStudies();
const hasFoodCollection = caseStudies.some((project) => project.discipline === "Food + hospitality");

const toWorkItem = (project: (typeof caseStudies)[number]): WorkSetItem => {
  const work = project.work;
  return {
    slug: project.slug,
    name: work?.name ?? project.home?.name ?? project.client,
    what: work?.what ?? project.home?.what ?? project.category,
    deliverables: work?.deliverables ?? project.home?.deliverables ?? project.scope,
    formats: work?.formats ?? [],
    film: work?.film,
    interviews: work?.interviews ?? [],
    verticals: work?.verticals ?? [],
    photos: work?.photos ?? [{ src: project.image, alt: project.alt }],
  };
};

const sets: WorkSetItem[] = [];
const cards: WorkSetItem[] = [];
for (const project of caseStudies) {
  const item = toWorkItem(project);
  (project.work?.featured ? sets : cards).push(item);
}

const counts = {
  all: caseStudies.length,
  film: caseStudies.filter((project) => project.work?.formats.includes("film")).length,
  vertical: caseStudies.filter((project) => project.work?.formats.includes("vertical")).length,
  interviews: caseStudies.filter((project) => project.work?.formats.includes("interviews")).length,
  photography: caseStudies.filter((project) => project.work?.formats.includes("photography")).length,
};

const verticalSlugs = new Set(caseStudies.flatMap((project) => project.work?.verticals ?? []));
const films = shortFilms.filter((film) => verticalSlugs.has(film.slug));

export default function WorkPage() {
  return (
    <PageShell current="/work/">
      <script dangerouslySetInnerHTML={{ __html: "if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('js')" }} />
      {includeInternal ? <aside className="preview-note">Geely, Molly Tea, Eimele, Bentley, Chongguang Workshop, Hatman, MalayMalay, Mirror &amp; Moon, Stasis and EMP Dairy / Lactoferrin media is included for internal review only. Publication clearance is pending.</aside> : null}
      <WorkSets sets={sets} cards={cards} counts={counts} films={films} foodLink={hasFoodCollection} />
      <section className="work-shorts" id="short-form" aria-labelledby="work-shorts-heading">
        <h2 id="work-shorts-heading">Short-form</h2>
        <p>Vertical films for social, from brand events and creator collaborations.</p>
        <ShortFilmRow films={shortFilms} className="reel-row--grid" />
      </section>
      <FilmPlayer />
      <ContactBand />
    </PageShell>
  );
}
