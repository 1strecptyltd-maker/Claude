export const navigation = [
  ["Work", "/work/"],
  ["Services", "/services/"],
  ["About", "/about/"],
  ["Equipment", "/equipment/"],
  ["Contact", "/contact/"],
] as const;

export type NavHref = (typeof navigation)[number][1];
