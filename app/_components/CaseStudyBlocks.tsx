import Image from "next/image";
import { isListed } from "../_data/publication";
import { reviewNotice } from "../_data/review-notice";
import { caseStudies, type CaseStudy } from "../_data/site";

type CaseImage = { image: string; alt: string; ratio?: string };
// `src`/`type` is the primary source; `fallbacks` follow it in order, so list the
// most widely playable format (H.264 MP4) first.
export type CaseFilm = { src: string; poster: string; title: string; type?: string; fallbacks?: Array<{ src: string; type: string }> };

// Content blocks for modular case studies. Blocks that mirror core case fields
// (hero, full-width lead image, video, gallery) fall back to the case's own data.
export type CaseStudyBlock =
  | { type: "hero"; eyebrow?: string; title?: string; summary?: string }
  | { type: "intro"; label?: string; text: string }
  | { type: "facts"; label?: string; items: Array<{ label: string; value?: string }> }
  | { type: "gallery"; label?: string; images?: CaseImage[] }
  | { type: "video"; eyebrow?: string; heading?: string; note?: string; films?: CaseFilm[] }
  | { type: "fullImage"; image?: string; alt?: string; caption?: string; ratio?: string }
  | { type: "twoColumn"; columns: Array<{ label?: string; heading?: string; text: string }> }
  | { type: "deliverables"; heading?: string; items: string[] }
  | { type: "credits"; heading?: string; items: Array<{ role: string; name?: string }> }
  | { type: "bts"; heading?: string; text?: string; images?: CaseImage[] }
  | { type: "next"; slug: string; label?: string };

const placeholder = /^(tbc|tbd|n\/a|na|unknown|pending|-|\?)$/i;

// Unknown or placeholder values are never shown.
function known(value?: string): value is string {
  const text = value?.trim();
  return Boolean(text) && !placeholder.test(text!);
}

function filmsFor(project: CaseStudy) {
  return project.films ?? (project.film ? [project.film] : []);
}

export function FilmVideo({ film }: { film: CaseFilm }) {
  const sources = [{ src: film.src, type: film.type ?? "video/mp4" }, ...(film.fallbacks ?? [])];
  return (
    <video controls muted playsInline preload="metadata" poster={film.poster} aria-label={film.title}>
      {sources.map((source) => <source key={source.src} src={source.src} type={source.type} />)}
      Your browser does not support embedded video.
    </video>
  );
}

function HeroBlock({ block, project, number }: { block: Extract<CaseStudyBlock, { type: "hero" }>; project: CaseStudy; number: string }) {
  const summary = block.summary ?? project.summary;
  return (
    <header className="case-hero">
      <div><p className="eyebrow">{block.eyebrow ?? `${number} / ${project.category}`}</p><h1>{block.title ?? project.client}</h1></div>
      {known(summary) ? <p>{summary}</p> : null}
    </header>
  );
}

