// What changed in each version, written for the people who use Vigie, newest first.
// The app's Updates page shows it, and the release workflow turns the entry of the version
// being released into the GitHub release notes (scripts/release-notes.js), so every release
// needs an entry here first. Each entry has the same sections in English and French.
export const CHANGELOG = [
  {
    version: '0.1.5',
    date: '2026-10-19',
    en: {
      new: [
        'An Updates page in the app: your version, the one available, what changed in each version, and a button to update.',
        'The manual explains how to update Vigie.',
      ],
    },
    fr: {
      new: [
        'Une page Mises à jour dans l’app : votre version, celle qui est disponible, ce qui change dans chaque version, et un bouton pour mettre à jour.',
        'Le manuel explique comment mettre Vigie à jour.',
      ],
    },
  },
  {
    version: '0.1.4',
    date: '2026-10-18',
    en: {
      new: ['A new server gets a port no other server uses, and Vigie suggests a free one when you register a project.'],
      fixed: [
        'Running the installer while Vigie runs no longer leaves your servers running on their own: Vigie stops them first.',
        'A server left running by an earlier Vigie no longer blocks its own port at startup: Vigie stops it and starts the server again.',
        'A server keeps its port while it restarts.',
      ],
    },
    fr: {
      new: ['Un nouveau serveur reçoit un port qu’aucun autre serveur n’utilise, et Vigie propose un port libre quand vous enregistrez un projet.'],
      fixed: [
        'Lancer l’installeur pendant que Vigie tourne ne laisse plus vos serveurs tourner seuls : Vigie les arrête d’abord.',
        'Un serveur resté lancé par un Vigie précédent ne bloque plus son propre port au démarrage : Vigie l’arrête et relance le serveur.',
        'Un serveur garde son port pendant qu’il redémarre.',
      ],
    },
  },
  {
    version: '0.1.3',
    date: '2026-10-18',
    en: { improved: ['The first version an installed Vigie downloads and installs on its own.'] },
    fr: { improved: ['La première version qu’un Vigie installé télécharge et installe tout seul.'] },
  },
  {
    version: '0.1.2',
    date: '2026-10-18',
    en: { new: ['Automatic updates: Vigie downloads new versions in the background and installs them when it restarts.'] },
    fr: { new: ['Mises à jour automatiques : Vigie télécharge les nouvelles versions en arrière-plan et les installe au redémarrage.'] },
  },
  {
    version: '0.1.1',
    date: '2026-10-18',
    en: {
      new: ['A built-in manual.', 'A Terminal button that opens a terminal in the server’s folder.', 'Project logos, read from the project.', 'English and French.', 'A new design.'],
      improved: ['The Ports page folds a server’s extra listeners under its main port.'],
    },
    fr: {
      new: ['Un manuel intégré.', 'Un bouton Terminal qui ouvre un terminal dans le dossier du serveur.', 'Les logos des projets, lus dans le projet.', 'L’anglais et le français.', 'Un nouveau design.'],
      improved: ['La page Ports regroupe les ports annexes d’un serveur sous son port principal.'],
    },
  },
  {
    version: '0.1.0',
    date: '2026-10-18',
    en: { new: ['First version: one supervisor for every local dev server, read by your AI agents.'] },
    fr: { new: ['Première version : un seul superviseur pour tous vos serveurs de dev locaux, lu par vos agents IA.'] },
  },
];

export const SECTIONS = ['new', 'improved', 'fixed'];

/** -1, 0 or 1, comparing "x.y.z" versions. */
export function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0) ? -1 : 1;
  return 0;
}

/**
 * A changelog downloaded from a release, reduced to what the page shows: known versions, dates,
 * sections and plain strings. Anything else is dropped. Newest first.
 */
export function sanitizeChangelog(data) {
  const list = Array.isArray(data) ? data : Array.isArray(data?.changelog) ? data.changelog : [];
  const strings = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.slice(0, 600)) : []);
  const notes = (v) => Object.fromEntries(SECTIONS.map((k) => [k, strings(v?.[k])]).filter(([, items]) => items.length));
  return list
    .filter((e) => e && /^\d+\.\d+\.\d+$/.test(e.version))
    .slice(0, 200)
    .map((e) => ({ version: e.version, date: /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : null, en: notes(e.en), fr: notes(e.fr) }))
    .sort((a, b) => compareVersions(b.version, a.version));
}

/** The entries up to `version` (included), newest first: what a copy of that version can tell about itself. */
export function releasedUpTo(version, changelog = CHANGELOG) {
  return changelog.filter((e) => compareVersions(e.version, version) <= 0);
}
