import type { Metadata } from "next";
import "@fontsource-variable/newsreader/wght.css";
import "@fontsource-variable/newsreader/wght-italic.css";
import "@fontsource-variable/nunito-sans/wght.css";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "First Rec. | Film, Photography & Content Production",
  description: "First Rec. is a Sydney-based film, photography and content production studio founded by Cheese.",
  icons: { icon: "/brand/first-rec/icon.svg" },
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "First Rec. | Film, Photography & Content Production",
    description: "Film, photography and content production for brands, hospitality and creative teams.",
    type: "website",
    images: [{ url: "/og-first-rec.png", width: 1920, height: 1080, alt: "First Rec. visual production studio" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "First Rec. | Film, Photography & Content Production",
    description: "Film, photography and content production for brands, hospitality and creative teams.",
    images: ["/og-first-rec.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
