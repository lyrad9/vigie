import type { ReactNode } from "react";
import { site } from "@/lib/site";
import { Icon } from "./ui";

type Variant = "hero" | "nav" | "sheet" | "band" | "footer";

/** 8 → "8", 1234 → "1,2 k", 12345 → "12 k". French comma, like every other number on the site. */
function format(count: number): string {
  if (count < 1000) return String(count);
  const k = count / 1000;
  return `${k.toFixed(k < 10 ? 1 : 0).replace(".", ",")} k`;
}

// Each variant wears the button it replaces, so the bar, the hero, the dark band and the footer
// keep their own shapes.
const SHELL: Record<Variant, string> = {
  hero: "inline-flex h-14 items-center justify-center gap-2.5 rounded-[14px] border border-hairline bg-card px-6 font-display text-ui font-bold text-ink shadow-card transition-[border-color,background-color] duration-300 hover:border-hairline-strong hover:bg-wash",
  nav: "hidden h-11 items-center gap-2 rounded-xl px-3.5 text-small font-medium text-ink transition-colors hover:bg-wash md:flex",
  sheet: "flex h-12 items-center justify-center gap-2 rounded-xl border border-hairline font-display font-bold text-ink",
  band: "inline-flex h-14 items-center justify-center gap-2.5 rounded-[14px] border border-white/12 bg-band-raised px-6 font-display text-ui font-bold text-white transition-[border-color] duration-300 hover:border-white/25",
  footer:
    "inline-flex h-11 items-center gap-2.5 rounded-xl border border-hairline bg-card px-4 text-small font-medium text-ink transition-[background-color,border-color] hover:border-hairline-strong hover:bg-wash",
};

const PILL_LIGHT =
  "inline-flex items-center gap-1 rounded-lg bg-wash px-2 py-0.5 font-display text-[0.8125rem] font-bold text-ink-soft tabular-nums transition-colors group-hover:bg-card group-hover:text-ink";
const PILL_BAND =
  "inline-flex items-center gap-1 rounded-lg border border-white/12 bg-white/5 px-2 py-0.5 font-display text-[0.8125rem] font-bold text-band-muted tabular-nums transition-colors group-hover:border-white/25 group-hover:text-white";

const PILL: Record<Variant, string> = { hero: PILL_LIGHT, nav: PILL_LIGHT, sheet: PILL_LIGHT, footer: PILL_LIGHT, band: PILL_BAND };

const glyph = (
  <svg viewBox="0 0 24 24" className="size-[13px] shrink-0" fill="currentColor" aria-hidden="true">
    <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45L2.6 9.45l6.5-.95z" />
  </svg>
);

/**
 * The one ask on the page that is not a download: star the repo, with its live count.
 * GitHub has no one-click star URL for a visitor who is not signed in, so this opens the repo in
 * a new tab — where Star sits at the top right — and leaves the landing page open behind it.
 */
export function StarButton({
  stars,
  variant,
  className = "",
  children,
}: {
  stars: number | null;
  variant: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={site.repo}
      target="_blank"
      rel="noreferrer"
      title={`Mettre une étoile au dépôt ${site.repoSlug} sur GitHub`}
      className={`group ${SHELL[variant]} ${className}`}
    >
      {Icon.github}
      {children}
      {stars === null ? null : (
        <span className={PILL[variant]}>
          {glyph}
          {format(stars)}
        </span>
      )}
    </a>
  );
}
