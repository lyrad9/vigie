import type { Metadata } from "next";
import type { TrustPage } from "./content.ts";

// A page's openGraph replaces the layout's whole object, so every page spreads this base.
// The share image itself comes from app/opengraph-image.png and app/twitter-image.png.
export const openGraphBase = {
  type: "website",
  siteName: "Vigie",
  locale: "fr_FR",
} satisfies Metadata["openGraph"];

export function trustPageMetadata(page: TrustPage): Metadata {
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: page.path, types: { "text/markdown": `${page.path}.md` } },
    openGraph: { ...openGraphBase, title: `${page.title} · Vigie`, description: page.description, url: page.path },
  };
}
