import { contactEmail } from "../_data/site";

export function ContactBand() {
  return (
    <section className="contact-band" aria-labelledby="contact-band-heading">
      <p>Have a brief in motion?</p>
      <h2 id="contact-band-heading">Bring us the goal. We&apos;ll help shape the production.</h2>
      <a className="text-link" href="/contact/">Start a project</a>
      <a className="contact-band-email" href={`mailto:${contactEmail}`}>{contactEmail}</a>
    </section>
  );
}
