import { Fragment, type ReactNode } from "react";
import type { Block } from "@/lib/content.ts";

const link = "font-medium text-ink underline decoration-hairline-strong underline-offset-4 transition-colors hover:decoration-ink";

/** Renders the inline Markdown subset used in content.ts: [label](url), `code` and **bold**. */
export function Inline({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*/g;
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push(
        <a key={m.index} href={m[2]} className={link}>
          {m[1]}
        </a>,
      );
    } else if (m[3] !== undefined) {
      out.push(
        <code key={m.index} className="font-mono text-[0.92em] text-ink">
          {m[3]}
        </code>,
      );
    } else {
      out.push(
        <strong key={m.index} className="font-semibold text-ink">
          {m[4]}
        </strong>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

export function Prose({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => (
        <Fragment key={i}>
          {b.type === "h2" ? (
            <h2 className="mt-12 font-display text-[1.6rem] leading-tight font-bold tracking-[-0.025em] text-ink first:mt-0">{b.text}</h2>
          ) : b.type === "p" ? (
            <p className="mt-4 max-w-[65ch] text-lg leading-relaxed text-pretty text-ink-soft">
              <Inline text={b.text} />
            </p>
          ) : b.type === "ul" ? (
            <ul className="mt-5 grid max-w-[65ch] gap-3">
              {b.items.map((item) => (
                <li key={item} className="flex gap-3.5 text-lg leading-relaxed text-ink-soft">
                  <span aria-hidden="true" className="mt-[0.85em] h-px w-3 shrink-0 bg-ink-faint" />
                  <span>
                    <Inline text={item} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <pre className="mt-5 overflow-x-auto rounded-2xl border border-hairline bg-wash p-5 font-mono text-small leading-relaxed text-ink">
              <code>{b.text}</code>
            </pre>
          )}
        </Fragment>
      ))}
    </>
  );
}
