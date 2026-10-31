import Image from "next/image";

const navigation = [
  ["Work", "/work/"],
  ["Services", "/services/"],
  ["About", "/about/"],
  ["Equipment", "/equipment/"],
  ["Contact", "/contact/"],
];

export function SiteHeader() {
  return (
    <header className="site-header">
      {/* Plain anchors keep navigation reliable on generic NAS static hosts. */}
      <a className="wordmark" href="/" aria-label="First Rec. home"><Image src="/brand/first-rec/wordmark.svg" alt="First Rec." width={156} height={47} priority /></a>
      <nav className="desktop-nav" aria-label="Primary navigation">
        {navigation.map(([label, href]) => <a href={href} key={href}>{label}</a>)}
      </nav>
      <details className="mobile-menu">
        <summary>Menu</summary>
        <nav aria-label="Mobile navigation">
          {navigation.map(([label, href]) => <a href={href} key={href}>{label}</a>)}
        </nav>
      </details>
    </header>
  );
}
