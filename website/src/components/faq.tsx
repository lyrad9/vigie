"use client";

import { useState, type ReactNode } from "react";
import { Accent, Headline, Lede } from "./ui";

const code = (s: string) => <code className="font-mono text-[0.92em] text-ink">{s}</code>;

const GROUPS: { label: string; items: { q: string; a: ReactNode }[] }[] = [
  {
    label: "Utilisation",
    items: [
      {
        q: "Comment Vigie lance-t-il mes serveurs ?",
        a: (
          <>
            Avec la commande que vous tapez d&apos;habitude ({code("pnpm dev")}, {code("npm run dev")}, {code("python manage.py runserver")}…), dans votre
            shell, avec la variable {code("PORT")} définie. Vigie surveille ensuite le process, sa santé et sa sortie.
          </>
        ),
      },
      {
        q: "Que se passe-t-il quand je ferme la fenêtre ?",
        a: "Vos serveurs continuent de tourner : Vigie reste dans la zone de notification. Quitter Vigie les arrête, et ceux qui tournaient repartent au lancement suivant.",
      },
      {
        q: "Ça marche avec Vite, Next.js, Django, Rails… ?",
        a: (
          <>
            Avec tout ce qui se lance par une commande. Vigie reconnaît Next.js, Vite, Astro, Nuxt, SvelteKit, Angular, Django et Rails pour pré-remplir la
            commande et le port. Pour Vite, gardez {code("--port 5173 --strictPort")} afin qu&apos;il ne bascule jamais en silence sur un autre port.
          </>
        ),
      },
      {
        q: "Et sur macOS ou Linux ?",
        a: (
          <>
            L&apos;installateur est pour Windows. Sur macOS et Linux, Vigie se construit depuis les sources ({code("npm install && npm run app")}) et la
            commande {code("vigie")} fonctionne de la même façon.
          </>
        ),
      },
    ],
  },
  {
    label: "Agents",
    items: [
      {
        q: "Quels agents sont compatibles ?",
        a: (
          <>
            Tous ceux qui savent lancer une commande : Claude Code, Codex, Cursor ou vos propres scripts. Le skill est copié dans {code("~/.agents/skills")}{" "}
            et {code("~/.claude/skills")}. Sans skill, l&apos;API HTTP sur {code("127.0.0.1:7744")} suffit.
          </>
        ),
      },
      {
        q: "Comment l'agent sait-il qu'il doit passer par Vigie ?",
        a: (
          <>
            Le skill lui apprend une seule règle : ne jamais lancer de serveur de dev sans avoir lu {code("vigie status --json")}. S&apos;il tourne déjà, il
            utilise l&apos;URL ; sinon il le démarre avec {code("vigie start")}.
          </>
        ),
      },
      {
        q: "La commande vigie n'est pas reconnue ?",
        a: "Ouvrez le menu de l'icône Vigie près de l'horloge et choisissez « Install command-line tool », puis ouvrez un nouveau terminal.",
      },
    ],
  },
  {
    label: "Sécurité",
    items: [
      {
        q: "Vigie envoie-t-il des données quelque part ?",
        a: "Non. Pas de compte, pas de télémétrie. L'API écoute uniquement sur 127.0.0.1 et refuse les requêtes venant d'autres sites.",
      },
      {
        q: "Vigie peut-il arrêter un process tout seul ?",
        a: "Jamais. Il arrête ce qu'il a lancé quand vous le demandez, et ne touche à un process lancé ailleurs qu'après une demande explicite. Les services système sont en lecture seule.",
      },
      {
        q: "Pourquoi Windows affiche-t-il un avertissement à l'installation ?",
        a: "L'installateur n'est pas encore signé. Au premier lancement, Windows SmartScreen affiche « Informations complémentaires » puis « Exécuter quand même ». Le code est lisible sur GitHub.",
      },
    ],
  },
];

export function Faq() {
  const [group, setGroup] = useState(0);
  const [open, setOpen] = useState<string | null>(GROUPS[0].items[0].q);

  return (
    <section id="faq" className="py-24 sm:py-32" aria-labelledby="faq-title">
      <div className="mx-auto max-w-[50rem] px-5 sm:px-8">
        <Headline id="faq-title" className="text-center text-[clamp(1.85rem,3.3vw,2.75rem)] leading-[1.1]">
          Les questions <Accent>fréquentes</Accent>
        </Headline>
        <Lede className="mx-auto mt-5 text-center">Une question qui n&apos;est pas ici ? Ouvrez une discussion sur GitHub.</Lede>

        <div className="rail mt-10 flex justify-start overflow-x-auto sm:justify-center">
          <div role="tablist" aria-label="Thèmes" className="inline-flex shrink-0 rounded-2xl bg-wash p-1.5">
            {GROUPS.map((g, i) => (
              <button
                key={g.label}
                type="button"
                role="tab"
                aria-selected={group === i}
                onClick={() => {
                  setGroup(i);
                  setOpen(GROUPS[i].items[0].q);
                }}
                className={`min-h-11 rounded-xl px-5 text-small font-medium transition-[background-color,box-shadow,color] duration-300 ${
                  group === i ? "bg-card text-ink shadow-card" : "text-ink-soft hover:text-ink"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* One white card per question; the plus folds its vertical stroke away to become a minus. */}
        <ul className="mt-10 grid gap-4" role="tabpanel">
          {GROUPS[group].items.map(({ q, a }, i) => {
            const isOpen = open === q;
            const id = `faq-answer-${group}-${i}`;
            return (
              <li key={q} className="overflow-hidden rounded-2xl border border-hairline bg-card">
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={id}
                    onClick={() => setOpen(isOpen ? null : q)}
                    className="flex min-h-16 w-full items-center justify-between gap-6 px-5 py-4 text-left font-display text-ui font-medium text-ink transition-colors hover:bg-wash/60 sm:px-6"
                  >
                    {q}
                    <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-ink" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                      <path d="M5 12h14" />
                      <path
                        d="M12 5v14"
                        className={`origin-center transition-transform duration-500 ease-out-expo ${isOpen ? "scale-y-0" : "scale-y-100"}`}
                      />
                    </svg>
                  </button>
                </h3>
                <div id={id} className={`grid transition-[grid-template-rows] duration-500 ease-out-expo ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="overflow-hidden">
                    <p className="border-t border-hairline px-5 py-5 text-small leading-relaxed text-ink-soft sm:px-6">
                      <span className="block max-w-[62ch]">{a}</span>
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
