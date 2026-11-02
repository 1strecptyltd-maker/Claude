"use client";

import { useEffect, useRef } from "react";
import type { ShortFilm } from "../../_data/shorts";

type PlayDetail = { film: ShortFilm; opener: HTMLElement; wide?: boolean };

export function FilmPlayer() {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const closeButton = closeRef.current;
    if (!root || !closeButton) return;
    const box = root.querySelector<HTMLElement>(".film-player-box");
    if (!box) return;
    const video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.preload = "none";
    video.setAttribute("playsinline", "");
    box.prepend(video);
    let opener: HTMLElement | null = null;

    const open = (film: ShortFilm, button: HTMLElement, wide?: boolean) => {
      opener = button;
      const name = root.querySelector(".film-player-cap .n");
      const type = root.querySelector(".film-player-cap .t");
      const duration = root.querySelector(".film-player-cap .d");
      if (name) name.textContent = film.brand;
      if (type) type.textContent = film.type;
      if (duration) duration.textContent = film.duration;
      video.poster = film.poster;
      video.src = film.full;
      root.classList.add("open");
      root.classList.toggle("film-player--wide", Boolean(wide));
      document.body.style.overflow = "hidden";
      window.dispatchEvent(new CustomEvent("firstrec:player", { detail: { open: true } }));
      const play = video.play();
      if (play) play.catch(() => {});
      closeButton.focus();
    };

    const close = () => {
      if (!root.classList.contains("open")) return;
      root.classList.remove("open");
      root.classList.remove("film-player--wide");
      document.body.style.overflow = "";
      video.pause();
      video.removeAttribute("src");
      video.load();
      window.dispatchEvent(new CustomEvent("firstrec:player", { detail: { open: false } }));
      if (opener) opener.focus();
    };

    const onPlay = (event: Event) => {
      const detail = (event as CustomEvent<PlayDetail>).detail;
      if (detail && detail.film) open(detail.film, detail.opener, detail.wide);
    };
    const onBackdropClick = (event: MouseEvent) => { if (event.target === root) close(); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };

    window.addEventListener("firstrec:play", onPlay);
    root.addEventListener("click", onBackdropClick);
    closeButton.addEventListener("click", close);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("firstrec:play", onPlay);
      root.removeEventListener("click", onBackdropClick);
      closeButton.removeEventListener("click", close);
      window.removeEventListener("keydown", onKeyDown);
      if (root.classList.contains("open")) document.body.style.overflow = "";
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.remove();
    };
  }, []);

  return (
    <div className="film-player" role="dialog" aria-modal="true" aria-label="Video player" ref={rootRef}>
      <div className="film-player-box">
        <p className="film-player-cap"><span className="n"></span><span className="t"></span><span className="d"></span></p>
      </div>
      <button className="film-player-close" type="button" ref={closeRef}>Close</button>
    </div>
  );
}
