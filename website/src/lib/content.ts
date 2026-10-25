// One source for the text agents read: the Markdown version of every page, llms.txt,
// llms-full.txt and the Markdown 404. The trust pages (/about, /contact, /privacy) are also
// rendered to HTML from these same blocks, so both representations always say the same thing.
// Inline syntax inside blocks is a small Markdown subset: [label](url), `code` and **bold**.
import { site } from "./site.ts";

export type Block =
  | { type: "h2"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "code"; lang?: string; text: string };

export type TrustPage = {
  path: "/about" | "/contact" | "/privacy";
  title: string;
  description: string;
  heading: string;
  lede: string;
  blocks: Block[];
};

const a = site.author;

export const TRUST_PAGES: TrustPage[] = [
  {
    path: "/about",
    title: "À propos",
    description: "Qui fait Vigie, pourquoi le projet existe, sa licence et son état actuel.",
    heading: "À propos de Vigie",
    lede: "Vigie est un superviseur de serveurs de dev locaux, conçu pour les développeurs qui codent avec plusieurs agents IA en parallèle.",
    blocks: [
      { type: "h2", text: "Le projet" },
      {
        type: "p",
        text: "Quand Claude Code, Codex, Cursor et vos propres terminaux travaillent sur le même projet, chacun finit par relancer `npm run dev` de son côté. Résultat : des serveurs en double, des ports de repli que personne n'a notés et des logs éparpillés. Vigie lance chaque serveur une seule fois, le surveille, et expose un état unique en direct que chaque agent lit avant d'agir.",
      },
      {
        type: "p",
        text: "Vigie se compose d'une app desktop (une fenêtre et une icône près de l'horloge), d'une commande `vigie` qui répond en JSON, d'une API HTTP qui n'écoute que sur `127.0.0.1`, et d'un skill qui apprend aux agents une règle simple : inspecter d'abord, lancer seulement si besoin.",
      },
      { type: "h2", text: "Qui fait Vigie" },
      {
        type: "p",
        text: `Vigie est conçu et développé par [${a.name}](${a.url}), développeur. C'est un projet personnel et indépendant : pas d'entreprise derrière, pas de compte à créer, pas d'abonnement.`,
      },
      { type: "h2", text: "Open source" },
      {
        type: "p",
        text: `Le code est public sur [GitHub](${site.repo}) sous [licence MIT](${site.license}). Les contributions passent par une pull request vers la branche \`dev\`, vérifiée par la CI sur Linux et Windows avant d'arriver sur \`main\`.`,
      },
      { type: "h2", text: "État actuel" },
      {
        type: "ul",
        items: [
          `Version ${site.version}, disponible en [installateur Windows](${site.download}).`,
          "macOS et Linux : à construire depuis les sources (`npm install && npm run app`).",
          "L'installateur n'est pas encore signé : Windows SmartScreen affiche un avertissement au premier lancement.",
          "Rien ne quitte votre machine : pas de télémétrie, pas de compte.",
        ],
      },
    ],
  },
  {
    path: "/contact",
    title: "Contact",
    description: "Signaler un problème, proposer une idée, contribuer ou contacter l'auteur de Vigie.",
    heading: "Contacter le projet Vigie",
    lede: "Le moyen le plus rapide d'obtenir une réponse dépend de ce que vous voulez faire.",
    blocks: [
      { type: "h2", text: "Signaler un problème ou proposer une idée" },
      {
        type: "p",
        text: `Ouvrez une issue sur [GitHub](${site.issues}). Indiquez votre version de Vigie, votre système, la commande du serveur concerné et ce que \`vigie status --json\` affiche : c'est souvent suffisant pour reproduire le problème.`,
      },
      { type: "h2", text: "Contribuer" },
      {
        type: "p",
        text: `Créez une branche depuis \`dev\` et poussez-la sur [le dépôt](${site.repo}) : une pull request vers \`dev\` s'ouvre automatiquement, et la CI vérifie le moteur, le site et l'installateur. Le README détaille le flux complet.`,
      },
      { type: "h2", text: "Contacter l'auteur" },
      {
        type: "ul",
        items: [
          `E-mail : [${a.email}](mailto:${a.email})`,
          `Site : [lyrad.dev](${a.url})`,
          `GitHub : [lyrad9](${a.github})`,
          `LinkedIn : [Daryl Ngako](${a.linkedin})`,
          `X : [@daryl_ngako](${a.x})`,
        ],
      },
      { type: "h2", text: "Sécurité" },
      {
        type: "p",
        text: `Pour une faille de sécurité, n'ouvrez pas d'issue publique détaillée : écrivez directement à [${a.email}](mailto:${a.email}) avec les étapes pour la reproduire. Vous recevrez une réponse avant toute publication.`,
      },
    ],
  },
  {
    path: "/privacy",
    title: "Confidentialité",
    description: "Ce que le site vigie.lyrad.dev et l'application Vigie collectent, et ce qu'ils ne collectent pas.",
    heading: "Confidentialité",
    lede: `Version du ${site.updated}. En résumé : ni le site ni l'application ne vous suivent, et l'application ne transmet rien en dehors de votre machine.`,
    blocks: [
      { type: "h2", text: "Ce site" },
      {
        type: "ul",
        items: [
          "Aucun cookie de suivi, aucun outil d'analyse d'audience, aucune publicité.",
          "Les polices sont servies par le site lui-même : aucune requête vers un service de polices tiers.",
          "Votre choix de thème clair ou sombre est enregistré dans le stockage local de votre navigateur (`vigie-theme`). Il ne quitte pas votre appareil.",
          "Le site est hébergé par Vercel, qui conserve des journaux techniques (adresse IP, navigateur, page demandée) pour faire fonctionner et sécuriser le service, selon [sa politique de confidentialité](https://vercel.com/legal/privacy-policy).",
        ],
      },
      { type: "h2", text: "Liens vers d'autres services" },
      {
        type: "p",
        text: "Les boutons « Télécharger » et « Star sur GitHub » mènent à GitHub, et le nombre d'étoiles affiché est lu sur l'API publique de GitHub par le serveur du site, une fois par heure. Les boutons « Demander à ChatGPT », « Demander à Claude » et « Demander à Perplexity » ouvrent ces services avec une question sur Vigie déjà rédigée : rien n'est envoyé tant que vous ne cliquez pas, et leurs propres politiques s'appliquent ensuite.",
      },
      { type: "h2", text: "L'application Vigie" },
      {
        type: "ul",
        items: [
          "Elle fonctionne entièrement sur votre machine : son API n'écoute que sur `127.0.0.1` et refuse les requêtes venant d'autres sites.",
          "Pas de compte, pas de télémétrie, pas de mise à jour qui appelle un serveur.",
          "Votre configuration et les logs de vos serveurs restent dans `~/.config/vigie/` sur votre ordinateur.",
        ],
      },
      { type: "h2", text: "Questions" },
      {
        type: "p",
        text: `Pour toute question sur ces données, écrivez à [${a.email}](mailto:${a.email}) ou consultez la page [Contact](/contact).`,
      },
    ],
  },
];

