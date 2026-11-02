import type { Metadata } from "next";
import Image from "next/image";
import { ContactBand } from "../_components/ContactBand";
import { PageShell } from "../_components/PageShell";

export const metadata: Metadata = { title: "About | First Rec.", description: "Meet Cheese, the founder of First Rec., a Sydney-based visual production studio." };
export const dynamic = "force-static";

export default function AboutPage() {
  return (
    <PageShell current="/about/">
      <header className="about-hero">
        <div className="about-mark" aria-hidden="true"><Image src="/brand/first-rec/icon.svg" alt="" width={400} height={400} /></div>
        <div>
          <p className="eyebrow">About First Rec.</p>
          <h1>Experienced enough to plan.<br />Flexible enough to adapt.</h1>
          <p>First Rec. is an independent visual production studio founded by Cheese, based in Sydney and available across Australia.</p>
        </div>
      </header>
      <section className="about-story">
        <p className="story-lead">First Rec. was founded by Cheese.</p>
        <div>
          <p>Cheese is the founder behind the studio: a direct, human point of contact from the first brief through to delivery.</p>
          <p>More than five years of production experience helps First Rec. identify what matters, adapt when the brief changes and control costs without losing sight of the final work.</p>
          <p>Some projects need one experienced person across camera and post. Others need coordination, photographers, cinematographers and a wider crew. The team changes, but the responsibility stays clear.</p>
        </div>
      </section>
      <section className="about-facts" aria-label="Studio facts">
        <article><span>Based in</span><h2>Sydney</h2><p>Available for productions across Australia.</p></article>
        <article><span>Working in</span><h2>English&nbsp;+ Mandarin</h2><p>Bilingual communication across planning and production.</p></article>
        <article><span>Founder</span><h2>Cheese</h2><p>One clear point of contact across planning and production.</p></article>
      </section>
      <ContactBand />
    </PageShell>
  );
}
