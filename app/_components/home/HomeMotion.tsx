"use client";

import { useEffect, useRef } from "react";

type Box = { left: number; right: number; top: number; bottom: number };

export function HomeMotion() {
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".home");
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const sub = root.querySelector<HTMLElement>(".contact-band-sub");
    const row = root.querySelector<HTMLElement>(".contact-band-row");
    if (sub) { sub.setAttribute("data-rise", ""); sub.style.setProperty("--wd", ".1s"); }
    if (row) { row.setAttribute("data-rise", ""); row.style.setProperty("--wd", ".2s"); }
    root.querySelectorAll<HTMLElement>(".contact-band-line").forEach((line, index) => {
      line.setAttribute("data-conv", index === 0 ? "-12" : "12");
    });

    const knocks = Array.from(root.querySelectorAll<HTMLElement>("[data-knock]"));
    const revealsAt = new Map<HTMLElement, number>();
    const shown = (photo: HTMLElement): Box => {
      const rect = photo.getBoundingClientRect();
      const progress = revealsAt.get(photo) ?? 1;
      const direction = photo.dataset.reveal;
      if (progress >= 1 || !direction) return rect;
      const w = rect.width * progress, h = rect.height * progress;
      if (direction === "up") return { left: rect.left, right: rect.right, top: rect.bottom - h, bottom: rect.bottom };
      if (direction === "left") return { left: rect.left, right: rect.left + w, top: rect.top, bottom: rect.bottom };
      if (direction === "right") return { left: rect.right - w, right: rect.right, top: rect.top, bottom: rect.bottom };
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.top + h };
    };
    const fit = () => {
      const vh = window.innerHeight;
      for (const element of knocks) {
        const photo = element.dataset.knock ? document.getElementById(element.dataset.knock) : null;
        if (!photo) continue;
        const word = element.getBoundingClientRect();
        if (word.bottom < -200 || word.top > vh + 200) continue;
        const box = shown(photo);
        const t = Math.max(0, box.top - word.top), l = Math.max(0, box.left - word.left);
        const r = Math.max(0, word.right - box.right), b = Math.max(0, word.bottom - box.bottom);
        const none = box.top >= word.bottom || box.bottom <= word.top || box.left >= word.right || box.right <= word.left || box.right - box.left < 1 || box.bottom - box.top < 1;
        element.style.setProperty("--k-clip", none ? "inset(0 100% 0 0)" : `inset(${t}px ${r}px ${b}px ${l}px)`);
      }
    };

    let disposed = false;
    let raf = 0;
    const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
    const smooth = (t: number) => t * t * (3 - 2 * t);
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    const clipFor = (direction: string, progress: number) => {
      const hidden = ((1 - progress) * 100).toFixed(2);
      return direction === "up" ? `inset(${hidden}% 0 0 0)` : direction === "left" ? `inset(0 ${hidden}% 0 0)` : direction === "right" ? `inset(0 0 0 ${hidden}%)` : `inset(0 0 ${hidden}% 0)`;
    };
    const along = (element: Element, vh: number) => {
      const rect = element.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > vh) return null;
      return clamp((vh - rect.top) / (vh + rect.height));
    };

    const reveals = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    const enters = Array.from(root.querySelectorAll<HTMLElement>("[data-wipe], [data-rise]"));
    const drifts = Array.from(root.querySelectorAll<HTMLElement>("[data-drift]")).map((element) => {
      const [a, b] = (element.dataset.drift ?? "0,0").split(",").map(Number);
      return { element, a, b, box: element.closest(".spread, .mini, .reels") ?? element, knock: element.hasAttribute("data-knock") };
    });
    const pars = Array.from(root.querySelectorAll<HTMLElement>("[data-par]")).map((element) => ({ element, k: Number(element.dataset.par), box: element.parentElement ?? element }));
    const heroElement = root.querySelector<HTMLElement>(".home-hero");
    const heroLines = heroElement ? Array.from(heroElement.querySelectorAll<HTMLElement>("h1 .l")) : [];
    const heroAmp = [-7, 5, -3];
    const reels = root.querySelector<HTMLElement>(".reels");
    const reelItems = reels ? Array.from(reels.querySelectorAll<HTMLElement>(".reel-row li")) : [];
    const contact = root.querySelector<HTMLElement>(".contact-band");
    const converging = contact ? Array.from(contact.querySelectorAll<HTMLElement>("[data-conv]")) : [];
    const count = root.querySelector<HTMLElement>("[data-count]");

    let dirty = true;
    const touch = () => { dirty = true; };
    window.addEventListener("scroll", touch, { passive: true });
    window.addEventListener("resize", touch);
    window.addEventListener("load", touch);
    if (document.fonts) document.fonts.ready.then(touch);
    let resizeObserver: ResizeObserver | null = null;
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(touch);
      resizeObserver.observe(document.body);
    }

    if (reduce) {
      enters.forEach((element) => element.classList.add("in"));
      const still = () => {
        if (disposed) return;
        if (dirty) { fit(); dirty = false; }
        raf = requestAnimationFrame(still);
      };
      raf = requestAnimationFrame(still);
    } else {
      reveals.forEach((element) => { revealsAt.set(element, 0); element.style.clipPath = clipFor(element.dataset.reveal ?? "down", 0); });
      if (count) count.textContent = "0";
      const starts = new Map<HTMLElement, number>();
      const countUp = () => {
        if (!count) return;
        const to = Number(count.dataset.count);
        const begin = performance.now() + 250;
        const step = (now: number) => {
          if (disposed) return;
          const k = easeOutExpo(clamp((now - begin) / 1600));
          count.textContent = String(Math.round(to * k));
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      };
      let pending: HTMLElement[] = reveals.concat(enters, count ? [count] : []);
      const arrive = (vh: number) => {
        const now = performance.now();
        pending = pending.filter((element) => {
          const rect = element.getBoundingClientRect();
          if (rect.top > vh * 0.9 || rect.bottom < 0) return true;
          if (element === count) countUp();
          else if (element.dataset.reveal) starts.set(element, now + (Number(element.dataset.delay) || 0) * 1000);
          else element.classList.add("in");
          return false;
        });
      };
      const shift = (element: HTMLElement, vw: number, knock: boolean) => {
        if (knock) element.style.marginLeft = vw ? `${vw.toFixed(3)}vw` : "";
        else element.style.transform = vw ? `translateX(${vw.toFixed(3)}vw)` : "";
      };
      const scrollFx = () => {
        const vh = window.innerHeight;
        if (heroElement) {
          const hp = clamp(window.scrollY / heroElement.offsetHeight);
          heroLines.forEach((line, index) => shift(line, heroAmp[index] * hp, true));
        }
        for (const drift of drifts) {
          const p = along(drift.box, vh);
          if (p !== null) shift(drift.element, drift.a + (drift.b - drift.a) * p, drift.knock);
        }
        for (const par of pars) {
          const p = along(par.box, vh);
          if (p !== null) par.element.style.transform = `translateY(${((p - 0.5) * par.k).toFixed(2)}%) scale(1.14)`;
        }
        if (reels) {
          const rp = smooth(clamp((vh - reels.getBoundingClientRect().top) / (vh * 0.75)));
          reelItems.forEach((item, index) => { item.style.transform = rp < 1 ? `translateY(${((1 - rp) * (index % 2 ? 22 : 14)).toFixed(2)}vw)` : ""; });
        }
        if (contact) {
          const cp = smooth(clamp((vh - contact.getBoundingClientRect().top) / (vh * 0.7)));
          contact.style.clipPath = cp < 1 ? `inset(${((1 - cp) * 100).toFixed(2)}% 0 0 0)` : "";
          converging.forEach((line) => { line.style.transform = cp < 1 ? `translateX(${(Number(line.dataset.conv) * (1 - cp)).toFixed(3)}vw)` : ""; });
        }
      };
      const loop = (now: number) => {
        if (disposed) return;
        let busy = false;
        for (const element of reveals) {
          const start = starts.get(element);
          const progress = revealsAt.get(element) ?? 0;
          if (start === undefined || progress >= 1) continue;
          const r = now < start ? 0 : easeOutExpo(clamp((now - start) / 1200));
          revealsAt.set(element, r);
          element.style.clipPath = r >= 1 ? "" : clipFor(element.dataset.reveal ?? "down", r);
          busy = true;
        }
        if (dirty && pending.length) arrive(window.innerHeight);
        if (busy || dirty) { scrollFx(); fit(); dirty = false; }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    const dot = dotRef.current;
    const finePointer = !reduce && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let followRaf = 0;
    let moving = false;
    let x = -200, y = -200, targetX = -200, targetY = -200;
    const follow = () => {
      x += (targetX - x) * 0.22;
      y += (targetY - y) * 0.22;
      if (dot) dot.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      moving = Math.abs(targetX - x) > 0.3 || Math.abs(targetY - y) > 0.3;
      if (moving) followRaf = requestAnimationFrame(follow);
    };
    const onPointerMove = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
      if (x < -100) { x = targetX; y = targetY; }
      if (!moving) { moving = true; followRaf = requestAnimationFrame(follow); }
    };
    const onPointerOver = (event: PointerEvent) => {
      if (!dot) return;
      const target = event.target instanceof Element ? event.target : null;
      const player = document.querySelector(".film-player");
      const on = !!target?.closest(".reel-btn") && !(player && player.classList.contains("open"));
      dot.classList.toggle("on", on);
    };
    const onDocumentClick = () => { if (dot) dot.classList.remove("on"); };
    if (dot && finePointer) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.addEventListener("pointerover", onPointerOver);
      document.addEventListener("click", onDocumentClick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (followRaf) cancelAnimationFrame(followRaf);
      window.removeEventListener("scroll", touch);
      window.removeEventListener("resize", touch);
      window.removeEventListener("load", touch);
      resizeObserver?.disconnect();
      if (dot) {
        window.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerover", onPointerOver);
        document.removeEventListener("click", onDocumentClick);
      }
    };
  }, []);

  return <div aria-hidden="true" className="cur" ref={dotRef}><span>Play</span></div>;
}
