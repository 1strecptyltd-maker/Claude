import Image from "next/image";
import { ContactBand } from "./_components/ContactBand";
import { PageShell } from "./_components/PageShell";
import { getCaseStudy } from "./_data/project-access";
import { caseStudies, services } from "./_data/site";

export const dynamic = "force-static";

const heroProject = getCaseStudy("geely-australia");

export default function Home() {
  return (
    <PageShell>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Photography + short-form film</p>
          <h1 className="kinetic-heading">
            <span className="hero-line"><span>Visual production that</span></span>
            <span className="hero-line hero-line--offset"><span><em>moves</em> with the brief.</span></span>
          </h1>
          <p className="hero-intro">Photography and short-form film for brands, hospitality and creative teams. Built to adapt, deliver and stay within budget.</p>
          <a className="text-link" href="/work/">View selected work</a>
        </div>
        <figure className="hero-media">
          <div className="hero-image-frame">
            <Image src={heroProject.image} alt={heroProject.alt} fill priority sizes="(max-width: 767px) 100vw, 48vw" />
          </div>
          <figcaption>Internal review asset / Publication clearance pending</figcaption>
        </figure>
      </section>

      <section className="proof" aria-label="Studio credentials">
        <div><strong>5+ years</strong><span>Production experience</span></div>
        <div><strong>Sydney</strong><span>Australia-wide travel</span></div>
        <div><strong>English + Mandarin</strong><span>Bilingual production</span></div>
        <div><strong>Flexible crew</strong><span>Built around each brief</span></div>
      </section>

      <section className="home-work" aria-labelledby="featured-heading">
        <div className="section-heading">
          <h2 id="featured-heading">Selected relationships.</h2>
          <p>Different scales and formats, connected by practical production and a fast response to changing needs.</p>
        </div>
        <div className="featured-list">
          {caseStudies.map((project, index) => (
            <a className="featured-project home-reveal" href={`/work/${project.slug}/`} key={project.slug}>
              <span>{String(index + 1).padStart(2, "0")}</span><strong>{project.client}</strong><em>{project.category}</em><b>View project</b>
            </a>
          ))}
        </div>
      </section>

      <section className="home-services" aria-labelledby="home-services-heading">
        <div className="section-heading">
          <h2 id="home-services-heading">One partner, shaped around the job.</h2>
          <a className="text-link" href="/services/">Explore services</a>
        </div>
        <div className="service-columns">
          {services.map((service) => <article className="home-reveal" key={service.title}><h3>{service.title}</h3><p>{service.description}</p></article>)}
        </div>
      </section>
      <ContactBand />
    </PageShell>
  );
}
