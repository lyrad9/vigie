"use client";

import { useRef, type ReactNode } from "react";
import { site } from "@/lib/site";
import { Accent, Dot, Headline, Icon, QuietButton } from "./ui";

const dim = (v: string) => <span className="text-band-muted">{v}</span>;

function Cmd({ children }: { children: string }) {
  return (
    <p className="font-mono text-caption text-band-muted">
      $ <span className="font-semibold text-white">{children}</span>
    </p>
  );
}

/** 1. The state as a table, the way an agent reads it. */
function StatusVignette() {
  const rows = [
    ["atlas/web", ":3000", "running", "ok"],
    ["atlas/api", ":4000", "running", "ok"],
    ["boutique/dev", ":5173", "running", "ok"],
    ["docs/site", ":4321", "stopped", "off"],
  ] as const;
  return (
    <>
      <Cmd>vigie status</Cmd>
      <ul className="mt-4 grid gap-1.5">
        {rows.map(([name, port, state, tone]) => (
          <li key={name} className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2 font-mono text-code">
            <Dot tone={tone} />
            <span className="text-white">{name}</span>
            <span className="ml-auto text-band-muted">{port}</span>
            <span className={`w-16 text-right text-caption ${tone === "ok" ? "text-band-text" : "text-band-muted"}`}>{state}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** 2. The working folder resolves to the server registered for it. */
function ResolveVignette() {
  return (
    <>
      <Cmd>vigie resolve</Cmd>
      <div className="mt-5 flex items-center gap-3">
        <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
          <p className="text-caption text-band-muted">Dossier de l&apos;agent</p>
          <p className="mt-1 truncate font-mono text-code text-white">D:\dev\atlas</p>
        </div>
        <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-signal" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M5 12h14m-5-5 5 5-5 5" />
        </svg>
        <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
          <p className="text-caption text-band-muted">Serveur</p>
          <p className="mt-1 flex items-center gap-2 font-mono text-code text-white">
            <Dot tone="ok" /> web :3000
          </p>
        </div>
      </div>
      <p className="mt-4 font-mono text-caption text-band-muted">déjà en route · http://localhost:3000</p>
    </>
  );
}

/** 3. Who holds a port, and the refusal that follows. Matches the Ports capture. */
function PortVignette() {
  return (
    <>
      <Cmd>vigie port 3001</Cmd>
      <div className="mt-4 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <span className="font-mono text-title font-semibold text-white">:3001</span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="font-display font-bold text-white">node.exe</span>
            <span className="rounded-full bg-warn/15 px-2 py-0.5 text-caption font-semibold text-warn">Externe</span>
          </span>
          <span className="mt-0.5 block font-mono text-caption text-band-muted">pid 18528 · lancé hors de Vigie</span>
        </span>
      </div>
      <pre className="mt-3 overflow-x-auto font-mono text-caption leading-relaxed text-band-text">
        {dim("start → ")}
        <span className="text-syn-key">&quot;code&quot;</span>: <span className="text-syn-str">&quot;PORT_IN_USE&quot;</span>
      </pre>
    </>
  );
}

/** 4. The log tail, in the output's own colors. */
function LogVignette() {
  const lines: [string, string, string][] = [
    ["GET", "/", "200"],
    ["GET", "/pricing", "200"],
    ["GET", "/api/session", "401"],
    ["GET", "/dashboard", "200"],
  ];
  return (
    <>
      <Cmd>vigie logs web -f</Cmd>
      <pre className="mt-4 overflow-x-auto font-mono text-code leading-[1.8] text-band-text">
        <span className="text-[oklch(0.8_0.15_150)]">{" ✓ "}</span>
        {"Ready in 1184ms\n"}
        {lines.map(([m, path, code]) => (
          <span key={path}>
            {" "}
            <span className="font-semibold text-white">{m}</span> {path}{" "}
            <span className={code === "200" ? "text-[oklch(0.8_0.15_150)]" : "text-[oklch(0.84_0.13_80)]"}>{code}</span>
            {"\n"}
          </span>
        ))}
      </pre>
    </>
  );
}

/** 5. The skill, as the document it is. */
function SkillVignette() {
  return (
    <div className="rotate-[-1.5deg] rounded-2xl bg-[oklch(0.98_0.003_250)] p-5 text-[oklch(0.25_0.02_262)] shadow-[0_18px_30px_-18px_oklch(0_0_0/0.7)]">
      <p className="font-mono text-caption text-[oklch(0.5_0.02_262)]">~/.agents/skills/vigie/SKILL.md</p>
      <p className="mt-3 font-display text-title leading-tight font-extrabold">Inspect first, launch only if needed</p>
      <p className="mt-3 border-l-2 border-[oklch(0.52_0.2_262)] pl-3 text-small leading-snug">
        Never start a dev server yourself before asking Vigie.
      </p>
      <p className="mt-3 font-mono text-caption text-[oklch(0.5_0.02_262)]">vigie status --json → décider</p>
    </div>
  );
}

type Card = { title: string; text: string; icon: string; vignette: ReactNode };

const CARDS: Card[] = [
  {
    title: "L'état, avant tout",
    text: "Chaque serveur, son port, son état et sa santé. Avec --json, une réponse que l'agent lit sans rien deviner.",
    icon: "M4 17l6-6-6-6M12 19h8",
    vignette: <StatusVignette />,
  },
  {
    title: "Le bon serveur pour ce dossier",
    text: "L'agent travaille dans D:\\dev\\atlas : Vigie retrouve le projet enregistré pour ce dossier et son URL.",
    icon: "M3 7h6l2 2h10v10H3z",
    vignette: <ResolveVignette />,
  },
  {
    title: "Un refus clair, pas un port au hasard",
    text: "Si un autre programme tient le port, Vigie refuse le démarrage et dit qui. L'agent vous prévient au lieu de basculer ailleurs.",
    icon: "M12 9v4m0 4h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
    vignette: <PortVignette />,
  },
  {
    title: "Les logs, sans deuxième serveur",
    text: "La sortie de chaque serveur, en mémoire et dans un fichier. L'agent la lit au lieu de relancer pour « voir ce qui se passe ».",
    icon: "M4 6h16M4 10h10M4 14h16M4 18h8",
    vignette: <LogVignette />,
  },
  {
    title: "Une règle, apprise une fois",
    text: "Le skill Vigie s'installe dans ~/.agents/skills et ~/.claude/skills. Il tient en une phrase.",
    icon: "M12 3l2.6 5.6L20 9.3l-4 4 1 5.7-5-2.8-5 2.8 1-5.7-4-4 5.4-.7z",
    vignette: <SkillVignette />,
  },
];

export function AgentRail() {
  const rail = useRef<HTMLUListElement>(null);
  const scroll = (dir: number) => {
    const el = rail.current;
    if (!el) return;
    const card = el.querySelector("li");
    el.scrollBy({ left: dir * ((card?.clientWidth ?? 400) + 20), behavior: "smooth" });
  };

  return (
    <section id="agents" className="overflow-x-clip py-24 sm:py-32" aria-labelledby="agents-title">
      <div className="mx-auto max-w-[75rem] px-5 sm:px-8">
        <Headline id="agents-title" className="max-w-[18ch] text-[clamp(1.85rem,3.3vw,2.75rem)] leading-[1.1]">
          Votre agent lit l&apos;état, <Accent>puis décide.</Accent>
        </Headline>
        <div className="mt-8 flex items-center justify-between gap-4">
          <QuietButton href={site.skill} icon={Icon.external}>
            Lire le skill
          </QuietButton>
          <div className="hidden gap-2 sm:flex">
            {[
              [-1, "Carte précédente", "m15 18-6-6 6-6"],
              [1, "Carte suivante", "m9 18 6-6-6-6"],
            ].map(([dir, label, d]) => (
              <button
                key={label as string}
                type="button"
                aria-label={label as string}
                aria-controls="agent-rail"
                onClick={() => scroll(dir as number)}
                className="grid size-14 place-items-center rounded-2xl border border-hairline bg-card text-ink shadow-card transition-colors duration-300 hover:bg-wash"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d={d as string} />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Side padding lines the first card up with the container; scroll-padding keeps snapping aligned to it.
          The bottom padding leaves room for the card shadow, which the scroller would otherwise clip. */}
      <ul
        id="agent-rail"
        ref={rail}
        className="rail mt-12 -mb-10 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-[var(--rail-pad)] pb-16 [--rail-pad:1.25rem] [scroll-padding-inline:var(--rail-pad)] sm:[--rail-pad:max(2rem,calc((100vw-75rem)/2+2rem))]"
        aria-label="Ce que lit un agent"
      >
        {CARDS.map((c) => (
          <li
            key={c.title}
            className="relative flex w-[min(86vw,29rem)] shrink-0 snap-start flex-col overflow-hidden rounded-[28px] bg-band p-3 text-band-text shadow-[0_24px_40px_-28px_oklch(0.165_0.012_262/0.85)] dark:ring-1 dark:ring-white/10"
          >
            <div className="relative flex min-h-[14rem] flex-col justify-center rounded-[20px] border border-white/[0.08] bg-band-raised p-5">{c.vignette}</div>
            <div className="relative flex flex-1 flex-col px-3 pt-7 pb-5">
              <h3 className="flex items-center gap-2.5 font-display text-title font-bold text-white">
                <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-signal" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={c.icon} />
                </svg>
                {c.title}
              </h3>
              <p className="mt-2.5 text-small leading-relaxed text-band-muted">{c.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
