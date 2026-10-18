// Find a project's own logo (favicon, app icon) so the sidebar can show it instead of a letter.
import fs from 'node:fs';
import path from 'node:path';

export const LOGO_TYPES = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};
const MAX_BYTES = 1024 * 1024;

// Folders that hold a web project's icons, most specific first: Next.js app router, then static folders.
const DIRS = ['app', 'src/app', 'public', 'static', 'src/assets', 'assets', 'src', '.'];
const NAME = /^(icon|logo|favicon|apple-touch-icon|apple-icon)([-_.@][\w.@-]*)?\.(svg|png|webp|jpe?g|ico)$/i;

/** Lower is better: a vector icon beats a bitmap logo, which beats a favicon.ico. */
function rank(file) {
  const ext = path.extname(file).toLowerCase();
  const base = path.basename(file).toLowerCase();
  const byExt = { '.svg': 0, '.png': 1, '.webp': 1, '.jpg': 2, '.jpeg': 2, '.ico': 3 }[ext] ?? 9;
  const byName = base.startsWith('icon') || base.startsWith('logo') ? 0 : base.startsWith('apple') ? 1 : 2;
  return byExt * 3 + byName;
}

/** Absolute path of the best logo inside `root`, or null. Only looks at a few known folders, never recursively. */
export function findProjectLogo(root) {
  if (!root) return null;
  for (const dir of DIRS) {
    const abs = path.join(root, dir);
    let names;
    try {
      names = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      continue;
    }
    const files = names
      .filter((d) => d.isFile() && NAME.test(d.name))
      .map((d) => path.join(abs, d.name))
      .filter((f) => {
        try {
          const size = fs.statSync(f).size;
          return size > 0 && size <= MAX_BYTES;
        } catch {
          return false;
        }
      })
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    if (files.length) return files[0];
  }
  return null;
}

const cache = new Map();

/** Cached for a few seconds: status() runs on every change and the folders rarely move. */
export function projectLogo(root, { ttl = 15000, now = Date.now() } = {}) {
  const hit = cache.get(root);
  if (hit && now - hit.at < ttl) return hit.logo;
  const file = findProjectLogo(root);
  let logo = null;
  if (file) {
    let mtime = 0;
    try {
      mtime = Math.floor(fs.statSync(file).mtimeMs);
    } catch {
      /* keep 0 */
    }
    logo = { file, rel: path.relative(root, file).replace(/\\/g, '/'), version: mtime };
  }
  cache.set(root, { at: now, logo });
  return logo;
}
