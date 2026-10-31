import Image from "next/image";
import { CaseStudyBlocks, FilmVideo } from "./CaseStudyBlocks";
import { ContactBand } from "./ContactBand";
import { PageShell } from "./PageShell";
import { reviewNotice, withoutReviewNotes } from "../_data/review-notice";
import type { CaseStudy } from "../_data/site";

export function CaseStudyPage({ project, number }: { project: CaseStudy; number: string }) {
  if (project.blocks?.length) {
    return (
      <PageShell>
        <CaseStudyBlocks project={project} number={number} blocks={project.blocks} />
        <nav className="case-back" aria-label="Work navigation"><a className="text-link" href="/work/">Back to all work</a></nav>
        <ContactBand />
      </PageShell>
    );
  }

  const films = project.films ?? (project.film ? [project.film] : []);
  const notice = reviewNotice(project);

  return (
    <PageShell>
      <header className="case-hero">
        <div><p className="eyebrow">{number} / {project.category}</p><h1>{project.client}</h1></div>
        <p>{project.summary}</p>
      </header>
      <figure className="case-lead-image">
        <Image src={project.image} alt={project.alt} fill priority sizes="100vw" style={{ objectFit: "contain", background: "var(--paper)" }} />
        {notice ? <figcaption>{notice}</figcaption> : null}
      </figure>
      <section className="case-facts" aria-label="Project facts">
        <div><span>Channels</span><p>{project.channels}</p></div>
        <div><span>First Rec. role</span><p>{withoutReviewNotes(project.role)}</p></div>
        {project.mediaPartner ? <div><span>Agency partner</span><p>{project.mediaPartner}</p></div> : null}
        {project.date ? <div><span>Date</span><p>{project.date}</p></div> : null}
      </section>
      <section className="case-story">
        <article><h2>01 / Context</h2><p>{project.challenge}</p></article>
        <article><h2>02 / Response</h2><p>{project.response}</p></article>
        <article><h2>03 / Value</h2><p>{project.outcome}</p></article>
      </section>
      {films.length ? (
        <section className="case-film" aria-labelledby={`${project.slug}-film-heading`}>
          <div className="case-film-heading">
            <p className="eyebrow">Selected film</p>
            <h2 id={`${project.slug}-film-heading`}>The project in motion.</h2>
            {notice ? <p>{notice}</p> : null}
          </div>
          <div className={`case-film-list${films.length > 1 ? " case-film-list--multiple" : ""}`}>
            {films.map((film, index) => (
              <figure className="case-film-item" key={film.src}>
                {films.length > 1 ? <figcaption><span>{String(index + 1).padStart(2, "0")} / Film</span><strong>{film.title}</strong></figcaption> : null}
                <FilmVideo film={film} />
              </figure>
            ))}
          </div>
        </section>
      ) : null}
      {project.gallery?.length ? (
        <section className="case-gallery" aria-label={`${project.client} selected images`}>
          {project.gallery.map((asset) => (
            <figure key={asset.image} style={asset.ratio ? { aspectRatio: asset.ratio } : undefined}>
              <Image src={asset.image} alt={asset.alt} fill sizes="(max-width: 767px) 100vw, 60vw" style={{ objectFit: "contain", background: "var(--paper)" }} />
            </figure>
          ))}
        </section>
      ) : null}
      <nav className="case-back" aria-label="Work navigation"><a className="text-link" href="/work/">Back to all work</a></nav>
      <ContactBand />
    </PageShell>
  );
}
