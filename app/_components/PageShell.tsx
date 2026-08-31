import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function PageShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return <main><SiteHeader />{children}<SiteFooter /></main>;
}
