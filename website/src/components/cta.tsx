import { site } from "@/lib/site";
import { RangeRings } from "./hero";
import { Icon } from "./ui";

/** The closing band: deep ink in both themes, range rings sweeping out of the corners. */
export function ClosingCta() {
  return (
    <section className="px-3 pt-8 pb-3 sm:px-4" aria-labelledby="cta-title">
      <div className="relative isolate overflow-hidden rounded-[28px] bg-band ring-1 ring-transparent dark:ring-white/10 px-5 py-24 text-center text-band-text sm:rounded-[44px] sm:py-32">
        <RangeRings dottedOnly strength={2.2} stroke="oklch(0.72 0.15 255)" className="pointer-events-none absolute -top-[26rem] -left-[22rem] -z-10 w-[56rem] max-w-none" />
        <RangeRings dottedOnly strength={2.2} stroke="oklch(0.72 0.15 255)" className="pointer-events-none absolute -right-[24rem] -bottom-[30rem] -z-10 w-[60rem] max-w-none" />

        <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-1.5 text-small text-band-muted">
          Gratuit · open source · licence MIT
        </p>

        <h2 id="cta-title" className="mx-auto mt-8 max-w-[14ch] font-display text-[clamp(2rem,4.2vw,3.25rem)] leading-[1.08] font-extrabold tracking-[-0.03em] text-balance text-white">
          Une seule vigie pour <em className="whitespace-nowrap text-[oklch(0.74_0.15_255)] not-italic">tous vos serveurs.</em>
        </h2>
        <p className="mx-auto mt-7 max-w-[54ch] text-lg leading-relaxed text-pretty text-band-muted">
          Lancez chaque serveur une fois. Laissez vos agents lire l&apos;état au lieu d&apos;en démarrer un autre. Gardez la main sur chaque port.
        </p>

        <div className="mt-11 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <a
            href={site.download}
            className="group inline-flex h-14 items-center justify-center gap-3 rounded-[14px] bg-white px-7 font-display text-ui font-bold text-[oklch(0.21_0.02_262)] shadow-[0_14px_30px_-12px_oklch(0_0_0/0.6)] transition-[filter] duration-300 hover:brightness-95"
          >
            Télécharger pour Windows
            {Icon.download}
          </a>
          <a
            href={site.repo}
            className="inline-flex h-14 items-center justify-center gap-2.5 rounded-[14px] border border-white/12 bg-band-raised px-6 font-display text-ui font-bold text-white transition-[border-color] duration-300 hover:border-white/25"
          >
            {Icon.github}
            Voir le code
          </a>
        </div>
        <p className="mt-6 text-small text-band-muted">Installateur Windows · macOS et Linux depuis les sources</p>
      </div>
    </section>
  );
}
