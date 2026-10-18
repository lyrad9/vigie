"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { site } from "@/lib/site";
import { ThemeToggle } from "./client";
import { Icon, Logo } from "./ui";

// Absolute anchors so the nav also works from /about, /contact, /privacy and the 404.
const LINKS = [
  ["/#pourquoi", "Pourquoi Vigie"],
  ["/#controle", "Fonctionnalités"],
  ["/#agents", "Pour les agents"],
  ["/#faq", "Questions"],
];

/** Floating bar, 16px from the top, sticky. On mobile the links fold into a sheet. */
export function Nav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-3 z-50 px-3 sm:top-4 sm:px-6">
      <nav
        aria-label="Navigation principale"
        className="mx-auto flex h-[68px] max-w-[75rem] items-center gap-2 rounded-[20px] border border-hairline bg-card/90 pr-2 pl-4 shadow-card backdrop-blur-xl sm:pl-5"
      >
        <Link href="/" className="flex items-center gap-2.5 font-display text-brand font-black tracking-[-0.03em] text-ink" aria-label="Vigie, accueil">
          <Logo size={34} id="nav" />
          Vigie
        </Link>

        <ul className="mx-auto hidden items-center gap-1 lg:flex">
          {LINKS.map(([href, label]) => (
            <li key={href}>
              <a href={href} className="rounded-xl px-3.5 py-2.5 text-small font-medium text-ink-soft transition-colors hover:bg-wash hover:text-ink">
                {label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
          <ThemeToggle />
          <a
            href={site.repo}
            className="hidden h-11 items-center gap-2 rounded-xl px-3.5 text-small font-medium text-ink transition-colors hover:bg-wash md:flex"
          >
            {Icon.github}
            Code source
          </a>
          <a
            href={site.download}
            className="group hidden h-11 items-center gap-2 rounded-xl bg-button px-4 font-display text-small font-bold text-button-text shadow-button transition-[filter] hover:brightness-110 sm:flex"
          >
            Télécharger
            {Icon.download}
          </a>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpen((v) => !v)}
            className="grid size-11 place-items-center rounded-xl bg-wash text-ink lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 8h16M4 16h16" />}
            </svg>
          </button>
        </div>
      </nav>

      <div
        id="mobile-menu"
        hidden={!open}
        className="mx-auto mt-2 max-w-[75rem] rounded-[20px] border border-hairline bg-card p-2 shadow-card lg:hidden"
      >
        <ul>
          {LINKS.map(([href, label]) => (
            <li key={href}>
              <a href={href} onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-xl px-4 font-display text-lg font-bold text-ink hover:bg-wash">
                {label}
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-2 grid gap-2 border-t border-dashed border-hairline p-2 pt-4 sm:grid-cols-2">
          <a href={site.download} className="group flex h-12 items-center justify-center gap-2 rounded-xl bg-button font-display font-bold text-button-text shadow-button">
            Télécharger pour Windows
            {Icon.download}
          </a>
          <a href={site.repo} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-hairline font-display font-bold text-ink">
            {Icon.github}
            Code source
          </a>
        </div>
      </div>
    </header>
  );
}
