import type { ComponentProps, CSSProperties, ReactNode } from "react";

export function Logo({ size = 28, id = "logo" }: { size?: number; id?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={`vigie-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3B9BFF" />
          <stop offset="1" stopColor="#0A60E0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#vigie-${id})`} />
      <circle cx="32" cy="26" r="9" fill="none" stroke="#fff" strokeWidth="4" />
      <circle cx="32" cy="26" r="3" fill="#fff" />
      <path d="M14 46h36M20 46v-4M32 46v-11M44 46v-4" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** The logo as an inline glyph inside a headline, sized to the cap height (ekklo's inline tile). */
export function InlineLogo({ id }: { id: string }) {
  return (
    <span className="relative -top-[0.06em] mx-[0.08em] inline-block size-[0.82em] rotate-[-6deg] align-middle drop-shadow-[0_6px_12px_oklch(0.52_0.2_262/0.35)]">
      <svg viewBox="0 0 64 64" className="size-full" aria-hidden="true">
        <defs>
          <linearGradient id={`vigie-inline-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3B9BFF" />
            <stop offset="1" stopColor="#0A60E0" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill={`url(#vigie-inline-${id})`} />
        <circle cx="32" cy="26" r="9" fill="none" stroke="#fff" strokeWidth="4" />
        <circle cx="32" cy="26" r="3" fill="#fff" />
        <path d="M14 46h36M20 46v-4M32 46v-11M44 46v-4" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** The one accent of a headline: the same weight, upright, in Signal Blue. */
export function Accent({ children }: { children: ReactNode }) {
  return <em className="font-display font-extrabold not-italic text-signal">{children}</em>;
}

export function Headline({
  children,
  className = "",
  as: Tag = "h2",
  style,
  id,
}: {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2";
  style?: CSSProperties;
  id?: string;
}) {
  return (
    <Tag id={id} style={style} className={`font-display font-extrabold tracking-[-0.03em] text-balance text-ink ${className}`}>
      {children}
    </Tag>
  );
}

export function Lede({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <p style={style} className={`max-w-[62ch] text-lg leading-relaxed text-pretty text-ink-soft ${className}`}>
      {children}
    </p>
  );
}

type LinkProps = ComponentProps<"a"> & { icon?: ReactNode };

export function PrimaryButton({ children, icon, className = "", ...props }: LinkProps) {
  return (
    <a
      {...props}
      className={`group inline-flex h-14 items-center justify-center gap-3 rounded-[14px] bg-button px-7 font-display text-ui font-bold text-button-text shadow-button transition-[background-color,color,box-shadow] duration-300 hover:bg-[var(--signal-press)] hover:text-white hover:shadow-[var(--shadow-signal)] ${className}`}
    >
      {children}
      {icon}
    </a>
  );
}

export function QuietButton({ children, icon, className = "", ...props }: LinkProps) {
  return (
    <a
      {...props}
      className={`inline-flex h-14 items-center justify-center gap-2.5 rounded-[14px] border border-hairline bg-card px-6 font-display text-ui font-bold text-ink shadow-card transition-[border-color,background-color] duration-300 hover:border-hairline-strong hover:bg-wash ${className}`}
    >
      {icon}
      {children}
    </a>
  );
}

export function Dot({ tone, pulse = false }: { tone: "ok" | "warn" | "bad" | "off"; pulse?: boolean }) {
  const color = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", off: "bg-ink-faint" }[tone];
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2 shrink-0 rounded-full ${color} ${tone === "ok" ? "shadow-[0_0_0_3px_color-mix(in_oklch,var(--ok)_22%,transparent)]" : ""}`}
      style={pulse ? { animation: "blink 1.1s ease-in-out infinite" } : undefined}
    />
  );
}

/* ------------------------------------------------------------------ icons */

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Icon = {
  download: (
    <svg viewBox="0 0 24 24" className="size-5 transition-transform duration-300 ease-out-expo group-hover:translate-y-0.5" {...stroke} aria-hidden="true">
      <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" className="size-[18px] transition-transform duration-300 ease-out-expo group-hover:translate-x-0.5" {...stroke} aria-hidden="true">
      <path d="M5 12h14m-5-5 5 5-5 5" />
    </svg>
  ),
  external: (
    <svg viewBox="0 0 24 24" className="size-4" {...stroke} aria-hidden="true">
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" className="size-[18px] shrink-0 text-signal" {...stroke} strokeWidth={2.4} aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  ),
  cross: (
    <svg viewBox="0 0 24 24" className="size-[18px] shrink-0 text-ink-faint" {...stroke} strokeWidth={2.2} aria-hidden="true">
      <path d="M7 7l10 10M17 7 7 17" />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  ),
  windows: (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M3 5.5 10.5 4.5v7H3zM11.5 4.4 21 3v8.5h-9.5zM3 12.5h7.5v7L3 18.5zM11.5 12.5H21V21l-9.5-1.4z" />
    </svg>
  ),
};
