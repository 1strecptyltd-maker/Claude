import type { Metadata } from "next";
import { PageShell } from "../_components/PageShell";
import { contactEmail } from "../_data/site";

export const metadata: Metadata = { title: "Contact | First Rec.", description: "Start a photography, short-form film or equipment hire conversation with First Rec. in Sydney." };
export const dynamic = "force-static";

export default function ContactPage() {
  return (
    <PageShell current="/contact/">
      <section className="contact-page">
        <div>
          <p className="eyebrow">Start a conversation</p>
          <h1>Tell us what the work needs to do.</h1>
          <p className="contact-intro">A useful first message is simple. Share what you know and First Rec. can help shape the rest.</p>
          <a className="contact-email" href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </div>
        <ol className="brief-list">
          <li><span>01</span><p><strong>Goal</strong>What should the content help your team achieve?</p></li>
          <li><span>02</span><p><strong>Channels</strong>Where will the photography or film be used?</p></li>
          <li><span>03</span><p><strong>Timing</strong>When is the shoot, event or delivery date?</p></li>
          <li><span>04</span><p><strong>Budget range</strong>A range helps shape the right production approach.</p></li>
        </ol>
      </section>
      <section className="contact-location">
        <p className="eyebrow">Sydney based</p><h2>Available across Australia.<br />Working in English&nbsp;+ Mandarin.</h2>
      </section>
    </PageShell>
  );
}
