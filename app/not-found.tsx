import type { Metadata } from "next";
import { PageShell } from "./_components/PageShell";

export const metadata: Metadata = { title: "Page not found | First Rec.", robots: { index: false } };

export default function NotFound() {
  return (
    <PageShell>
      <header className="page-hero">
        <p className="eyebrow">404</p>
        <h1>Page not found.</h1>
        <p>Nothing lives at this address; the link may be mistyped, or the page may have moved.</p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <nav className="not-found-links" aria-label="Page not found navigation"><a className="text-link" href="/">Go to the homepage</a><a className="text-link" href="/work/">See all work</a></nav>
      </header>
    </PageShell>
  );
}
