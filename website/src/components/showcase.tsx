"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Dot, Logo } from "./ui";

const DURATION = 7000;

type Moment = {
  key: string;
  title: string;
  text: string;
  base: "app" | "ports" | "add";
  alt: string;
  /** Phones: the point of the capture to keep (object-position and zoom origin) and how much to zoom. */
  mobile: { focus: string; zoom: number };
  /** Thumbnail crop. */
  thumb: { focus: string; zoom: number };
};

const MOMENTS: Moment[] = [
  {
    key: "servers",
    title: "Vos serveurs",
    text: "Chaque projet, son port, son PID, son uptime et sa sortie en direct.",
    base: "app",
    alt: "La fenêtre Vigie : trois projets à gauche, le serveur web d'atlas en cours d'exécution sur le port 3000, son PID 15132, son uptime, son état de santé et sa sortie Next.js en direct.",
    mobile: { focus: "21% 0%", zoom: 1.6 },
    thumb: { focus: "21% 0%", zoom: 1.7 },
  },
  {
    key: "ports",
    title: "Les ports",
    text: "Qui tient chaque port : Vigie, un autre programme ou le système.",
    base: "ports",
    alt: "L'écran Ports de Vigie : les ports 3000, 4000 et 5173 sont gérés par Vigie, le port 3001 est tenu par node.exe, lancé en dehors de Vigie.",
    mobile: { focus: "21% 0%", zoom: 1.55 },
    thumb: { focus: "30% 18%", zoom: 1.9 },
  },
  {
    key: "add",
    title: "Un nouveau projet",
    text: "Collez un dossier : Vigie lit package.json et propose la commande et le port.",
    base: "add",
    alt: "Le dialogue Add project de Vigie : le dossier D:\\dev\\studio est collé, Vigie a détecté Astro avec pnpm et propose la commande pnpm dev --port 4321.",
    mobile: { focus: "50% 40%", zoom: 1.75 },
    thumb: { focus: "50% 36%", zoom: 1.7 },
  },
];

function WindowBar() {
  return (
    <div className="flex h-9 items-center gap-2.5 border-b border-hairline bg-card pl-3.5 sm:h-10">
      <Logo size={16} id="titlebar" />
      <span className="text-caption font-medium text-ink-soft">Vigie</span>
      <span className="ml-auto flex h-full text-ink-soft" aria-hidden="true">
        {["M5 12h14", "M6 6h12v12H6z", "M6 6l12 12M18 6 6 18"].map((d) => (
          <span key={d} className="grid h-full w-11 place-items-center">
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d={d} />
            </svg>
          </span>
        ))}
      </span>
    </div>
  );
}

/** Light capture in light mode, dark capture in dark mode; phones zoom onto the useful region. */
function Capture({ m, eager, sizes, crop }: { m: Moment; eager: boolean; sizes: string; crop?: { focus: string; zoom: number } }) {
  const vars = {
    "--focus": (crop ?? m.mobile).focus,
    "--zoom": (crop ?? m.mobile).zoom,
  } as CSSProperties;
  const cls = crop
    ? "object-cover [object-position:var(--focus)] [transform-origin:var(--focus)] [transform:scale(var(--zoom))]"
    : "object-cover max-sm:[object-position:var(--focus)] max-sm:[transform-origin:var(--focus)] max-sm:[transform:scale(var(--zoom))]";
  return (
    <>
      <Image src={`/screens/${m.base}-light.png`} alt={m.alt} fill priority={eager} sizes={sizes} style={vars} className={`${cls} dark:hidden`} />
      <Image src={`/screens/${m.base}-dark.png`} alt="" fill priority={eager} sizes={sizes} style={vars} className={`${cls} hidden dark:block`} />
    </>
  );
}

function AgentNote({ who, children, className }: { who: string; children: ReactNode; className: string }) {
  return (
    <div className={`pointer-events-none absolute z-10 hidden w-[17.5rem] rounded-2xl border border-hairline bg-card p-4 shadow-card xl:block ${className}`}>
      <p className="flex items-center gap-2 text-caption font-medium text-ink-soft">
        <span className="grid size-6 place-items-center rounded-lg bg-band text-band-text" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M5 17l5-5-5-5M12 18h7" />
          </svg>
        </span>
        {who}
      </p>
      <div className="mt-2.5 text-small leading-snug text-ink">{children}</div>
    </div>
  );
}