export const PAGE_PATHS = ["/", ...TRUST_PAGES.map((p) => p.path)] as const;

export function trustPage(path: TrustPage["path"]): TrustPage {
  const page = TRUST_PAGES.find((p) => p.path === path);
  if (!page) throw new Error(`Unknown trust page: ${path}`);
  return page;
}

function renderBlocks(blocks: Block[]): string {
  return blocks
    .map((b) => {
      if (b.type === "h2") return `## ${b.text}`;
      if (b.type === "p") return b.text;
      if (b.type === "ul") return b.items.map((i) => `- ${i}`).join("\n");
      return "```" + (b.lang ?? "") + "\n" + b.text + "\n```";
    })
    .join("\n\n");
}

/** Relative links become absolute so the Markdown works outside the site. */
function absolutize(markdown: string): string {
  return markdown.replace(/\]\((\/[^)]*)\)/g, (_, path) => `](${site.url}${path})`);
}

export const FAQ: { q: string; a: string }[] = [
  {
    q: "Comment Vigie lance-t-il mes serveurs ?",
    a: "Avec la commande que vous tapez d'habitude (`pnpm dev`, `npm run dev`, `python manage.py runserver`…), dans votre shell, avec la variable `PORT` définie. Vigie surveille ensuite le process, sa santé et sa sortie.",
  },
  {
    q: "Que se passe-t-il quand je ferme la fenêtre ?",
    a: "Vos serveurs continuent de tourner : Vigie reste dans la zone de notification. Quitter Vigie les arrête, et ceux qui tournaient repartent au lancement suivant.",
  },
  {
    q: "Ça marche avec Vite, Next.js, Django, Rails… ?",
    a: "Avec tout ce qui se lance par une commande. Vigie reconnaît Next.js, Vite, Astro, Nuxt, SvelteKit, Angular, Django et Rails pour pré-remplir la commande et le port. Pour Vite, gardez `--port 5173 --strictPort` afin qu'il ne bascule jamais en silence sur un autre port.",
  },
  {
    q: "Et sur macOS ou Linux ?",
    a: "L'installateur est pour Windows. Sur macOS et Linux, Vigie se construit depuis les sources (`npm install && npm run app`) et la commande `vigie` fonctionne de la même façon.",
  },
  {
    q: "Quels agents sont compatibles ?",
    a: "Tous ceux qui savent lancer une commande : Claude Code, Codex, Cursor ou vos propres scripts. Le skill est copié dans `~/.agents/skills` et `~/.claude/skills`. Sans skill, l'API HTTP sur `127.0.0.1:7744` suffit.",
  },
  {
    q: "Vigie envoie-t-il des données quelque part ?",
    a: "Non. Pas de compte, pas de télémétrie. L'API écoute uniquement sur 127.0.0.1 et refuse les requêtes venant d'autres sites.",
  },
  {
    q: "Vigie peut-il arrêter un process tout seul ?",
    a: "Jamais. Il arrête ce qu'il a lancé quand vous le demandez, et ne touche à un process lancé ailleurs qu'après une demande explicite. Les services système sont en lecture seule.",
  },
];

