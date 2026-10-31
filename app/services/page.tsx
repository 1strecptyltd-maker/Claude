import type { Metadata } from "next";
import { ContactBand } from "../_components/ContactBand";
import { PageShell } from "../_components/PageShell";
import { services, workflow } from "../_data/site";

export const metadata: Metadata = { title: "Services | First Rec.", description: "Photography, short-form film and flexible production support from First Rec." };
export const dynamic = "force-static";

export default function ServicesPage() {
  return (
    <PageShell current="/services/">
      <header className="page-hero">
        <p className="eyebrow">Services</p>
        <h1>The right production,<br />not the biggest one.</h1>
        <p>From a focused solo shoot to a larger live production, First Rec. builds the crew, equipment and workflow around what the brief actually needs.</p>
      </header>
      <section className="service-list" aria-label="Services">
        {services.map((service, index) => (
          <article className="service-row" key={service.title}>
            <span>0{index + 1}</span><h2>{service.title}</h2><p>{service.description}</p><em>{service.deliverables}</em>
          </article>
        ))}
      </section>
      <section className="process-section" aria-labelledby="process-heading">
        <div><p className="eyebrow">How it works</p><h2 id="process-heading">A process that stays useful.</h2></div>
        <div className="process-grid">
          {workflow.map((item, index) => <article key={item.title}><span>0{index + 1}</span><h3>{item.title}</h3><p>{item.copy}</p></article>)}
        </div>
      </section>
      <ContactBand />
    </PageShell>
  );
}
