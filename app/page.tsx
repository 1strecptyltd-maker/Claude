import Image from "next/image";
import type { CSSProperties } from "react";
import { ContactBand } from "./_components/ContactBand";
import { PageShell } from "./_components/PageShell";
import { FilmPlayer } from "./_components/home/FilmPlayer";
import { HeroReel } from "./_components/home/HeroReel";
import { HomeMotion } from "./_components/home/HomeMotion";
import { ShortFilmRow } from "./_components/home/ShortFilmRow";
import type { CaseStudy } from "./_data/site";
import { featuredCaseStudies, heroCaseStudy } from "./_data/publication";
import { heroReelShortFilms, homeShortFilms } from "./_data/shorts";
import "./home.css";

export const dynamic = "force-static";

const hero = heroCaseStudy();

type CaseCard = {
  slug: string;
  name: string;
  what: string;
  deliverables: string;
  image: { src: string; alt: string; position?: string };
  inset?: { src: string; alt: string; position?: string };
  number?: string;
};

const toCard = (project: CaseStudy): CaseCard => {
  const home = project.home;
  if (!home) throw new Error(`Case study ${project.slug} has no home block for the home page`);
  return {
    slug: project.slug,
    name: home.name ?? project.client,
    what: home.what,
    deliverables: home.deliverables,
    image: home.image,
    inset: home.inset,
    number: home.number,
  };
};

const cards = featuredCaseStudies().map(toCard);
const spreads = cards.slice(0, 4);
const minis = cards.slice(4, 8);

const photoStyle = (position?: string) => (position ? { objectPosition: position } : undefined);
const riseStyle = (delay: string) => ({ "--wd": delay }) as CSSProperties;

function SpreadA({ card }: { card: CaseCard }) {
  return (
    <article className="spread s-a" id={card.slug}>
      <h3 className="giant word" data-drift="-3,5" data-knock={`ph-${card.slug}`} data-text={card.name}>
        <a className="case-link" href={`/work/${card.slug}/`}>{card.name}</a>
      </h3>
      <figure className="ph" data-reveal="right" id={`ph-${card.slug}`}>
        <Image alt={card.image.alt} data-par="10" fill sizes="(max-width: 760px) 100vw, 66vw" src={card.image.src} style={photoStyle(card.image.position)} />
      </figure>
      <figure className="inset" data-reveal="up" data-delay=".25">
        {card.inset ? <Image alt={card.inset.alt} data-par="-8" fill sizes="(max-width: 760px) 62vw, 25vw" src={card.inset.src} style={photoStyle(card.inset.position)} /> : null}
      </figure>
      <div className="txt" data-rise="" style={riseStyle(".2s")}>
        <p className="what">{card.what}</p>
        <p className="del">{card.deliverables}</p>
      </div>
    </article>
  );
}

function SpreadB({ card }: { card: CaseCard }) {
  return (
    <article className="spread s-b" id={card.slug}>
      <h3 className="giant word" data-drift="5,-4">
        <a className="case-link" href={`/work/${card.slug}/`}>{card.name}</a>
      </h3>
      <figure className="ph" data-reveal="up">
        <Image alt={card.image.alt} data-par="10" fill sizes="(max-width: 760px) 100vw, 57vw" src={card.image.src} style={photoStyle(card.image.position)} />
      </figure>
      <figure className="inset" data-reveal="left" data-delay=".25">
        {card.inset ? <Image alt={card.inset.alt} data-par="-8" fill sizes="24vw" src={card.inset.src} style={photoStyle(card.inset.position)} /> : null}
      </figure>
      <div className="txt" data-rise="" style={riseStyle(".2s")}>
        <p className="what">{card.what}</p>
        <p className="del">{card.deliverables}</p>
      </div>
    </article>
  );
}

function SpreadC({ card }: { card: CaseCard }) {
  return (
    <article className="spread s-c" id={card.slug}>
      <figure className="ph" data-reveal="left">
        <Image alt={card.image.alt} data-par="8" fill sizes="100vw" src={card.image.src} style={photoStyle(card.image.position)} />
      </figure>
      <h3 className="giant word" data-drift="-4,4">
        <a className="case-link" href={`/work/${card.slug}/`}>{card.name}</a>
      </h3>
      <figure className="inset" data-reveal="up" data-delay=".3">
        {card.inset ? <Image alt={card.inset.alt} data-par="-8" fill sizes="22vw" src={card.inset.src} style={photoStyle(card.inset.position)} /> : null}
      </figure>
      <div className="txt" data-rise="" style={riseStyle(".2s")}>
        <p className="what">{card.what}</p>
        <p className="del">{card.deliverables}</p>
      </div>
    </article>
  );
}

