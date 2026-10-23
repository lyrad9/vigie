"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { site } from "@/lib/site";
import { Accent, Dot, Headline, Icon, PrimaryButton } from "./ui";

const DURATION = 6500;

const k = (s: string) => <span className="text-syn-key">{s}</span>;
const s = (v: string) => <span className="text-syn-str">{v}</span>;
const n = (v: string) => <span className="text-syn-num">{v}</span>;

/**
 * A zoomed crop of a real capture. `focus` is the point of the screenshot (in %) that stays put
 * while the image is scaled, so the crop reads at a legible size instead of a thumbnail.
 */
function Shot({ base, alt, focus, zoom }: { base: "ports" | "app"; alt: string; focus: string; zoom: number }) {
  const style = { objectPosition: focus, transform: `scale(${zoom})`, transformOrigin: focus };
  const common = "absolute inset-0 h-full w-full object-cover";
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-hairline bg-card shadow-card">
      <Image src={`/screens/${base}-light.png`} alt={alt} fill sizes="(min-width: 1024px) 1100px, 160vw" className={`${common} dark:hidden`} style={style} />
      <Image src={`/screens/${base}-dark.png`} alt="" fill sizes="(min-width: 1024px) 1100px, 160vw" className={`${common} hidden dark:block`} style={style} />
    </div>
  );
}

