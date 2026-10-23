import type { CSSProperties } from "react";
import { site } from "@/lib/site";
import { HeroVideo } from "./hero-video";
import { Accent, Headline, Icon, Lede, PrimaryButton, QuietButton } from "./ui";

const delay = (i: number) => ({ "--i": i }) as CSSProperties;

/**
 * Concentric range rings, kept for the dark closing band and the "ask an AI" card (not the hero).
 * `strength` scales the stroke opacity; `dottedOnly` keeps just the dotted outer ring.
 */
export function RangeRings({
  className = "",
  stroke = "var(--signal)",
  strength = 1,
  dottedOnly = false,
}: {
  className?: string;
  stroke?: string;
  strength?: number;
  dottedOnly?: boolean;
}) {
  const rings = [110, 190, 270, 350];
  return (
    <svg viewBox="0 0 800 800" className={className} aria-hidden="true" fill="none">
      {rings.map((r, i) => {
        const dotted = i === rings.length - 1;
        if (dottedOnly && !dotted) return null;
        return (
          <circle
            key={r}
            cx="400"
            cy="400"
            r={r}
            stroke={stroke}
            strokeOpacity={Math.min(1, (0.22 - i * 0.04) * strength)}
            strokeWidth="1.5"
            strokeDasharray={dotted ? "2 10" : undefined}
          />
        );
      })}
      {dottedOnly ? null : <path d="M400 20v760M20 400h760" stroke={stroke} strokeOpacity={0.07 * strength} />}
    </svg>
  );
}

export function Hero() {
  return (
    <section className="relative isolate overflow-x-clip pt-14 sm:pt-20">
      <div className="mx-auto max-w-[75rem] px-5 text-center sm:px-8">
        <Headline
          as="h1"
          style={delay(0)}
          className="rise mx-auto max-w-[19ch] text-[clamp(2.2rem,4.3vw,3.5rem)] leading-[1.05]"
        >
          Vos agents relancent sans cesse{" "}
          <span className="whitespace-nowrap">
            <Accent>le même serveur.</Accent>
          </span>
        </Headline>

        <Lede style={delay(1)} className="rise mx-auto mt-5 text-[clamp(1.05rem,1.4vw,1.15rem)]">
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
        <HeroVideo />
      </div>
    </section>
  );
}