function SpreadD({ card }: { card: CaseCard }) {
  return (
    <article className="spread s-d" id={card.slug}>
      {card.number ? (
        <div className="slab" aria-hidden="true" data-reveal="up"><span className="giant" data-count={card.number}>{card.number}</span></div>
      ) : null}
      <h3 className="giant word" data-drift="4,-4" data-knock={`ph-${card.slug}`} data-text={card.name}>
        <a className="case-link" href={`/work/${card.slug}/`}>{card.name}</a>
      </h3>
      <figure className="ph" data-reveal="right" data-delay=".15" id={`ph-${card.slug}`}>
        <Image alt={card.image.alt} data-par="10" fill sizes="(max-width: 760px) 82vw, 54vw" src={card.image.src} style={photoStyle(card.image.position)} />
      </figure>
      <div className="txt" data-rise="" style={riseStyle(".2s")}>
        <p className="what">{card.what}</p>
        <p className="del">{card.deliverables}</p>
      </div>
    </article>
  );
}

function MiniCard({ card, index }: { card: CaseCard; index: number }) {
  return (
    <li className="mini" id={card.slug}>
      <figure className="ph" data-reveal={index % 2 === 0 ? "left" : "right"} id={`ph-${card.slug}`}>
        <Image alt={card.image.alt} fill sizes="(max-width: 760px) 90vw, 44vw" src={card.image.src} style={photoStyle(card.image.position)} />
      </figure>
      <h3 className="giant" data-drift="-4,3" data-knock={`ph-${card.slug}`} data-text={card.name}>
        <a className="case-link" href={`/work/${card.slug}/`}>{card.name}</a>
      </h3>
      <p className="what" data-rise="" style={riseStyle(".15s")}>{card.what}</p>
      <p className="del" data-rise="" style={riseStyle(".22s")}>{card.deliverables}</p>
    </li>
  );
}

const spreadVariants = [SpreadA, SpreadB, SpreadC, SpreadD];

export default function Home() {
  const heroImage = hero.homeImage ?? { src: hero.image, alt: hero.alt };
  return (
    <PageShell>
      <script dangerouslySetInnerHTML={{ __html: "if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('js')" }} />
      <div className="home">
        <section className="home-hero" aria-label="Introduction">
          <h1 className="giant">
            <span className="l" data-knock="hero-ph" data-text="One shoot.">One shoot.</span>
            <span className="l" data-knock="hero-ph" data-text="Every">Every</span>
            <span className="l" data-knock="hero-ph" data-text="format.">format.</span>
          </h1>
          <HeroReel films={heroReelShortFilms()} label={hero.home?.name ?? hero.client} photo={heroImage} what={hero.home?.what ?? hero.category} />
          <div className="dek">
            <p>First Rec. is a bilingual production studio in Sydney. We film launches, events and brand stories, then deliver the hero film, the vertical cuts and the photographs from a single shoot.</p>
            <div className="home-btns">
              <a className="home-btn home-btn-line" href="#work">See the work</a>
              <a className="home-btn home-btn-red" href="/contact/">Start a project</a>
            </div>
          </div>
        </section>

        <section id="work" aria-labelledby="work-title">
          <div className="work-head" data-wipe="">
            <h2 className="giant" id="work-title">Work</h2>
            <p>Launches, events and brand stories.</p>
          </div>
          {spreads.map((card, index) => {
            const Spread = spreadVariants[index];
            if (!Spread) return null;
            return <Spread card={card} key={card.slug} />;
          })}
          <div className="more">
            <h2 className="giant" data-wipe="">More work</h2>
            <ul className="minis">
              {minis.map((card, index) => <MiniCard card={card} index={index} key={card.slug} />)}
            </ul>
          </div>
        </section>

        <section className="reels" id="shortform" aria-labelledby="reels-title">
          <h2 className="giant" id="reels-title" data-drift="6,-6">Short-form</h2>
          <ShortFilmRow films={homeShortFilms()} />
          <p className="reels-foot" data-rise="">Vertical cuts for social. Click any film to play it.</p>
        </section>

        <section className="why" id="why" aria-labelledby="why-title">
          <h2 className="giant" id="why-title" data-wipe="">Why First Rec.</h2>
          <ol>
            <li data-wipe="">
              <h3 className="giant">One shoot, every format.</h3>
              <p>The hero film, the vertical cuts for social, subtitled interviews and the photographs all come out of the same shoot.</p>
              <a className="ref" href="#shortform">See the short-form</a>
            </li>
            <li data-wipe="">
              <h3 className="giant">Big-brand live sets.</h3>
              <p>We have run cameras on live sets for TikTok, Geely, NVIDIA and Coach.</p>
              <a className="ref" href="/work/tiktok/">See TikTok</a>
            </li>
            <li data-wipe="">
              <h3 className="giant">English&nbsp;+ Mandarin.</h3>
              <p>Chinese brands working in Australia get interviews, subtitles and on-set communication in both languages, without a middleman.</p>
              <a className="ref" href="/work/inner-health/">See Inner Health</a>
            </li>
            <li data-wipe="">
              <h3 className="giant">Flexible crew, clear budgets.</h3>
              <p>A small team that scales to the brief, with a budget that is clear before we start.</p>
              <a className="ref" href="/contact/">Start a project</a>
            </li>
          </ol>
        </section>

        <ContactBand />
        <FilmPlayer />
        <HomeMotion />
      </div>
    </PageShell>
  );
}
