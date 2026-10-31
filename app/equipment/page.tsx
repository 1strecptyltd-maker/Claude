import type { Metadata } from "next";
import { ContactBand } from "../_components/ContactBand";
import { PageShell } from "../_components/PageShell";
import { contactEmail, equipment } from "../_data/site";

export const metadata: Metadata = { title: "Equipment Hire | First Rec.", description: "Camera, lighting and production equipment hire from Sydney, with or without crew." };
export const dynamic = "force-static";

export default function EquipmentPage() {
  return (
    <PageShell current="/equipment/">
      <header className="page-hero equipment-hero">
        <p className="eyebrow">Equipment hire</p>
        <h1>Production equipment,<br />with or without crew.</h1>
        <p>Dry hire and crewed packages are available from Sydney. Pickup is preferred, with delivery arranged around the production.</p>
        <a className="text-link" href={`mailto:${contactEmail}?subject=Equipment%20hire%20enquiry`}>Check availability</a>
      </header>
      <section className="equipment-list" aria-label="Available equipment">
        {equipment.map((group, index) => (
          <article key={group.group}>
            <span>0{index + 1}</span><h2>{group.group}</h2>
            <ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        ))}
      </section>
      <section className="hire-modes" aria-labelledby="hire-modes-heading">
        <h2 id="hire-modes-heading">Choose the support the job needs.</h2>
        <article><span>Dry hire</span><p>Collect equipment in Sydney for use by your own experienced crew.</p></article>
        <article><span>Crewed package</span><p>Combine selected equipment with First Rec. production, camera or lighting support.</p></article>
        <p className="rental-note">ID, bond and insurance requirements may apply. Pricing and delivery are provided by quote.</p>
      </section>
      <ContactBand />
    </PageShell>
  );
}
