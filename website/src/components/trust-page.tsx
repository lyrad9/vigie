import type { TrustPage } from "@/lib/content.ts";
import { starCount } from "@/lib/github";
import { Footer } from "./footer";
import { Nav } from "./nav";
import { Prose } from "./prose";
import { Accent, Headline, Lede } from "./ui";

/** Headline with the house accent on its last word, e.g. "À propos de *Vigie*". */
function Heading({ text }: { text: string }) {
  const cut = text.lastIndexOf(" ");
  return (
    <>
      {cut > 0 ? `${text.slice(0, cut)} ` : null}
      <Accent>{text.slice(cut + 1)}</Accent>
    </>
  );
}

/** About, Contact and Privacy: the same Markdown blocks agents read, set on a white sheet. */
export async function TrustPageView({ page }: { page: TrustPage }) {
  return (
    <>
      <Nav stars={await starCount()} />
      <main>
        <header className="mx-auto max-w-[50rem] px-5 pt-20 pb-10 sm:px-8 sm:pt-28 sm:pb-12">
          <Headline as="h1" className="text-[clamp(2rem,4vw,3rem)] leading-[1.08]">
            <Heading text={page.heading} />
          </Headline>
          <Lede className="mt-5">{page.lede}</Lede>
        </header>
        <div className="mx-auto max-w-[50rem] px-3 sm:px-8">
          <article className="rounded-[28px] border border-hairline bg-card px-6 py-10 shadow-card sm:px-12 sm:py-14">
            <Prose blocks={page.blocks} />
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}
