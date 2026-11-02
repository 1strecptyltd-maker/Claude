"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import type { ShortFilm } from "../_data/shorts";
import type { WorkFilm, WorkFormat } from "../_data/site";

export type WorkSetItem = {
  slug: string;
  name: string;
  what: string;
  deliverables: string;
  formats: WorkFormat[];
  film?: WorkFilm;
  interviews: WorkFilm[];
  verticals: string[];
  photos: Array<{ src: string; alt: string }>;
};

export type WorkSetsProps = {
  sets: WorkSetItem[];
  cards: WorkSetItem[];
  counts: { all: number; film: number; vertical: number; interviews: number; photography: number };
  films: ShortFilm[];
  foodLink: boolean;
};

const FORMAT_LABELS: Record<WorkFormat, string> = {
  film: "Film 16:9",
  vertical: "Vertical 9:16",
  interviews: "Interviews",
  photography: "Photography",
};

const slipEntries = (item: WorkSetItem): Array<{ dt: string; dd: string }> => {
  const entries: Array<{ dt: string; dd: string }> = [];
  if (item.formats.includes("film") && item.film) entries.push({ dt: `Film 16:9 · ${item.film.duration}`, dd: "The main cut." });
  if (item.formats.includes("vertical")) entries.push({ dt: "Vertical 9:16", dd: item.verticals.length ? `${item.verticals.length} on this page.` : "Cut for social." });
  if (item.formats.includes("interviews")) entries.push({ dt: "Interviews", dd: item.interviews.length ? `${item.interviews.length} on this page.` : "Subtitled versions." });
  if (item.formats.includes("photography")) entries.push({ dt: "Photography", dd: `${item.photos.length} shown here.` });
  return entries;
};

const toPlayerFilm = (slug: string, name: string, film: WorkFilm): ShortFilm => ({
  slug,
  brand: name,
  type: film.title,
  duration: film.duration,
  poster: film.poster,
  preview: film.preview,
  full: film.src,
  home: false,
});