function StatusPanel() {
  return (
    <div className="w-full overflow-hidden rounded-2xl bg-band shadow-card">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-caption text-band-muted">
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="ml-2 font-mono">~/dev/atlas</span>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-caption leading-[1.7] text-band-text">
        <span className="text-band-muted">$ </span>
        <span className="font-semibold text-white">vigie status --json</span>
        {"\n{\n  "}
        {k('"projects"')}: [{"{ "}
        {k('"name"')}: {s('"atlas"')},{"\n    "}
        {k('"servers"')}: [{"{\n      "}
        {k('"name"')}: {s('"web"')}, {k('"state"')}: {s('"running"')},{"\n      "}
        {k('"port"')}: {n("3000")}, {k('"pid"')}: {n("15132")},{"\n      "}
        {k('"healthy"')}: {n("true")}, {k('"url"')}: {s('"http://localhost:3000"')}
        {"\n    }]\n  }]\n}"}
      </pre>
    </div>
  );
}

function RecoveryPanel() {
  const steps = [
    { tone: "ok" as const, label: "running", text: "api répond sur :4000", time: "14:02:11" },
    { tone: "bad" as const, label: "exited", text: "process exited with code 1", time: "14:06:48" },
    { tone: "warn" as const, label: "restarting", text: "nouvelle tentative dans 1 s · 1/5", time: "14:06:48" },
    { tone: "ok" as const, label: "running", text: "health check HTTP / ✓", time: "14:06:51" },
  ];
  return (
    <ol className="relative w-full rounded-2xl border border-hairline bg-card p-6 shadow-card">
      <span className="absolute top-9 bottom-9 left-[33px] w-px border-l border-dashed border-hairline-strong" aria-hidden="true" />
      {steps.map((st, i) => (
        <li key={i} className="relative flex items-start gap-4 py-3">
          <span className="relative z-10 mt-1 grid size-5 place-items-center rounded-full bg-card">
            <Dot tone={st.tone} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-3">
              <span className="font-display text-ui font-bold text-ink">{st.label}</span>
              <span className="font-mono text-caption text-ink-faint">{st.time}</span>
            </span>
            <span className="mt-0.5 block font-mono text-caption text-ink-soft">{st.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

type Feature = { title: string; text: ReactNode; panel: ReactNode; icon: ReactNode };

const ico = (d: string) => (
  <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const FEATURES: Feature[] = [
  {
    title: "Inspecter avant de lancer",
    icon: ico("M4 17l6-6-6-6M12 19h8"),
    text: "Une commande, une réponse JSON : projets, serveurs, ports, PID, santé. L'agent lit l'état avant de toucher à quoi que ce soit.",
    panel: <StatusPanel />,
  },
  {
    title: "Savoir qui tient chaque port",
    icon: ico("M3 7h18M3 12h18M3 17h18M7 7v10"),
    text: "Géré par Vigie, lancé ailleurs ou réservé au système : chaque port a un propriétaire, un PID et une commande. Rien n'est arrêté sans votre accord.",
    panel: <Shot base="ports" focus="40% 26%" zoom={1.75} alt="L'écran Ports de Vigie : les ports 3000 et 4000 du projet atlas et 5173 de boutique sont gérés, le port 3001 est tenu par un process lancé en dehors de Vigie." />,
  },
  {
    title: "Relancer ce qui tombe",
    icon: ico("M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"),
    text: "Sonde TCP ou HTTP. Un serveur qui ne répond plus repart avec un délai croissant, puis passe en échec au bout de cinq essais, dernier code de sortie à l'appui.",
    panel: <RecoveryPanel />,
  },
  {
    title: "Lire les logs sans rouvrir de terminal",
    icon: ico("M4 6h16M4 10h10M4 14h16M4 18h8"),
    text: (
      <>
        Liens cliquables, couleurs quand l&apos;outil les émet, et un fichier par serveur qui survit aux redémarrages.{" "}
        <code className="font-mono text-[0.92em] text-ink">vigie logs -f</code> pour suivre en direct depuis n&apos;importe quel terminal.
      </>
    ),
    panel: <Shot base="app" focus="34% 42%" zoom={1.8} alt="La sortie en direct du serveur web dans Vigie : démarrage de Next.js puis les requêtes GET avec leurs codes de statut." />,
  },
];

export function Features() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || reduced) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % FEATURES.length), DURATION);
    return () => clearTimeout(t);
  }, [active, paused, reduced]);

  return (
    <section
      id="controle"
      ref={section}
      className="py-24 sm:py-32"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !section.current?.contains(e.relatedTarget as Node) && setPaused(false)}
    >
      <div className="mx-auto max-w-[75rem] px-5 sm:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <Headline className="max-w-[16ch] text-[clamp(1.85rem,3.3vw,2.75rem)] leading-[1.1]">
            Gardez la main <Accent>sur chaque port</Accent> de votre machine
          </Headline>
          <PrimaryButton href={site.download} icon={Icon.download} className="lg:min-w-[22rem]">
            Télécharger pour Windows
          </PrimaryButton>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-10">
          <ul className="flex flex-col gap-2" role="tablist" aria-label="Fonctionnalités" aria-orientation="vertical">
            {FEATURES.map((f, i) => {
              const on = i === active;
              return (
                <li key={f.title}>
                  <button
                    type="button"
                    role="tab"
                    id={`feature-tab-${i}`}
                    aria-selected={on}
                    aria-controls="feature-panel"
                    onClick={() => setActive(i)}
                    className={`w-full rounded-[20px] p-5 text-left transition-[background-color,box-shadow,border-color] duration-500 ease-out-expo ${
                      on ? "border border-hairline bg-card shadow-card" : "border border-transparent text-ink-faint hover:text-ink-soft"
                    }`}
                  >
                    <span className={`flex items-center gap-3 font-display text-lg font-bold ${on ? "text-ink" : ""}`}>
                      {f.icon}
                      {f.title}
                    </span>
                    <span
                      className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out-expo ${on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                    >
                      <span className="overflow-hidden">
                        <span className="block pt-3 text-base leading-relaxed text-ink-soft">{f.text}</span>
                        <span className="mt-5 block h-1 overflow-hidden rounded-full bg-wash" aria-hidden="true">
                          {on ? (
                            <span
                              key={`${active}-${paused}-${reduced}`}
                              className="block h-full origin-left rounded-full bg-signal"
                              style={
                                paused || reduced
                                  ? { transform: "scaleX(1)" }
                                  : { animation: `progress ${DURATION}ms linear both` }
                              }
                            />
                          ) : null}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div
            id="feature-panel"
            role="tabpanel"
            aria-labelledby={`feature-tab-${active}`}
            className="dot-field relative grid min-h-[26rem] min-w-0 grid-cols-[minmax(0,1fr)] place-items-center overflow-hidden rounded-[28px] border border-hairline bg-wash p-4 sm:min-h-[32rem] sm:p-10"
          >
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                aria-hidden={i !== active}
                className={`col-start-1 row-start-1 w-full max-w-[36rem] min-w-0 transition-[opacity,transform,filter] duration-700 ease-out-expo ${
                  i === active ? "opacity-100" : "pointer-events-none translate-y-4 scale-[0.98] opacity-0 blur-[2px]"
                }`}
              >
                {f.panel}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
