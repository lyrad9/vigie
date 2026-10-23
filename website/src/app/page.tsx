/*
 * THESIS: Vigie's page owns "inspect first, launch once", shown through the real Vigie window and real
 * CLI answers. It refuses the dev-tool default of a neon terminal hero on black.
 * OWN-WORLD: Deck-white ground, white double frames, Harbor Ink buttons and bands, one Signal Blue
 * accent word per headline, status dots that only mean server state, dotted plotting sheets,
 * range rings outside the hero. Plus Jakarta Sans headings, DM Sans paragraphs, no italics.
 * STORY: the visitor recognizes the duplicate-server mess, sees one window holding the live state,
 * sees how agents query it before acting, and downloads the Windows installer.
 * FIRST VIEWPORT: floating nav; centered two-line headline with its blue accent; one-sentence lede;
 * dark "Télécharger pour Windows" + quiet "Voir le code"; the framed presentation video below.
 * FORM: brief-pinned (user reference: ekklo.com structure), no seed roll.
 */
import { AgentRail } from "@/components/agent-rail";
import { AskAI } from "@/components/ask-ai";
import { Compare } from "@/components/compare";
import { ClosingCta } from "@/components/cta";
import { Faq } from "@/components/faq";
import { Features } from "@/components/features";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { Nav } from "@/components/nav";
import { Steps } from "@/components/steps";
import { homeJsonLd, serializeJsonLd } from "@/lib/jsonld.ts";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/", types: { "text/markdown": "/index.md" } },
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(homeJsonLd()) }} />
      <Nav />
      <main>
        <Hero />
        <Compare />
        <Features />
        <AskAI />
        <AgentRail />
        <Steps />
        <Faq />
        <ClosingCta />
      </main>
      <Footer />
    </>
  );
}
