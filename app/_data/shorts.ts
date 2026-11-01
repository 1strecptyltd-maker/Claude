/** Vertical films for the home short-form row, the home hero reel and the work page (founder selection 2026-11-01, docs/DECISIONS.md). */
export type ShortFilm = {
  slug: string;
  brand: string;
  type: string;
  /** Running time of the full film, m:ss. */
  duration: string;
  poster: string;
  /** Six-second muted loop. */
  preview: string;
  /** The whole film, played on request. */
  full: string;
  /** Shown in the home page short-form row. */
  home: boolean;
};

const film = (slug: string, brand: string, type: string, duration: string, home: boolean): ShortFilm => ({
  slug,
  brand,
  type,
  duration,
  poster: `/shorts/${slug}/poster.jpg`,
  preview: `/shorts/${slug}/preview.mp4`,
  full: `/shorts/${slug}/full.mp4`,
  home,
});

export const shortFilms: ShortFilm[] = [
  film("bentley", "Bentley", "Creator content", "1:21", true),
  film("coach", "Coach", "Lunar New Year dinner", "0:29", true),
  film("bvlgari", "Bvlgari", "Creator content", "0:54", true),
  film("range-rover", "Range Rover", "Creator content", "1:06", true),
  film("tiktok-creators-party", "TikTok", "Creators Party", "1:41", true),
  film("geely-ee-show-2026", "Geely", "EE Show 2026", "0:31", true),
  film("mg", "MG", "Creator content", "0:49", false),
  film("cartier", "Cartier", "Creator content", "1:51", false),
  film("tiktok-creator-summit", "TikTok", "Creator Summit", "0:31", false),
  film("dangerously-modern", "Dangerously Modern", "Brand content", "0:31", false),
];

const HERO_REEL = ["bentley", "coach", "geely-ee-show-2026", "tiktok-creators-party"];

export function getShortFilm(slug: string): ShortFilm {
  const found = shortFilms.find((item) => item.slug === slug);
  if (!found) throw new Error(`Unknown short film slug: ${slug}`);
  return found;
}

/** The home short-form row, in list order. */
export function homeShortFilms(): ShortFilm[] {
  return shortFilms.filter((item) => item.home);
}

/** The vertical films the home hero plays after the INDIBA photograph, in this order. */
export function heroReelShortFilms(): ShortFilm[] {
  return HERO_REEL.map(getShortFilm);
}
