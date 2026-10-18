// Guess a sensible server definition from a project directory.
import fs from 'node:fs';
import path from 'node:path';

const FRAMEWORKS = [
  // [dependency, label, default port, flags that pin the port so the server never falls back silently]
  ['next', 'Next.js', 3000, (p) => `-p ${p}`],
  ['nuxt', 'Nuxt', 3000, (p) => `--port ${p}`],
  ['astro', 'Astro', 4321, (p) => `--port ${p}`],
  ['@angular/cli', 'Angular', 4200, (p) => `--port ${p}`],
  ['@remix-run/dev', 'Remix', 5173, (p) => `--port ${p} --strictPort`],
  ['@sveltejs/kit', 'SvelteKit', 5173, (p) => `--port ${p} --strictPort`],
  ['@tanstack/react-start', 'TanStack Start', 3000, (p) => `--port ${p} --strictPort`],
  ['vite', 'Vite', 5173, (p) => `--port ${p} --strictPort`],
  ['react-scripts', 'Create React App', 3000, null],
  ['@nestjs/core', 'NestJS', 3000, null],
  ['express', 'Express', 3000, null],
];

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function packageManager(root, pkg) {
  const declared = String(pkg?.packageManager || '').split('@')[0];
  if (declared) return declared;
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(root, 'bun.lockb')) || fs.existsSync(path.join(root, 'bun.lock'))) return 'bun';
  return 'npm';
}

function runScript(pm, script, extra) {
  const base = pm === 'npm' ? `npm run ${script}` : pm === 'bun' ? `bun run ${script}` : `${pm} ${script}`;
  if (!extra) return base;
  return pm === 'npm' ? `${base} -- ${extra}` : `${base} ${extra}`;
}

export function inspectDirectory(root) {
  const abs = path.resolve(String(root || ''));
  let stat = null;
  try {
    stat = fs.statSync(abs);
  } catch {
    /* missing */
  }
  const result = { root: abs, exists: Boolean(stat?.isDirectory()), name: path.basename(abs), scripts: {}, suggestion: null };
  if (!result.exists) return result;

  const pkg = readJson(path.join(abs, 'package.json'));
  if (pkg) {
    result.name = String(pkg.name || result.name).replace(/^@[^/]+\//, '');
    result.scripts = pkg.scripts || {};
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const pm = packageManager(abs, pkg);
    const script = ['dev', 'start:dev', 'serve', 'start'].find((s) => result.scripts[s]);
    const fw = FRAMEWORKS.find(([dep]) => deps[dep]);
    if (script) {
      const port = fw ? fw[2] : 3000;
      const pinned = fw?.[3] && script === 'dev' ? fw[3](port) : '';
      result.suggestion = { name: script === 'start' ? 'web' : 'dev', command: runScript(pm, script, pinned), port, framework: fw?.[1] ?? null, packageManager: pm };
    }
    return result;
  }
  if (fs.existsSync(path.join(abs, 'manage.py'))) {
    result.suggestion = { name: 'web', command: 'python manage.py runserver 8000', port: 8000, framework: 'Django' };
  } else if (fs.existsSync(path.join(abs, 'Gemfile')) && fs.existsSync(path.join(abs, 'config.ru'))) {
    result.suggestion = { name: 'web', command: 'bin/rails server -p 3000', port: 3000, framework: 'Rails' };
  }
  return result;
}