export function homeMarkdown(): string {
  return absolutize(`# ${site.name} — superviseur de serveurs de dev locaux pour agents IA

> Vos agents relancent sans cesse le même serveur. Vigie le lance une seule fois. Ensuite, chaque agent, terminal et fenêtre lit le même état en direct : ce qui tourne, sur quel port, sous quel PID, et si ça répond vraiment.

- [Télécharger pour Windows](${site.download}) (version ${site.version}, installateur non signé)
- [Code source sur GitHub](${site.repo}) (licence MIT)
- macOS et Linux : depuis les sources. Rien ne quitte votre machine.

## Un seul serveur, lu par tous vos agents

Sans Vigie, chaque agent relance son propre serveur :

- Un serveur relancé à chaque nouvelle tâche
- Des ports de repli que personne n'a notés
- Des logs éclatés entre les onglets
- Des process orphelins après chaque session

Avec Vigie, chaque agent demande avant d'agir :

- Un process par serveur, quel que soit le nombre d'agents
- L'état lu en JSON avant chaque lancement
- Un port refusé plutôt qu'un port de repli
- Toute la sortie dans une seule fenêtre
- Les serveurs plantés relancés tout seuls
- Rien n'est arrêté sans votre accord

## Gardez la main sur chaque port

- **Inspecter avant de lancer** : une commande, une réponse JSON avec les projets, serveurs, ports, PID et santé.
- **Savoir qui tient chaque port** : géré par Vigie, lancé ailleurs ou réservé au système, avec le PID et la commande.
- **Relancer ce qui tombe** : sonde TCP ou HTTP, redémarrage avec un délai croissant, puis échec signalé au bout de cinq essais avec le dernier code de sortie.
- **Lire les logs sans rouvrir de terminal** : un fichier par serveur qui survit aux redémarrages, et \`vigie logs -f\` pour suivre en direct.

## Votre agent lit l'état, puis décide

\`\`\`bash
vigie status --json      # chaque serveur, son port, son état et sa santé
vigie resolve --json     # le serveur enregistré pour le dossier courant, et son URL
vigie port 3001 --json   # qui tient un port : Vigie, un autre programme ou le système
vigie start web          # refuse avec PORT_IN_USE si un autre programme tient le port
vigie logs web -f        # la sortie du serveur, en direct
\`\`\`

Le [skill Vigie](${site.skill}) s'installe dans \`~/.agents/skills\` et \`~/.claude/skills\`. Il tient en une règle : ne jamais lancer de serveur de dev sans avoir lu l'état d'abord.

## Démarrer en trois étapes

1. **Installez Vigie** : téléchargez l'installateur pour Windows. Vigie se loge près de l'horloge et peut démarrer avec votre session.
2. **Ajoutez vos projets** : collez le chemin d'un projet, Vigie lit \`package.json\` et propose la commande et le port. Ou, depuis le dossier : \`vigie register\`.
3. **Laissez vos agents lire l'état** : installez le skill depuis le menu de l'icône, vos agents demandent à Vigie avant de lancer quoi que ce soit.

## Questions fréquentes

${FAQ.map((f) => `### ${f.q}\n\n${f.a}`).join("\n\n")}

## Pages

- [À propos](/about.md)
- [Contact](/contact.md)
- [Confidentialité](/privacy.md)
- [llms.txt](/llms.txt) : ce que fait Vigie et quand un agent doit l'utiliser

Fait par [${a.name}](${a.url}).
`);
}

export function trustPageMarkdown(page: TrustPage): string {
  return absolutize(`# ${page.heading}\n\n> ${page.lede}\n\n${renderBlocks(page.blocks)}\n\n[Retour à l'accueil](/index.md)\n`);
}

/** "/index.md" and "/index.html.md" → "/", "/about.md" → "/about"; any other path → null. */
export function markdownTarget(pathname: string): string | null {
  if (!pathname.endsWith(".md")) return null;
  const base = pathname.slice(0, -".md".length).replace(/\.html$/, "");
  if (base === "/index" || base === "") return "/";
  return base;
}

/** Markdown for a page path ("/", "/about"…), or null when the page does not exist. */
export function markdownFor(path: string): string | null {
  if (path === "/") return homeMarkdown();
  const page = TRUST_PAGES.find((p) => p.path === path);
  return page ? trustPageMarkdown(page) : null;
}

export function notFoundMarkdown(path: string): string {
  return `# 404 — page introuvable

La page \`${path}\` n'existe pas sur ${site.url.replace("https://", "")}.
Page not found: \`${path}\` does not exist on this site.

- [Accueil en Markdown](${site.url}/index.md)
- [llms.txt](${site.url}/llms.txt) : ce que fait Vigie et quand l'utiliser
- [Plan du site](${site.url}/sitemap.xml)
`;
}

/** llms.txt, following https://llmstxt.org: H1, blockquote, details without headings, then H2 link lists. */
export function llmsTxt(): string {
  return `# Vigie

> Vigie is a free, open-source (MIT) supervisor for local development servers, built for developers who run several AI coding agents (Claude Code, Codex, Cursor) in parallel on one machine. It starts each dev server once, keeps it healthy, and exposes one live state (what runs, on which port, under which PID, healthy or not) through a JSON CLI and a loopback HTTP API, so agents inspect before they launch instead of starting duplicates.

When to use Vigie:

- Before starting a local dev server (\`npm run dev\`, \`pnpm dev\`, \`next dev\`, \`vite\`, \`rails s\`, \`python manage.py runserver\`): run \`vigie status --json\` or \`vigie resolve --json\`. If the server is \`running\` and \`healthy\`, reuse its \`url\` and start nothing.
- When a port is already in use: run \`vigie port <n> --json\` to learn who owns it (\`managed\` by Vigie, \`external\`, or \`system\`) instead of silently falling back to another port. Tell the user; only use \`vigie start <server> --takeover\` with their consent.
- When you need a dev server's output: read \`vigie logs <server> --lines 100\` instead of starting a second copy to see it.
- When the project has no registered server (\`resolve\` returns \`project: null\`): register it once with \`vigie register --command "<cmd>" --port <n>\`, then \`vigie start\`.

Do not use Vigie for production process management, remote hosts or containers: it supervises dev servers on the user's own machine (Windows installer; macOS and Linux from source).

How to call it: every command accepts \`--json\`; errors come back as \`{"ok": false, "error": {"code", "message"}}\`, for example \`PORT_IN_USE\`. The HTTP API listens only on \`http://127.0.0.1:7744/api\` (\`GET /status\`, \`GET /port/<n>\`, \`POST /servers/<ref>/start\`). If \`vigie\` is not on PATH, ask the user to choose "Install command-line tool" in the Vigie tray menu. Never stop processes Vigie reports as \`system\`.

## Docs

- [Vigie homepage in Markdown](${site.url}/index.md): what Vigie does, features, CLI, setup and FAQ (French)
- [Agent skill](${site.skill}): the "inspect first, launch only if needed" rule and the decision table for agents
- [README](${site.repo}#readme): installation, CLI reference, configuration and architecture

## Download

- [Windows installer, latest release](${site.download}): unsigned for now, so SmartScreen warns on first run
- [Source code](${site.repo}): MIT license

## Optional

- [About](${site.url}/about.md): who makes Vigie and the project's status
- [Contact](${site.url}/contact.md): issues, contributions and the author's contact details
- [Privacy](${site.url}/privacy.md): what the site and the app collect
- [Full context](${site.url}/llms-full.txt): every page of the site in one file
`;
}

export function llmsFullTxt(): string {
  return [llmsTxt(), homeMarkdown(), ...TRUST_PAGES.map(trustPageMarkdown)].join("\n---\n\n");
}
