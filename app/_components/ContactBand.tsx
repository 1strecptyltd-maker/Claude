import { contactEmail } from "../_data/site";

export function ContactBand() {
  return (
    <section className="contact-band" aria-labelledby="contact-band-heading">
      <div className="contact-band-head">
        <h2 id="contact-band-heading"><span className="contact-band-line">Bring us</span> <span className="contact-band-line">the goal.</span></h2>
        <p className="contact-band-sub">We&apos;ll help shape the production.</p>
      </div>
      <div className="contact-band-row">
        <a className="contact-band-button" href="/contact/">Start a project</a>
        <a className="contact-band-email" href={`mailto:${contactEmail}`}>{contactEmail}</a>
        <p className="contact-band-where">Sydney /<br />Australia-wide</p>
      </div>
    </section>
  );
}
