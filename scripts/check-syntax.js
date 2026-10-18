// Parse every JavaScript file of the app with `node --check`, without running it.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['bin', 'src', 'ui', 'desktop', 'scripts', 'test', 'examples'];

function* jsFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* jsFiles(full);
    else if (/\.(c|m)?js$/.test(entry.name)) yield full;
  }
}

let failed = 0;
let count = 0;
for (const dir of DIRS) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) continue;
  for (const file of jsFiles(abs)) {
    count++;
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } catch (err) {
      failed++;
      console.error(`✗ ${path.relative(root, file)}\n${err.stderr?.toString() ?? err.message}`);
    }
  }
}
console.log(`${count - failed}/${count} files parse`);
process.exit(failed ? 1 : 0);
