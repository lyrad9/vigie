import type { Metadata } from "next";
import type { TrustPage } from "./content.ts";

// A page's openGraph replaces the layout's whole object, so every page spreads this base.
export const openGraphBase = {
  type: "website",
  siteName: "Vigie",
  locale: "fr_FR",
  images: ["/screens/app-light.png"],
} satisfies Metadata["openGraph"];

export function trustPageMetadata(page: TrustPage): Metadata {
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: page.path, types: { "text/markdown": `${page.path}.md` } },
    openGraph: { ...openGraphBase, title: `${page.title} · Vigie`, description: page.description, url: page.path },
  };
}
