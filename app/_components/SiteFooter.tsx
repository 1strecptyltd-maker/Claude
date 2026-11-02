import Image from "next/image";
import { navigation } from "../_data/navigation";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      {/* Plain anchors keep navigation reliable on generic NAS static hosts. */}
      <a className="wordmark" href="/" aria-label="First Rec. home"><Image src="/brand/first-rec/wordmark-light.svg" alt="First Rec." width={156} height={47} /></a>
      <p className="site-footer-about"><strong>First Rec.</strong> is a bilingual production studio in Sydney, working Australia-wide.</p>
      <nav className="site-footer-nav" aria-label="Footer navigation">{navigation.map(([label, href]) => <a href={href} key={href}>{label}</a>)}</nav>
      <p className="site-footer-legal">© {new Date().getFullYear()} First Rec. Sydney, Australia.</p>
    </footer>
  );
}