/** The framed Vigie window plus ekklo's "three moments": thumbnails that drive the frame. */
export function Showcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || reduced) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % MOMENTS.length), DURATION);
    return () => clearTimeout(t);
  }, [active, paused, reduced]);

  return (
    <div
      ref={root}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !root.current?.contains(e.relatedTarget as Node) && setPaused(false)}
    >
      <div className="relative">
        <div className={`transition-opacity duration-500 ${active === 0 ? "opacity-100" : "opacity-0"}`} aria-hidden={active !== 0}>
          <AgentNote who="Claude Code" className="top-[52%] -left-6 rotate-[-3deg]">
            <code className="font-mono text-caption text-ink-soft">vigie status --json</code>
            <span className="mt-1.5 flex items-center gap-2">
              <Dot tone="ok" /> web tourne déjà sur :3000
            </span>
          </AgentNote>
          <AgentNote who="Codex" className="-right-4 bottom-[12%] rotate-[2.5deg]">
            Voulait lancer <code className="font-mono text-caption">pnpm dev</code>.
            <span className="mt-1.5 block text-ink-soft">Utilise l&apos;URL existante à la place.</span>
          </AgentNote>
        </div>

        <div className="settle">
          <div className="rounded-[20px] border border-hairline bg-card p-2 shadow-[0_2px_4px_oklch(0.2_0.02_262/0.04),0_40px_90px_-40px_oklch(0.2_0.02_262/0.45)] sm:rounded-[28px] sm:p-3.5 dark:shadow-[0_40px_90px_-40px_oklch(0_0_0/0.9)]">
            <div className="overflow-hidden rounded-2xl border border-hairline">
              <WindowBar />
              <div className="relative aspect-[4/5] overflow-hidden sm:aspect-[16/10]" id="showcase-frame">
                {MOMENTS.map((m, i) => (
                  <div
                    key={m.key}
                    aria-hidden={i !== active}
                    className={`absolute inset-0 transition-[opacity,filter] duration-700 ease-out-expo ${i === active ? "opacity-100" : "opacity-0 blur-[3px]"}`}
                  >
                    <Capture m={m} eager={i === 0} sizes="(min-width: 1240px) 1160px, (min-width: 640px) 94vw, 160vw" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ul className="mt-6 grid gap-3 sm:mt-8 md:grid-cols-3" role="tablist" aria-label="Moments de Vigie">
        {MOMENTS.map((m, i) => {
          const on = i === active;
          return (
            <li key={m.key}>
              <button
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="showcase-frame"
                onClick={() => setActive(i)}
                className={`flex h-full w-full items-center gap-4 rounded-[20px] border p-2.5 text-left transition-[background-color,border-color,box-shadow] duration-500 ease-out-expo md:flex-col md:items-stretch md:p-3 ${
                  on ? "border-hairline bg-card shadow-card" : "border-transparent hover:bg-card/60"
                }`}
              >
                <span className="relative aspect-[16/10] w-28 shrink-0 overflow-hidden rounded-xl border border-hairline bg-card md:w-full">
                  {/* Crops are zoomed ~1.8x, so request a source wide enough to stay sharp after scaling. */}
                  <Capture m={m} eager={false} sizes="(min-width: 768px) 720px, 240px" crop={m.thumb} />
                </span>
                <span className="min-w-0 md:px-1.5 md:pb-1.5">
                  <span className={`block font-display text-ui font-bold ${on ? "text-ink" : "text-ink-soft"}`}>{m.title}</span>
                  <span className="mt-1 block text-small leading-snug text-ink-soft">{m.text}</span>
                  <span className="mt-3 block h-1 overflow-hidden rounded-full bg-wash" aria-hidden="true">
                    {on ? (
                      <span
                        key={`${active}-${paused}-${reduced}`}
                        className="block h-full origin-left rounded-full bg-signal"
                        style={paused || reduced ? { transform: "scaleX(1)" } : { animation: `progress ${DURATION}ms linear both` }}
                      />
                    ) : null}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
