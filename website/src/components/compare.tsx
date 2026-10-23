"use client";

import { useState, type ReactNode } from "react";
import { BRAND, BRAND_COLOR } from "@/lib/brands";
import { Accent, Dot, Headline, Icon, InlineLogo, Logo } from "./ui";

type Tool = "codex" | "claude" | "cursor" | "you" | "vigie";
type Card = { tool: Tool; tag: string; title: string; command: boolean; text: string; tone: "ok" | "warn" | "bad" | "off"; tilt: number };

const WITHOUT: Card[] = [
  { tool: "codex", tag: "Codex", title: "pnpm dev", command: true, text: "Port 3000 occupé. Démarré sur 3001, sans prévenir personne.", tone: "warn", tilt: -1.6 },
  { tool: "claude", tag: "Claude Code", title: "pnpm dev", command: true, text: "Une deuxième copie de Next.js et de son watcher, sur 3002.", tone: "warn", tilt: 1.2 },
  { tool: "cursor", tag: "Cursor", title: "npm run dev", command: true, text: "« Le serveur ne répond pas. » Il tourne déjà, dans un autre onglet.", tone: "bad", tilt: -0.8 },
  { tool: "you", tag: "Vous", title: "Gestionnaire des tâches", command: false, text: "Cinq node.exe. Lequel est le bon, lequel arrêter ?", tone: "off", tilt: 1.6 },
  { tool: "codex", tag: "Codex", title: "pnpm dev", command: true, text: "Encore une copie, sur 3003. Le ventilateur s'emballe.", tone: "warn", tilt: -1 },
];

const WITH: Card[] = [
  { tool: "codex", tag: "Codex", title: "vigie status --json", command: true, text: "web tourne déjà sur :3000. Rien à lancer.", tone: "ok", tilt: -1.4 },
  { tool: "claude", tag: "Claude Code", title: "vigie port 3001", command: true, text: "Tenu par node.exe (pid 18528), lancé hors de Vigie. L'agent vous prévient au lieu de le tuer.", tone: "warn", tilt: 1.2 },
  { tool: "cursor", tag: "Cursor", title: "vigie logs web", command: true, text: "Toute la sortie au même endroit, même après la fermeture du terminal.", tone: "ok", tilt: -0.8 },
  { tool: "vigie", tag: "Vigie", title: "api relancé", command: false, text: "Le process a planté. Relancé tout seul, tentative 1 sur 5, de nouveau en ligne.", tone: "ok", tilt: 1.6 },
  { tool: "claude", tag: "Claude Code", title: "vigie status --json", command: true, text: "Toujours un seul serveur. L'agent ouvre localhost:3000.", tone: "ok", tilt: -1 },
];

/** A white tile holding the tool's real mark, like an app icon on a notification. */
function ToolIcon({ tool }: { tool: Tool }) {
  if (tool === "vigie") return <Logo size={42} id="compare-card" />;
  const path = tool === "codex" ? BRAND.openai : tool === "claude" ? BRAND.claude : tool === "cursor" ? BRAND.cursor : null;
  const color = tool === "claude" ? BRAND_COLOR.claude : undefined;
  return (
    <span className="grid size-[42px] shrink-0 place-items-center rounded-[13px] border border-hairline bg-card shadow-[0_1px_2px_oklch(0.2_0.02_262/0.08)]">
      {path ? (
        <svg viewBox="0 0 24 24" className="size-[22px] text-ink" fill={color ?? "currentColor"} aria-hidden="true">
          <path d={path} />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-5 text-ink-soft" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="15" rx="2.5" />
          <path d="M7 14.5l3-3.5 2.5 2.5L17 9" />
        </svg>
      )}
    </span>
  );
}

const LIST = {
  without: [
    "Un serveur relancé à chaque nouvelle tâche",
    "Des ports de repli que personne n'a notés",
    "Des logs éclatés entre les onglets",
    "Des process orphelins après chaque session",
    "Aucune vue d'ensemble sur ce qui tourne",
    "Une machine qui fait cinq fois le même travail",
  ],
  with: [
    "Un process par serveur, quel que soit le nombre d'agents",
    "L'état lu en JSON avant chaque lancement",
    "Un port refusé plutôt qu'un port de repli",
    "Toute la sortie dans une seule fenêtre",
    "Les serveurs plantés relancés tout seuls",
    "Rien n'est arrêté sans votre accord",
  ],
};

