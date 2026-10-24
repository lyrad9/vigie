// Adoption de Vigie, lue sur l'API publique de GitHub : téléchargements par version, et étoiles.
//   node scripts/downloads.js          un tableau par version, le total et les étoiles
//   node scripts/downloads.js --json   les mêmes chiffres en JSON
// Sans jeton, l'API publique autorise 60 appels/h par IP : largement assez. Définissez GITHUB_TOKEN
// pour relever cette limite, et VIGIE_REPO pour viser un autre dépôt.
import { pathToFileURL } from 'node:url';

const REPO = process.env.VIGIE_REPO || 'lyrad9/vigie';

async function api(path) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'vigie-downloads' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub a répondu ${res.status} ${res.statusText} sur /repos/${REPO}${path}`);
  return res.json();
}

// Un .exe, c'est quelqu'un qui installe — ou une app installée qui se met à jour, car la mise à
// jour automatique retélécharge l'installateur. Les autres fichiers (latest.yml, .blockmap,
// changelog.json) sont lus par les apps déjà installées à chaque vérification : ils mesurent des
// sondes, pas des personnes.
const isInstaller = (name) => name.toLowerCase().endsWith('.exe');

/** `{ repo, stars, total, versions: [{ tag, published, installers, probes, assets }] }` */
export async function adoption() {
  const [repo, releases] = await Promise.all([api(''), api('/releases?per_page=100')]);
  const versions = releases.map((release) => {
    const sum = (keep) => release.assets.filter((a) => keep(a.name)).reduce((n, a) => n + a.download_count, 0);
    return {
      tag: release.tag_name,
      published: (release.published_at || release.created_at || '').slice(0, 10),
      installers: sum(isInstaller),
      probes: sum((name) => !isInstaller(name)),
      assets: release.assets.map((a) => ({ name: a.name, downloads: a.download_count })),
    };
  });
  return {
    repo: REPO,
    stars: repo.stargazers_count,
    total: versions.reduce((n, v) => n + v.installers, 0),
    versions,
  };
}

function table(versions) {
  const head = ['Version', 'Publiée', 'Installateur', 'Sondes'];
  const rows = versions.map((v) => [v.tag, v.published, String(v.installers), String(v.probes)]);
  const width = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells) => cells.map((c, i) => (i < 2 ? c.padEnd(width[i]) : c.padStart(width[i]))).join('  ');
  return [line(head), width.map((w) => '-'.repeat(w)).join('  '), ...rows.map(line)].join('\n');
}

async function main(argv) {
  const data = await adoption();
  if (argv.includes('--json')) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  console.log(`${data.repo} — ${data.stars} étoile${data.stars === 1 ? '' : 's'}\n`);
  console.log(data.versions.length ? table(data.versions) : 'Aucune release publiée.');
  console.log(`\nInstallateurs téléchargés, toutes versions : ${data.total}`);
  console.log('Les mises à jour automatiques retéléchargent l\'installateur : ce total compte les installations et les mises à jour.');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
