import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import type { NavHref } from "../_data/navigation";

export function PageShell({ children, current }: Readonly<{ children: React.ReactNode; current?: NavHref }>) {
  return <main><SiteHeader current={current} />{children}<SiteFooter /></main>;
}