/** Both stacks share one grid cell, so the tray always takes the height of the taller one. */
function Stack({ cards, visible }: { cards: Card[]; visible: boolean }) {
  return (
    <ul
      aria-hidden={!visible}
      className={`col-start-1 row-start-1 grid content-start transition-[opacity,transform,filter] duration-700 ease-out-expo ${
        visible ? "opacity-100 blur-0" : "pointer-events-none translate-y-6 opacity-0 blur-sm"
      }`}
    >
      {cards.map((c, i) => (
        <li
          key={c.text}
          style={{ transform: `rotate(${visible ? c.tilt : 0}deg)`, transitionDelay: `${visible ? i * 60 : 0}ms`, zIndex: cards.length - i }}
          className={`relative flex gap-3.5 rounded-[20px] border border-hairline bg-card px-4 py-4 shadow-[0_1px_1px_oklch(0.2_0.02_262/0.04),0_2px_4px_oklch(0.2_0.02_262/0.04),0_14px_30px_-14px_oklch(0.2_0.02_262/0.28)] transition-transform duration-700 ease-out-expo sm:px-5 ${
            i ? "-mt-1.5" : ""
          }`}
        >
          <ToolIcon tool={c.tool} />
          <span className="min-w-0 pt-0.5">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <Dot tone={c.tone} />
              <span className={c.command ? "font-mono text-code font-semibold text-ink" : "font-display text-small font-bold text-ink"}>{c.title}</span>
              <span className="text-caption text-ink-faint">· {c.tag}</span>
            </span>
            <span className="mt-1 block text-small leading-snug text-ink-soft">{c.text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Compare() {
  const [withVigie, setWithVigie] = useState(false);
  const key = withVigie ? "with" : "without";

  return (
    <section id="pourquoi" className="py-24 sm:py-36">
      {/* Phones read: title, switch, tray, list. From lg the tray takes the left column. */}
      <div className="mx-auto grid max-w-[75rem] grid-cols-1 gap-x-16 px-5 [grid-template-areas:'head''tabs''panel''list'] sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:[grid-template-areas:'panel_head''panel_tabs''panel_list']">
        <div className="[grid-area:panel] mt-8 lg:mt-0 lg:self-stretch">
          {/* The tray: a white bezel around a recessed grey well, lit from above, resting on a soft shadow. */}
          <div className="h-full rounded-[34px] bg-card p-2 shadow-[0_0_0_1px_var(--hairline),0_2px_4px_oklch(0.2_0.02_262/0.04),0_30px_60px_-30px_oklch(0.2_0.02_262/0.35)] dark:shadow-[0_0_0_1px_var(--hairline),0_30px_60px_-30px_oklch(0_0_0/0.8)]">
            <div className="relative h-full overflow-hidden rounded-[27px] bg-wash px-5 pt-20 pb-6 shadow-[inset_0_1px_2px_oklch(0.2_0.02_262/0.08),inset_0_10px_30px_-18px_oklch(0.2_0.02_262/0.18)] sm:px-9 lg:min-h-[36rem]">
              <span className="absolute top-5 left-5 z-10 inline-flex items-center gap-2 rounded-full border border-hairline bg-card px-3.5 py-1.5 text-small font-medium text-ink shadow-[0_1px_2px_oklch(0.2_0.02_262/0.08)]">
                {withVigie ? Icon.check : Icon.cross}
                {withVigie ? "Avec Vigie" : "Sans Vigie"}
              </span>
              <div className="grid">
                <Stack cards={WITHOUT} visible={!withVigie} />
                <Stack cards={WITH} visible={withVigie} />
              </div>
              {/* The last card sinks into the well instead of ending on a hard edge. */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-28 bg-gradient-to-t from-wash via-wash/85 to-transparent" />
            </div>
          </div>
        </div>

        <div className="[grid-area:head] lg:self-end">
          <Headline className="text-[clamp(1.85rem,3.3vw,2.75rem)] leading-[1.1]">
            Un seul{" "}
            <span className="whitespace-nowrap">
              serveur <InlineLogo id="compare" />
            </span>{" "}
            lu par{" "}
            <span className="whitespace-nowrap">
              <Accent>tous vos agents</Accent>
            </span>
          </Headline>
          <div className="mt-8 border-t border-dashed border-hairline-strong" />
        </div>

        <div className="[grid-area:tabs] mt-8">
          <div role="tablist" aria-label="Comparer" className="inline-flex rounded-2xl bg-wash p-1.5">
            {[
              [false, "Sans Vigie", Icon.cross],
              [true, "Avec Vigie", Icon.check],
            ].map(([value, label, icon]) => (
              <button
                key={label as string}
                type="button"
                role="tab"
                aria-selected={withVigie === value}
                onClick={() => setWithVigie(value as boolean)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-small font-medium transition-[background-color,box-shadow,color] duration-300 ${
                  withVigie === value ? "bg-card text-ink shadow-card" : "text-ink-soft hover:text-ink"
                }`}
              >
                {icon as ReactNode}
                {label as string}
              </button>
            ))}
          </div>

          <p className="mt-6 text-lg text-ink-soft" role="tabpanel">
            {withVigie
              ? "Chaque agent demande avant d'agir. Un seul process tourne, et tout le monde sait où le trouver."
              : "Des serveurs en double, des ports au hasard, et personne pour dire ce qui tourne."}
          </p>
        </div>

        <div className="[grid-area:list] mt-8 lg:self-start">
          <ul key={key} className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {LIST[key].map((item, i) => (
              <li key={item} className="rise flex gap-2.5 text-base leading-snug text-ink" style={{ ["--i" as string]: i }}>
                {withVigie ? Icon.check : Icon.cross}
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