function FullImageBlock({ block, project, first }: { block: Extract<CaseStudyBlock, { type: "fullImage" }>; project: CaseStudy; first: boolean }) {
  const image = block.image ?? project.image;
  const alt = block.alt ?? project.alt;
  const caption = block.caption ?? (block.image ? undefined : reviewNotice(project));
  return (
    <figure className={`case-lead-image${block.ratio ? " case-lead-image--ratio" : ""}`} style={block.ratio ? { aspectRatio: block.ratio } : undefined}>
      <Image src={image} alt={alt} fill priority={first} sizes="100vw" style={{ objectFit: "contain", background: "var(--paper)" }} />
      {known(caption) ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

function IntroBlock({ block }: { block: Extract<CaseStudyBlock, { type: "intro" }> }) {
  if (!known(block.text)) return null;
  return (
    <section className="case-block-intro">
      {known(block.label) ? <h2>{block.label}</h2> : null}
      <p>{block.text}</p>
    </section>
  );
}

function FactsBlock({ block }: { block: Extract<CaseStudyBlock, { type: "facts" }> }) {
  const items = block.items.filter((item) => known(item.label) && known(item.value));
  if (!items.length) return null;
  return (
    <section className="case-facts" aria-label={block.label ?? "Project facts"}>
      {items.map((item) => <div key={item.label}><span>{item.label}</span><p>{item.value}</p></div>)}
    </section>
  );
}

// The label is the column's section heading; a column heading sits beneath it, or takes its level when there is no label.
function ColumnHeading({ labelled, children }: { labelled: boolean; children: string }) {
  return labelled ? <h3 className="case-block-columns-heading">{children}</h3> : <h2 className="case-block-columns-heading">{children}</h2>;
}

function TwoColumnBlock({ block }: { block: Extract<CaseStudyBlock, { type: "twoColumn" }> }) {
  const columns = block.columns.filter((column) => known(column.text));
  if (!columns.length) return null;
  return (
    <section className="case-block-columns">
      {columns.map((column, index) => (
        <article key={index}>
          {known(column.label) ? <h2 className="case-block-columns-label">{column.label}</h2> : null}
          {known(column.heading) ? <ColumnHeading labelled={known(column.label)}>{column.heading}</ColumnHeading> : null}
          <p className="case-block-columns-text">{column.text}</p>
        </article>
      ))}
    </section>
  );
}

function VideoBlock({ block, project, id }: { block: Extract<CaseStudyBlock, { type: "video" }>; project: CaseStudy; id: string }) {
  const films = block.films ?? filmsFor(project);
  if (!films.length) return null;
  const note = block.note ?? reviewNotice(project);
  return (
    <section className="case-film" aria-labelledby={id}>
      <div className="case-film-heading">
        <p className="eyebrow">{block.eyebrow ?? "Selected film"}</p>
        <h2 id={id}>{block.heading ?? "The project in motion."}</h2>
        {known(note) ? <p>{note}</p> : null}
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
  );
}

function GalleryBlock({ block, project }: { block: Extract<CaseStudyBlock, { type: "gallery" }>; project: CaseStudy }) {
  const images = block.images ?? project.gallery ?? [];
  if (!images.length) return null;
  return (
    <section className="case-gallery" aria-label={block.label ?? `${project.client} selected images`}>
      {images.map((asset) => (
        <figure key={asset.image} style={asset.ratio ? { aspectRatio: asset.ratio } : undefined}>
          <Image src={asset.image} alt={asset.alt} fill sizes="(max-width: 767px) 100vw, 60vw" style={{ objectFit: "contain", background: "var(--paper)" }} />
        </figure>
      ))}
    </section>
  );
}

function DeliverablesBlock({ block, id }: { block: Extract<CaseStudyBlock, { type: "deliverables" }>; id: string }) {
  const items = block.items.filter(known);
  if (!items.length) return null;
  return (
    <section className="case-block-list" aria-labelledby={id}>
      <h2 id={id}>{block.heading ?? "Deliverables"}</h2>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}

function CreditsBlock({ block, id }: { block: Extract<CaseStudyBlock, { type: "credits" }>; id: string }) {
  const items = block.items.filter((item) => known(item.role) && known(item.name));
  if (!items.length) return null;
  return (
    <section className="case-block-list" aria-labelledby={id}>
      <h2 id={id}>{block.heading ?? "Credits"}</h2>
      <dl>{items.map((item) => <div key={`${item.role}-${item.name}`}><dt>{item.role}</dt><dd>{item.name}</dd></div>)}</dl>
    </section>
  );
}

function BtsBlock({ block, id }: { block: Extract<CaseStudyBlock, { type: "bts" }>; id: string }) {
  const images = block.images ?? [];
  if (!known(block.text) && !images.length) return null;
  return (
    <section className="case-block-bts" aria-labelledby={id}>
      <div>
        <p className="eyebrow">Behind the scenes</p>
        <h2 id={id}>{block.heading ?? "On set."}</h2>
        {known(block.text) ? <p>{block.text}</p> : null}
      </div>
      {images.length ? (
        <div className="case-block-bts-images">
          {images.map((asset) => (
            <figure key={asset.image} style={{ aspectRatio: asset.ratio ?? "3 / 2" }}>
              <Image src={asset.image} alt={asset.alt} fill sizes="(max-width: 767px) 100vw, 45vw" style={{ objectFit: "contain", background: "var(--paper)" }} />
            </figure>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function NextBlock({ block }: { block: Extract<CaseStudyBlock, { type: "next" }> }) {
  // Only link to a case this build exports; an internal-review target has no page in a public build.
  const next = caseStudies.find((item) => item.slug === block.slug);
  if (!next || !isListed(next.slug)) return null;
  return (
    <nav className="case-block-next" aria-label="Next project">
      <p className="eyebrow">{block.label ?? "Next project"}</p>
      <a href={`/work/${next.slug}/`}><span>{next.client}</span><em>{next.category}</em></a>
    </nav>
  );
}

export function CaseStudyBlocks({ project, number, blocks }: { project: CaseStudy; number: string; blocks: CaseStudyBlock[] }) {
  const firstImage = blocks.findIndex((block) => block.type === "fullImage");
  return (
    <>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        const id = `${project.slug}-${key}`;
        switch (block.type) {
          case "hero": return <HeroBlock key={key} block={block} project={project} number={number} />;
          case "intro": return <IntroBlock key={key} block={block} />;
          case "facts": return <FactsBlock key={key} block={block} />;
          case "gallery": return <GalleryBlock key={key} block={block} project={project} />;
          case "video": return <VideoBlock key={key} block={block} project={project} id={id} />;
          case "fullImage": return <FullImageBlock key={key} block={block} project={project} first={index === firstImage} />;
          case "twoColumn": return <TwoColumnBlock key={key} block={block} />;
          case "deliverables": return <DeliverablesBlock key={key} block={block} id={id} />;
          case "credits": return <CreditsBlock key={key} block={block} id={id} />;
          case "bts": return <BtsBlock key={key} block={block} id={id} />;
          case "next": return <NextBlock key={key} block={block} />;
          default: return null;
        }
      })}
    </>
  );
}
