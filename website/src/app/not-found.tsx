import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { Accent, Headline, Icon, Lede, PrimaryButton, QuietButton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Page introuvable",
  description: "Cette page n'existe pas sur vigie.lyrad.dev.",
};

const link = "font-medium text-ink underline decoration-hairline-strong underline-offset-4 transition-colors hover:decoration-ink";

export default function NotFound() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[50rem] px-5 pt-24 pb-8 text-center sm:px-8 sm:pt-32">
        <p className="font-mono text-small text-ink-faint">404</p>
        <Headline as="h1" className="mt-4 text-[clamp(2rem,4vw,3rem)] leading-[1.08]">
          Cette page est <Accent>introuvable</Accent>
        </Headline>
        <Lede className="mx-auto mt-5">
          L&apos;adresse a peut-être changé. Repartez de l&apos;accueil, ou lisez le résumé pour agents dans{" "}
          <a href="/llms.txt" className={link}>
            llms.txt
          </a>{" "}
          et le{" "}
          <a href="/sitemap.xml" className={link}>
            plan du site
          </a>
          .
        </Lede>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <PrimaryButton href="/" icon={Icon.arrow}>
            Retour à l&apos;accueil
          </PrimaryButton>
          <QuietButton href="/contact">Contacter le projet</QuietButton>
        </div>
      </main>
      <Footer />
    </>
  );
}
