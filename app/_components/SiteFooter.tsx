import Image from "next/image";

export function SiteFooter() {
  return (
    <footer>
      {/* Plain anchors keep navigation reliable on generic NAS static hosts. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className="wordmark" href="/" aria-label="First Rec. home"><Image src="/brand/first-rec/wordmark.svg" alt="First Rec." width={156} height={47} /></a>
      <p>Sydney / Australia-wide</p>
      <p>© {new Date().getFullYear()} First Rec.</p>
    </footer>
  );
}
