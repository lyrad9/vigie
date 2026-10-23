import { BRAND } from "@/lib/brands";
import { site } from "@/lib/site";
import { RangeRings } from "./hero";
import { Headline, Icon, Lede, Logo } from "./ui";

const PROMPT = `Explique-moi ce que fait Vigie (${site.repo}), un superviseur de serveurs de dev local pour les développeurs qui codent avec des agents IA. Est-ce utile si je lance plusieurs agents (Claude Code, Codex, Cursor) en parallèle sur le même projet ?`;
const q = encodeURIComponent(PROMPT);

// The mark of the assistant each button opens (simple-icons, CC0).
const MARKS = {
  ChatGPT: BRAND.openai,
  Claude: BRAND.claude,
  Perplexity: BRAND.perplexity,
} as const;

const ASSISTANTS: [keyof typeof MARKS, string][] = [
  ["ChatGPT", `https://chatgpt.com/?q=${q}`],
  ["Claude", `https://claude.ai/new?q=${q}`],
  ["Perplexity", `https://www.perplexity.ai/search?q=${q}`],
];

export function AskAI() {
  return (
    <section className="px-3 py-12 sm:px-8 sm:py-20" aria-labelledby="ask-title">
      <div className="dot-field relative isolate mx-auto max-w-[75rem] overflow-hidden rounded-[28px] border border-hairline bg-card px-5 py-16 text-center shadow-card sm:px-10 sm:py-20">
        <RangeRings strength={1.9} className="pointer-events-none absolute -top-[22rem] -left-[18rem] -z-10 w-[44rem] max-w-none" />
        <RangeRings strength={1.9} className="pointer-events-none absolute -right-[16rem] -bottom-[24rem] -z-10 w-[44rem] max-w-none" />

        <span className="inline-flex items-center gap-2.5 rounded-2xl border border-hairline bg-card px-4 py-2.5 font-display text-title font-extrabold tracking-[-0.03em] text-ink shadow-card">
          <Logo size={30} id="ask" />
          Vigie
        </span>

        <Headline id="ask-title" className="mx-auto mt-8 max-w-[22ch] text-[clamp(1.7rem,3vw,2.35rem)] leading-[1.12]">
          Pas sûr que Vigie soit fait pour vous ?
        </Headline>
        <Lede className="mx-auto mt-4">
          Demandez à l&apos;IA que vous utilisez déjà. Chaque bouton ouvre une conversation avec la question posée sur Vigie et son code
          source.
        </Lede>

        <ul className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          {ASSISTANTS.map(([name, href]) => (
            <li key={name}>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex h-14 w-full items-center justify-center gap-3 rounded-[14px] bg-band pr-5 pl-4 font-display text-ui font-bold text-band-text shadow-button transition-[background-color,color,box-shadow] duration-300 hover:bg-[var(--signal-press)] hover:text-white hover:shadow-[var(--shadow-signal)] sm:w-auto dark:ring-1 dark:ring-white/10"
              >
                <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-white" fill="currentColor" aria-hidden="true">
                  <path d={MARKS[name]} />
                </svg>
                Demander à {name}
                <span className="text-band-muted transition-colors group-hover:text-white">{Icon.external}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
