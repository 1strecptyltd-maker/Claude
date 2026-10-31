"use client";

import { useEffect, useRef } from "react";
import { navigation, type NavHref } from "../_data/navigation";

export function MobileMenu({ current }: { current?: NavHref }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const details = detailsRef.current;
    if (!details) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") details.open = false;
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node && details.contains(target))) details.open = false;
    };
    const onLinkClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("a")) details.open = false;
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    details.addEventListener("click", onLinkClick);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      details.removeEventListener("click", onLinkClick);
    };
  }, []);

  return (
    <details className="mobile-menu" ref={detailsRef}>
      <summary><span className="menu-label-closed">Menu</span><span className="menu-label-open">Close</span></summary>
      <nav aria-label="Mobile navigation">
        {navigation.map(([label, href]) => <a href={href} key={href} aria-current={href === current ? "page" : undefined}>{label}</a>)}
      </nav>
    </details>
  );
}
