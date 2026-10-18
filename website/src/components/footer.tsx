import { site } from "@/lib/site";
import { ThemeToggle } from "./client";
import { Icon, Logo } from "./ui";

const COLUMNS: { title: string; links: [string, string, boolean?][] }[] = [
  {
    title: "Produit",
    links: [
      ["Pourquoi Vigie", "#pourquoi"],
      ["Fonctionnalités", "#controle"],
      ["Pour les agents", "#agents"],
      ["Questions", "#faq"],
    ],
  },
  {
    title: "Ressources",
    links: [
      ["Télécharger", site.download, true],
      ["Code source", site.repo, true],
      ["Skill agent", site.skill, true],
      ["Notes de version", `${site.repo}/releases`, true],
    ],
  },
  {
    title: "Projet",
    links: [
      ["Signaler un problème", `${site.repo}/issues`, true],
      ["Contribuer", `${site.repo}/pulls`, true],
      ["Licence MIT", `${site.repo}/blob/main/LICENSE`, true],
    ],
  },
];

/** A white chart sheet signed with the wordmark, cut by the bottom edge. */
export function Footer() {
  return (
    <footer className="px-3 pt-20 pb-3 sm:px-4 sm:pt-24">
      <div className="relative isolate overflow-hidden rounded-[28px] border border-hairline bg-card shadow-card">
        <div className="mx-auto max-w-[75rem] px-6 pt-14 sm:px-10 sm:pt-16">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)] lg:gap-16">
            <div>
              <a href="#" className="inline-flex items-center gap-3 font-display text-brand font-black tracking-[-0.03em] text-ink" aria-label="Vigie, haut de page">
                <Logo size={40} id="footer" />
                Vigie
              </a>
              <p className="mt-5 max-w-[32ch] text-lg leading-relaxed text-ink-soft">
                Un seul superviseur pour tous vos serveurs locaux, lu par tous vos agents.
              </p>
              <a
                href={site.repo}
                className="mt-7 inline-flex min-h-11 items-center gap-2.5 rounded-xl border border-hairline bg-card px-4 text-small font-medium text-ink transition-[background-color,border-color] hover:border-hairline-strong hover:bg-wash"
              >
                {Icon.github}
                lyrad9/vigie
              </a>
            </div>

            <nav className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3" aria-label="Pied de page">
              {COLUMNS.map((col) => (
                <div key={col.title}>
                  <p className="font-display text-ui font-bold text-ink">{col.title}</p>
                  <ul className="mt-3 grid">
                    {col.links.map(([label, href, external]) => (
                      <li key={label}>
                        <a href={href} className="group inline-flex min-h-11 items-center gap-1.5 text-small text-ink-soft transition-colors hover:text-ink">
                          {label}
                          {external ? <span className="text-ink-faint opacity-0 transition-opacity group-hover:opacity-100">{Icon.external}</span> : null}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>

          <div className="mt-14 flex flex-col-reverse gap-4 border-t border-dashed border-hairline-strong pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-small text-ink-soft">
              © 2026 Vigie · Fait par{" "}
              <a
                href={site.author.url}
                className="inline-flex items-center gap-1 font-medium text-ink underline decoration-hairline-strong underline-offset-4 transition-colors hover:decoration-ink"
              >
                {site.author.name}
                <span className="text-ink-faint">{Icon.external}</span>
              </a>
            </p>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <a href="#" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-small font-medium text-ink-soft transition-colors hover:bg-wash hover:text-ink">
                Haut de page
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 19V5m-6 6 6-6 6 6" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <p
          aria-hidden="true"
          className="pointer-events-none mt-4 -mb-[0.2em] text-center font-display text-[clamp(6.5rem,27vw,23rem)] leading-[0.8] font-black tracking-[-0.06em] text-wash select-none"
        >
          Vigie
        </p>
      </div>
    </footer>
  );
}
