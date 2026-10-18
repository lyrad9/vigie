import type { CSSProperties } from "react";
import { site } from "@/lib/site";
import { Showcase } from "./showcase";
import { Accent, Headline, Icon, Lede, PrimaryButton, QuietButton } from "./ui";

const delay = (i: number) => ({ "--i": i }) as CSSProperties;

/** Concentric range rings: the lookout's only ornament. `strength` scales the stroke opacity. */
export function RangeRings({ className = "", stroke = "var(--signal)", strength = 1 }: { className?: string; stroke?: string; strength?: number }) {
  return (
    <svg viewBox="0 0 800 800" className={className} aria-hidden="true" fill="none">
      {[110, 190, 270, 350].map((r, i) => (
        <circle
          key={r}
          cx="400"
          cy="400"
          r={r}
          stroke={stroke}
          strokeOpacity={Math.min(1, (0.22 - i * 0.04) * strength)}
          strokeWidth="1.5"
          strokeDasharray={i === 3 ? "2 10" : undefined}
        />
      ))}
      <path d="M400 20v760M20 400h760" stroke={stroke} strokeOpacity={0.07 * strength} />
    </svg>
  );
}

export function Hero() {
  return (
    <section className="relative isolate overflow-x-clip pt-14 sm:pt-20">
      <RangeRings className="pointer-events-none absolute top-[-15rem] left-1/2 -z-10 w-[62rem] max-w-none -translate-x-1/2 [mask-image:radial-gradient(closest-side,black_40%,transparent)] sm:top-[-19rem] sm:w-[76rem]" />

      <div className="mx-auto max-w-[75rem] px-5 text-center sm:px-8">
        <Headline
          as="h1"
          style={delay(0)}
          className="rise mx-auto max-w-[15ch] text-[clamp(2.6rem,5.6vw,4.6rem)] leading-[0.98] tracking-[-0.04em]"
        >
          Vos agents relancent sans cesse{" "}
          <span className="whitespace-nowrap">
            <Accent>le même serveur.</Accent>
          </span>
        </Headline>

        <Lede style={delay(1)} className="rise mx-auto mt-6 text-[clamp(1.05rem,1.5vw,1.2rem)]">
          Vigie le lance une seule fois. Ensuite, chaque agent, terminal et fenêtre lit le même état en direct : ce qui tourne, sur
          quel port, sous quel PID, et si ça répond vraiment.
        </Lede>

        <div className="rise mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center" style={delay(2)}>
          <PrimaryButton href={site.download} icon={Icon.download}>
            Télécharger pour Windows
          </PrimaryButton>
          <QuietButton href={site.repo} icon={Icon.github}>
            Voir le code
          </QuietButton>
        </div>

        <p className="rise mx-auto mt-5 flex max-w-[34rem] flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-small text-ink-soft" style={delay(3)}>
          {["Installateur Windows", "Licence MIT", "Rien ne quitte votre machine"].map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              {Icon.check}
              {t}
            </span>
          ))}
        </p>
      </div>

      <div className="rise relative mx-auto mt-12 max-w-[80rem] px-3 sm:mt-14 sm:px-8" style={delay(4)}>
        <Showcase />
      </div>
    </section>
  );
}