export function WorkSets({ sets, cards, counts, films, foodLink }: WorkSetsProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observers: IntersectionObserver[] = [];
    const listeners: Array<[EventTarget, string, EventListener]> = [];

    const keyButtons = [...root.querySelectorAll<HTMLButtonElement>(".work-key button")];
    const filterItems = [...root.querySelectorAll<HTMLElement>(".work-set, .work-card")];
    for (const button of keyButtons) {
      const listener = () => {
        const format = button.dataset.format ?? "";
        for (const other of keyButtons) other.setAttribute("aria-pressed", other === button ? "true" : "false");
        for (const item of filterItems) {
          const formats = (item.dataset.formats ?? "").split(" ");
          item.classList.toggle("is-off", format !== "" && !formats.includes(format));
        }
      };
      button.addEventListener("click", listener);
      listeners.push([button, "click", listener]);
    }

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
      const previewObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          const media = element.querySelector<HTMLElement>(".work-set-media");
          if (!media) continue;
          let video = media.querySelector<HTMLVideoElement>("video");
          if (entry.isIntersecting) {
            if (!video) {
              const preview = document.createElement("video");
              preview.muted = true;
              preview.loop = true;
              preview.playsInline = true;
              preview.preload = "auto";
              preview.setAttribute("muted", "");
              preview.setAttribute("playsinline", "");
              preview.setAttribute("aria-hidden", "true");
              preview.src = element.dataset.preview ?? "";
              preview.addEventListener("playing", () => preview.classList.add("on"));
              media.appendChild(preview);
              video = preview;
            }
            const play = video.play();
            if (play) play.catch(() => {});
          } else if (video) {
            video.pause();
          }
        }
      }, { threshold: 0.5 });
      for (const element of root.querySelectorAll<HTMLElement>(".work-set-film, .work-set-vertical")) previewObserver.observe(element);
      observers.push(previewObserver);
    }

    const setElements = [...root.querySelectorAll<HTMLElement>(".work-set")];
    if ("IntersectionObserver" in window) {
      const revealObserver = new IntersectionObserver((entries, observer) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      }, { threshold: 0.15 });
      for (const element of setElements) revealObserver.observe(element);
      observers.push(revealObserver);
    } else {
      for (const element of setElements) element.classList.add("in");
    }

    const playListener = (event: Event) => {
      const target = event.target as HTMLElement;
      const filmButton = target.closest<HTMLElement>(".work-set-film");
      const interviewButton = target.closest<HTMLElement>(".work-set-interview");
      const verticalButton = target.closest<HTMLElement>(".work-set-vertical");
      if (filmButton) {
        const slug = filmButton.closest<HTMLElement>(".work-set")?.dataset.case;
        const item = sets.find((set) => set.slug === slug);
        if (item?.film) {
          window.dispatchEvent(new CustomEvent("firstrec:play", { detail: { film: toPlayerFilm(item.slug, item.name, item.film), opener: filmButton, wide: true } }));
        }
        return;
      }
      if (interviewButton) {
        const section = interviewButton.closest<HTMLElement>(".work-set");
        const item = sets.find((set) => set.slug === section?.dataset.case);
        const index = section ? [...section.querySelectorAll(".work-set-interview")].indexOf(interviewButton) : -1;
        const interview = item?.interviews[index];
        if (item && interview) {
          window.dispatchEvent(new CustomEvent("firstrec:play", { detail: { film: toPlayerFilm(`${item.slug}-interview-${index + 1}`, item.name, interview), opener: interviewButton, wide: true } }));
        }
        return;
      }
      if (verticalButton) {
        const film = films.find((item) => item.slug === verticalButton.dataset.slug);
        if (film) window.dispatchEvent(new CustomEvent("firstrec:play", { detail: { film, opener: verticalButton } }));
      }
    };
    root.addEventListener("click", playListener);
    listeners.push([root, "click", playListener]);

    return () => {
      for (const observer of observers) observer.disconnect();
      for (const [target, type, listener] of listeners) target.removeEventListener(type, listener);
    };
  }, [sets, films]);

  return (
    <div className="work-room" ref={rootRef}>
      <header className="work-room-hero">
        <h1><span className="work-room-line"><span>What one shoot</span></span> <span className="work-room-line"><span>turns into.</span></span></h1>
        <p>Each production below is laid out as the client received it: the film, the vertical cuts, the interviews and the photographs. Choose a format to see who it was made for.</p>
        <div className="work-key" role="group" aria-label="Filter by format">
          <button type="button" data-format="" aria-pressed="true">Everything <em>{counts.all}</em></button>
          <button type="button" data-format="film" aria-pressed="false">Films <em>{counts.film}</em></button>
          <button type="button" data-format="vertical" aria-pressed="false">Vertical <em>{counts.vertical}</em></button>
          <button type="button" data-format="interviews" aria-pressed="false">Interviews <em>{counts.interviews}</em></button>
          <button type="button" data-format="photography" aria-pressed="false">Photography <em>{counts.photography}</em></button>
        </div>
      </header>
      {sets.map((item) => (
        <section className="work-set" id={`set-${item.slug}`} data-case={item.slug} data-formats={item.formats.join(" ")} aria-labelledby={`set-${item.slug}-name`} key={item.slug}>
          <header className="work-set-head">
            <h2 id={`set-${item.slug}-name`}><a href={`/work/${item.slug}/`}>{item.name}</a></h2>
            <p><strong>{item.what}</strong> {item.deliverables}</p>
          </header>
          <div className="work-set-grid">
            {item.film ? (
              <button className="work-set-film" type="button" data-preview={item.film.preview} aria-label={`Play ${item.film.title}, ${item.film.duration}`}>
                <span className="work-set-media"><Image src={item.film.poster} alt="" fill sizes="(max-width: 1000px) 100vw, 70vw" /></span>
                <span className="work-set-play">Play film <span>{item.film.duration}</span></span>
              </button>
            ) : null}
            <div className="work-set-aside">
              {item.verticals.length > 0 ? (
                <div className="work-set-verticals">
                  {item.verticals.map((slug) => {
                    const short = films.find((film) => film.slug === slug);
                    if (!short) return null;
                    return (
                      <button className="work-set-vertical" type="button" key={slug} data-slug={short.slug} data-preview={short.preview} aria-label={`Play ${short.brand}, ${short.type.toLowerCase()}, ${short.duration}`}>
                        <span className="work-set-media"><Image src={short.poster} alt="" fill sizes="(max-width: 1000px) 42vw, 14vw" /></span>
                        <span className="work-set-tag">9:16</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <dl className="work-set-slip">
                {slipEntries(item).map((entry) => (
                  <div key={entry.dt}>
                    <dt>{entry.dt}</dt>
                    <dd>{entry.dd}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {item.interviews.length > 0 ? (
              <div className="work-set-interviews">
                {item.interviews.map((interview) => (
                  <button className="work-set-interview" type="button" key={interview.src} aria-label={`Play ${interview.title}, ${interview.duration}`}>
                    <span className="work-set-media"><Image src={interview.poster} alt="" fill sizes="(max-width: 1000px) 50vw, 30vw" /></span>
                    <span className="work-set-tag">Interview · {interview.duration}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {item.photos.length > 0 ? (
              <ul className="work-set-photos">
                {item.photos.map((photo) => (
                  <li key={photo.src}>
                    <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 1000px) 50vw, 18vw" />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ))}
      <section className="work-more" aria-labelledby="work-more-heading">
        <h2 id="work-more-heading">Also on the slate</h2>
        <div className="work-cards">
          {cards.map((item) => (
            <a className="work-card" href={`/work/${item.slug}/`} data-case={item.slug} data-formats={item.formats.join(" ")} key={item.slug}>
              <span className="work-card-media"><Image src={item.photos[0].src} alt={item.photos[0].alt} fill sizes="(max-width: 1000px) 50vw, 20vw" /></span>
              <strong>{item.name}</strong>
              <span className="work-card-what">{item.what}</span>
              {item.formats.length > 0 ? <span className="work-card-formats">{item.formats.map((format) => FORMAT_LABELS[format]).join(" · ")}</span> : null}
            </a>
          ))}
        </div>
        {foodLink ? <p className="work-more-link"><a href="/work/food-hospitality/">Food and hospitality photography: see the full selection</a></p> : null}
      </section>
    </div>
  );
}
