import { SiteFooter } from "./SiteFooter";
import { SiteHeader, type NavHref } from "./SiteHeader";

export function PageShell({ children, current }: Readonly<{ children: React.ReactNode; current?: NavHref }>) {
  return <main><SiteHeader current={current} />{children}<SiteFooter /></main>;
}
