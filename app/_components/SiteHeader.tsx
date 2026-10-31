import Image from "next/image";
import { navigation, type NavHref } from "../_data/navigation";
import { MobileMenu } from "./MobileMenu";

export function SiteHeader({ current }: { current?: NavHref }) {
  return (
    <header className="site-header">
      {/* Plain anchors keep navigation reliable on generic NAS static hosts. */}
      <a className="wordmark" href="/" aria-label="First Rec. home"><Image src="/brand/first-rec/wordmark.svg" alt="First Rec." width={156} height={47} priority /></a>
      <nav className="desktop-nav" aria-label="Primary navigation">
        {navigation.map(([label, href]) => <a href={href} key={href} aria-current={href === current ? "page" : undefined}>{label}</a>)}
      </nav>
      <MobileMenu current={current} />
    </header>
  );
}
