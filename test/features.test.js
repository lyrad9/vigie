// Project logos, the "open a terminal" command, settings and the bilingual UI texts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { TRAY_STRINGS, trayText } from '../desktop/tray-strings.js';
import { normalizeConfig, normalizeProject } from '../src/config.js';
import { findProjectLogo, projectLogo } from '../src/logo.js';
import { terminalCommand } from '../src/terminal.js';
import { MANUAL } from '../ui/manual.js';
import { STRINGS } from '../ui/strings.js';

function tmpProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vigie-logo-'));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
  return root;
}

test('findProjectLogo prefers the app icon, then vector logos, then favicon.ico', (t) => {
  const root = tmpProject({
    'public/favicon.ico': 'ico',
    'public/logo_brand.webp': 'webp',
    'app/icon.png': 'png',
    'public/robots.txt': 'no',
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.equal(path.relative(root, findProjectLogo(root)), path.join('app', 'icon.png'));
  fs.rmSync(path.join(root, 'app'), { recursive: true });
  assert.equal(path.relative(root, findProjectLogo(root)), path.join('public', 'logo_brand.webp'));
  fs.writeFileSync(path.join(root, 'public', 'favicon.svg'), '<svg/>');
  assert.equal(path.relative(root, findProjectLogo(root)), path.join('public', 'favicon.svg'));
});

test('findProjectLogo ignores empty, oversized and unrelated files', (t) => {
  const root = tmpProject({ 'public/logo.png': '', 'public/hero.png': 'x', 'public/icon.svg': 'x'.repeat(1024 * 1024 + 1) });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.equal(findProjectLogo(root), null);
  assert.equal(findProjectLogo(path.join(root, 'missing')), null);
});

test('projectLogo reports a forward-slash path and caches the lookup', (t) => {
  const root = tmpProject({ 'public/favicon.svg': '<svg/>' });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const first = projectLogo(root, { now: 1000 });
  assert.equal(first.rel, 'public/favicon.svg');
  fs.rmSync(path.join(root, 'public'), { recursive: true });
  assert.equal(projectLogo(root, { now: 2000 }).rel, 'public/favicon.svg', 'cached');
  assert.equal(projectLogo(root, { now: 2000, ttl: 0 }), null, 'refreshed');
});

test('terminalCommand picks a terminal per platform', () => {
  const dir = path.join(os.tmpdir(), 'my app');
  const win = terminalCommand(dir, { platform: 'win32', env: {}, has: (n) => n === 'wt.exe' });
  assert.deepEqual([win.file, win.args], ['wt.exe', ['-d', dir]]);
  const ps = terminalCommand(dir, { platform: 'win32', env: {}, has: () => false });
  assert.deepEqual([ps.file, ps.cwd], ['powershell.exe', dir]);
  const mac = terminalCommand(dir, { platform: 'darwin', env: {} });
  assert.deepEqual([mac.file, mac.args], ['open', ['-a', 'Terminal', dir]]);
  const gnome = terminalCommand(dir, { platform: 'linux', env: {}, has: (n) => n === 'gnome-terminal' });
  assert.deepEqual(gnome.args, [`--working-directory=${dir}`]);
  assert.equal(terminalCommand(dir, { platform: 'linux', env: {}, has: () => false }), null);
});

test('config keeps the language and project icon mode, and resets unknown values', () => {
  assert.equal(normalizeConfig({}).language, 'auto');
  assert.equal(normalizeConfig({ language: 'fr' }).language, 'fr');
  assert.equal(normalizeConfig({ language: 'de' }).language, 'auto');
  const root = os.tmpdir();
  assert.equal(normalizeProject({ name: 'a', root }).icon, 'auto');
  assert.equal(normalizeProject({ name: 'a', root, icon: 'letter' }).icon, 'letter');
  assert.equal(normalizeProject({ name: 'a', root, icon: 'emoji' }).icon, 'auto');
});

test('every UI text exists in English and French', () => {
  const en = Object.keys(STRINGS.en).sort();
  const fr = Object.keys(STRINGS.fr).sort();
  assert.deepEqual(fr.filter((k) => !STRINGS.en[k]), [], 'French keys missing in English');
  assert.deepEqual(en.filter((k) => !STRINGS.fr[k]), [], 'English keys missing in French');
  for (const lang of ['en', 'fr']) {
    for (const [key, value] of Object.entries(STRINGS[lang])) {
      const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
      assert.equal(vars(value), vars(STRINGS.en[key]), `${lang}.${key} uses the same placeholders as English`);
    }
  }
});

test('every tray text exists in English and French with the same placeholders', () => {
  const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
  assert.deepEqual(Object.keys(TRAY_STRINGS.fr).sort(), Object.keys(TRAY_STRINGS.en).sort());
  for (const [key, value] of Object.entries(TRAY_STRINGS.fr)) assert.equal(vars(value), vars(TRAY_STRINGS.en[key]), key);
  assert.equal(trayText('auto', 'fr-FR')('restartToUpdate', { version: '0.1.2' }), 'Redémarrer pour passer à 0.1.2');
  assert.equal(trayText('en', 'fr-FR')('updateReadyTitle', { version: '0.1.2' }), 'Vigie 0.1.2 is ready');
});

test('the manual has the same chapters in both languages, each with real content', () => {
  const ids = (lang) => MANUAL[lang].map((s) => s.id);
  assert.deepEqual(ids('fr'), ids('en'));
  assert.ok(MANUAL.en.length >= 10, 'at least ten chapters');
  for (const lang of ['en', 'fr']) {
    for (const s of MANUAL[lang]) {
      assert.ok(s.title && s.html.length > 400, `${lang}/${s.id} is written out`);
      assert.doesNotMatch(s.html, /<script/i);
    }
  }
});

test('window layout: the page never grows past the window, and the desktop window never stacks', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const css = fs.readFileSync(path.join(root, 'ui', 'style.css'), 'utf8');
  // The project list scrolls and holds absolutely positioned screen-reader texts: unless the list is
  // positioned, those of the rows scrolled out of view stretch the page below the window.
  assert.match(css, /\n\.projects \{[^}]*position: relative/);
  // The sidebar only moves above the content below the narrowest width the desktop window allows.
  const minWidth = Number(fs.readFileSync(path.join(root, 'desktop', 'main.js'), 'utf8').match(/minWidth: (\d+)/)[1]);
  const stacked = [...css.matchAll(/@media \(max-width: (\d+)px\) \{\s*\.app \{ grid-template-columns: 1fr;/g)].map((m) => Number(m[1]));
  assert.equal(stacked.length, 1);
  assert.ok(stacked[0] < minWidth, `stacks at ${stacked[0]}px, the window can be ${minWidth}px wide`);
});
