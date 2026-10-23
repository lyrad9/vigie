import type { ReactNode } from "react";
import { site } from "@/lib/site";
import { Accent, Dot, Headline, Icon, Logo } from "./ui";

function StepCard({
  n,
  dark = false,
  title,
  text,
  icon,
  children,
}: {
  n: number;
  dark?: boolean;
  title: string;
  text: ReactNode;
  icon: string;
  children: ReactNode;
}) {
  return (
    <li
      className={`flex flex-col rounded-[28px] p-3 ${
        dark ? "bg-band text-band-text shadow-[0_24px_40px_-28px_oklch(0.165_0.012_262/0.8)] dark:ring-1 dark:ring-white/10" : "border border-hairline bg-card shadow-card"
      }`}
    >
      <div className={`flex items-center gap-3 rounded-[20px] px-3 py-2.5 ${dark ? "bg-band-raised" : "bg-wash"}`}>
        <span className={`grid size-9 place-items-center rounded-full font-display text-ui font-extrabold ${dark ? "bg-white/10 text-white" : "bg-card text-ink shadow-card"}`}>
          {n}
        </span>
        <span className={`font-display text-ui font-bold ${dark ? "text-white" : "text-ink"}`}>Étape {n}</span>
      </div>
      <div className="relative grid min-h-[15rem] place-items-center px-2 py-6">{children}</div>
      <div className="px-3 pb-4">
        <h3 className={`flex items-center gap-2.5 font-display text-title font-bold ${dark ? "text-white" : "text-ink"}`}>
          <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-signal" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={icon} />
          </svg>
          {title}
        </h3>
        <p className={`mt-2.5 text-small leading-relaxed ${dark ? "text-band-muted" : "text-ink-soft"}`}>{text}</p>
      </div>
    </li>
  );
}

function Field({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <p className="text-caption font-medium text-ink-faint">{label}</p>
      <p className="mt-1 flex items-center justify-between gap-2 rounded-xl border border-hairline bg-card px-3 py-2 font-mono text-caption text-ink">
        {value}
        {hint}
      </p>
    </div>
  );
}

function Pointer({ label, className }: { label: string; className: string }) {
  return (
    <span className={`absolute flex items-center gap-1 ${className}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" className="size-4 -rotate-12 text-[oklch(0.52_0.2_262)]" fill="currentColor">
        <path d="M4 3l16 7-7 2-2 7z" />
      </svg>
      <span className="rounded-lg bg-[oklch(0.52_0.2_262)] px-2 py-1 text-caption font-semibold text-white shadow-button">{label}</span>
    </span>
  );
}

export function Steps() {
  return (
    <section className="py-24 sm:py-32" aria-labelledby="steps-title">
      <div className="mx-auto max-w-[75rem] px-5 sm:px-8">
        <Headline id="steps-title" className="mx-auto max-w-[17ch] text-center text-[clamp(1.85rem,3.3vw,2.75rem)] leading-[1.1]">
          Démarrez en <Accent>trois étapes</Accent>, sans rien reconfigurer
        </Headline>

        <ol className="mt-14 grid gap-5 lg:grid-cols-3">
          <StepCard
            n={1}
            title="Installez Vigie"
            icon="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14"
            text="Téléchargez l'installateur pour Windows. Vigie se loge près de l'horloge et peut démarrer avec votre session."
          >
            <div className="w-full max-w-[19rem] rounded-2xl border border-hairline bg-card p-4 shadow-card">
              <div className="flex items-center gap-3">
                <Logo size={36} id="step1" />
                <div className="min-w-0">
                  <p className="font-display font-bold text-ink">Vigie Setup {site.version}</p>
                  <p className="text-caption text-ink-faint">Installation terminée</p>
                </div>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-wash">
                <div className="h-full w-full rounded-full bg-signal" />
              </div>
              <ul className="mt-4 grid gap-2 text-code text-ink-soft">
                {["App et fenêtre Vigie", "Icône près de l'horloge", "Commande vigie (menu de l'icône)"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    {Icon.check}
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </StepCard>

          <StepCard
            n={2}
            title="Ajoutez vos projets"
            icon="M3 7h6l2 2h10v10H3zM12 12v4M10 14h4"
            text={
              <>
                Collez le chemin d&apos;un projet : Vigie lit package.json et propose la commande et le port. Ou, depuis le dossier,{" "}
                <code className="font-mono text-[0.9em] text-ink">vigie register</code>.
              </>
            }
          >
            <div className="relative grid w-full max-w-[19rem] gap-3 rounded-2xl border border-hairline bg-wash p-4">
              <Field label="Dossier" value={<span>D:\dev\atlas<span className="ml-px inline-block h-4 w-px translate-y-0.5 bg-ink" style={{ animation: "caret 1s steps(1) infinite" }} /></span>} />
              <p className="flex items-center gap-2 text-caption font-medium text-signal-deep">
                {Icon.check}
                Next.js détecté · pnpm
              </p>
              <div className="grid grid-cols-[1fr_5.5rem] gap-2">
                <Field label="Commande" value="pnpm dev" />
                <Field label="Port" value="3000" />
              </div>
            </div>
          </StepCard>

          <StepCard
            n={3}
            dark
            title="Laissez vos agents lire l'état"
            icon="M12 3l2.6 5.6L20 9.3l-4 4 1 5.7-5-2.8-5 2.8 1-5.7-4-4 5.4-.7z"
            text="Installez le skill depuis le menu de l'icône : vos agents demandent à Vigie avant de lancer quoi que ce soit."
          >
            <div className="relative w-full max-w-[19rem] rounded-2xl border border-white/8 bg-band-raised p-4">
              <p className="text-caption text-band-muted">atlas</p>
              {[
                ["web", ":3000", "ok"],
                ["api", ":4000", "ok"],
              ].map(([name, port, tone]) => (
                <div key={name} className="mt-2 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
                  <Dot tone={tone as "ok"} />
                  <span className="font-display font-bold text-white">{name}</span>
                  <span className="ml-auto font-mono text-caption text-band-muted">{port}</span>
                </div>
              ))}
              <p className="mt-3 font-mono text-caption text-band-muted">running · healthy · 0 restart</p>
              <Pointer label="Claude Code" className="-top-4 right-2" />
              <Pointer label="Codex" className="-bottom-5 left-6" />
            </div>
          </StepCard>
        </ol>
      </div>
    </section>
  );
}
