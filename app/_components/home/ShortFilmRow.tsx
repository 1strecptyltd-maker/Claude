"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import type { ShortFilm } from "../../_data/shorts";
import "./short-films.css";

export type ShortFilmRowProps = { films: ShortFilm[]; className?: string };

export function ShortFilmRow({ films, className }: ShortFilmRowProps) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const button = entry.target as HTMLButtonElement;
        const media = button.querySelector<HTMLElement>(".reel-media");
        if (!media) continue;
        let video = media.querySelector<HTMLVideoElement>("video");
        if (entry.isIntersecting) {
          if (!video) {
            const film = films.find((item) => item.slug === button.dataset.slug);
            if (!film) continue;
            const preview = document.createElement("video");
            preview.muted = true; preview.loop = true; preview.playsInline = true; preview.preload = "auto";
            preview.setAttribute("muted", ""); preview.setAttribute("playsinline", ""); preview.setAttribute("aria-hidden", "true");
            preview.src = film.preview;
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
    for (const button of list.querySelectorAll(".reel-btn")) observer.observe(button);
    return () => observer.disconnect();
  }, [films]);

  return (
    <ul className={className ? `reel-row ${className}` : "reel-row"} ref={listRef}>
      {films.map((film) => (
        <li key={film.slug}>
          <button
            className="reel-btn"
            type="button"
            data-slug={film.slug}
            aria-label={`Play ${film.brand}, ${film.type.toLowerCase()}, ${film.duration}`}
            onClick={(event) => {
              window.dispatchEvent(new CustomEvent("firstrec:play", { detail: { film, opener: event.currentTarget } }));
            }}
          >
            <span className="reel-media"><Image alt="" fill sizes="(max-width: 760px) 60vw, 14vw" src={film.poster} /></span>
            <span className="reel-cap"><span className="n">{film.brand}</span><span className="d">{film.duration}</span><span className="t">{film.type}</span></span>
          </button>
        </li>
      ))}
    </ul>
  );
}
