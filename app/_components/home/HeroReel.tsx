"use client";

import Image from "next/image";
import { useEffect } from "react";
import type { ShortFilm } from "../../_data/shorts";

export type HeroReelProps = {
  photo: { src: string; alt: string; position?: string };
  label: string;
  what: string;
  films: ShortFilm[];
};

export function HeroReel({ photo, label, what, films }: HeroReelProps) {
  useEffect(() => {
    const box = document.getElementById("hero-ph");
    if (!box) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frames = Array.from(box.querySelectorAll<HTMLElement>(".hf"));
    const indexButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".hx button"));
    const openButton = box.querySelector<HTMLButtonElement>(".ph-open");
    const pauseButton = box.querySelector<HTMLButtonElement>(".ph-pause");
    if (frames.length === 0 || indexButtons.length !== frames.length || !openButton || !pauseButton) return;

    const STILL = 5000, STALL = 7000, FADE = 950;
    let cur = 0, playing = !reduce, inView = true, held = false, started = false;
    let elapsed = 0, last: number | null = null, prevTimer = 0, startTimer = 0, raf = 0;

    const filmFor = (frame: HTMLElement) => films.find((film) => film.slug === frame.dataset.slug);
    const running = () => playing && inView && !held && !document.hidden;

    const vid = (i: number): HTMLVideoElement | null => {
      const frame = frames[i];
      if (!frame || !frame.dataset.slug || (reduce && !playing)) return null;
      let video = frame.querySelector<HTMLVideoElement>("video");
      if (!video) {
        const film = filmFor(frame);
        if (!film) return null;
        const created = document.createElement("video");
        created.muted = true; created.playsInline = true; created.preload = "auto";
        created.setAttribute("muted", ""); created.setAttribute("playsinline", ""); created.setAttribute("aria-hidden", "true");
        created.src = film.preview;
        created.addEventListener("playing", () => created.classList.add("on"));
        created.addEventListener("ended", () => { if (frames[cur] === frame) next(); });
        frame.appendChild(created);
        video = created;
      }
      return video;
    };

    const sync = () => {
      const video = started ? vid(cur) : null;
      if (!video) return;
      if (running()) { const play = video.play(); if (play) play.catch(() => {}); } else video.pause();
    };

    function show(i: number) {
      if (i === cur) return;
      const prev = cur; cur = i; elapsed = 0;
      frames.forEach((frame, k) => {
        frame.classList.toggle("is-prev", k === prev);
        frame.classList.toggle("is-on", k === i);
        frame.setAttribute("aria-hidden", k === i ? "false" : "true");
      });
      window.clearTimeout(prevTimer);
      prevTimer = window.setTimeout(() => {
        frames[prev].classList.remove("is-prev");
        const prevVideo = frames[prev].querySelector("video");
        if (prevVideo) prevVideo.pause();
      }, FADE + 80);
      indexButtons.forEach((button, k) => {
        button.setAttribute("aria-pressed", k === i ? "true" : "false");
        button.style.setProperty("--p", !playing && k === i ? "1" : "0");
      });
      const video = vid(i);
      if (video) { try { video.currentTime = 0; } catch { /* not loaded yet */ } }
      vid((i + 1) % frames.length);
      const button = indexButtons[i];
      openButton.hidden = !button.dataset.n;
      if (button.dataset.n) {
        openButton.setAttribute("aria-label", `Play ${button.dataset.n}, ${button.dataset.t}, ${button.dataset.d}`);
        const duration = openButton.querySelector(".d");
        if (duration) duration.textContent = button.dataset.d ?? "";
      }
      sync();
    }
    const next = () => show((cur + 1) % frames.length);

    const tick = (t: number) => {
      if (last === null) last = t;
      const dt = Math.min(64, t - last); last = t;
      if (started && running()) {
        const video = frames[cur].querySelector("video");
        let progress: number;
        if (video && video.classList.contains("on") && video.duration && !video.paused) {
          progress = video.currentTime / video.duration;
        } else {
          elapsed += dt;
          const limit = frames[cur].dataset.slug ? STALL : STILL;
          progress = elapsed / limit;
          if (elapsed >= limit) { next(); progress = 0; }
        }
        indexButtons[cur].style.setProperty("--p", Math.min(1, progress).toFixed(4));
      }
      raf = requestAnimationFrame(tick);
    };

    const setPlaying = (on: boolean) => {
      playing = on;
      pauseButton.dataset.state = on ? "playing" : "paused";
      pauseButton.setAttribute("aria-label", on ? "Pause" : "Play");
      if (!on) indexButtons[cur].style.setProperty("--p", "1");
      sync();
    };

    const onPauseClick = () => setPlaying(!playing);
    const indexClicks = indexButtons.map((_, k) => () => { show(k); elapsed = 0; });
    const onOpenClick = () => {
      const film = filmFor(frames[cur]);
      if (!film) return;
      window.dispatchEvent(new CustomEvent("firstrec:play", { detail: { film, opener: openButton } }));
    };
    const onPlayer = (event: Event) => {
      held = (event as CustomEvent<{ open: boolean }>).detail.open;
      sync();
    };
    const onVisibility = () => sync();

    pauseButton.addEventListener("click", onPauseClick);
    indexButtons.forEach((button, k) => button.addEventListener("click", indexClicks[k]));
    openButton.addEventListener("click", onOpenClick);
    window.addEventListener("firstrec:player", onPlayer);
    document.addEventListener("visibilitychange", onVisibility);

    let observer: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(([entry]) => { inView = !!entry && entry.isIntersecting; sync(); }, { threshold: 0.15 });
      observer.observe(box);
    }
    if (reduce) setPlaying(false);
    startTimer = window.setTimeout(() => { started = true; sync(); }, reduce ? 0 : 1400);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(startTimer);
      window.clearTimeout(prevTimer);
      pauseButton.removeEventListener("click", onPauseClick);
      indexButtons.forEach((button, k) => button.removeEventListener("click", indexClicks[k]));
      openButton.removeEventListener("click", onOpenClick);
      window.removeEventListener("firstrec:player", onPlayer);
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
      for (const frame of frames) frame.querySelector("video")?.pause();
    };
  }, [films]);

  return (
    <>
      <div className="ph" id="hero-ph" role="region" aria-roledescription="carousel" aria-label="Photographs and vertical cuts">
        <figure className="hf is-on" data-kind="img">
          <Image
            alt={photo.alt}
            fill
            priority
            sizes="(max-width: 760px) 52vw, 36vw"
            src={photo.src}
            style={photo.position ? { objectPosition: photo.position } : undefined}
          />
        </figure>
        {films.map((film) => (
          <figure className="hf" data-slug={film.slug} aria-hidden="true" key={film.slug}>
            <Image alt={`${film.brand}, ${film.type}`} fill sizes="(max-width: 760px) 52vw, 36vw" src={film.poster} />
          </figure>
        ))}
        <button className="ph-open" hidden type="button">
          <span className="chip"><svg aria-hidden="true" viewBox="0 0 11 12"><path d="M0 0l11 6-11 6z" fill="currentColor" /></svg>Watch <span className="d"></span></span>
        </button>
        <button aria-label="Pause" className="ph-pause" data-state="playing" type="button">
          <svg aria-hidden="true" className="i-pause" viewBox="0 0 12 12"><rect fill="currentColor" height="10" width="3" x="1.5" y="1" /><rect fill="currentColor" height="10" width="3" x="7.5" y="1" /></svg>
          <svg aria-hidden="true" className="i-play" viewBox="0 0 12 12"><path d="M2 1l9 5-9 5z" fill="currentColor" /></svg>
        </button>
      </div>
      <div className="hx" role="group" aria-label="In the frame">
        <ol>
          <li>
            <button aria-pressed="true" type="button">
              <span className="n">1</span><span className="nm">{label}</span><span className="ft">Photograph</span><span className="wh">{what}</span>
              <span className="tr"><i></i></span>
            </button>
          </li>
          {films.map((film, index) => (
            <li key={film.slug}>
              <button aria-pressed="false" data-d={film.duration} data-n={film.brand} data-t={film.type} type="button">
                <span className="n">{index + 2}</span><span className="nm">{film.brand}</span><span className="ft">9:16</span><span className="wh">{film.type}</span>
                <span className="tr"><i></i></span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
