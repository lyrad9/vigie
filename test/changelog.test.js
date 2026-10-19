// The version history shown on the Updates page and published as the release notes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { entryFor, releaseNotes } from '../scripts/release-notes.js';
import { CHANGELOG, SECTIONS, compareVersions, releasedUpTo, sanitizeChangelog } from '../ui/changelog.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

test('changelog: one entry per version, newest first, the same notes in English and French', () => {
  const versions = CHANGELOG.map((e) => e.version);
  assert.equal(new Set(versions).size, versions.length, 'duplicate version');
  for (let i = 1; i < CHANGELOG.length; i++) assert.equal(compareVersions(CHANGELOG[i - 1].version, CHANGELOG[i].version), 1, `${versions[i - 1]} before ${versions[i]}`);
  for (const e of CHANGELOG) {
    assert.match(e.version, /^\d+\.\d+\.\d+$/);
    if (e.date !== null) assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/, e.version);
    for (const lang of ['en', 'fr']) {
      for (const key of Object.keys(e[lang])) assert.ok(SECTIONS.includes(key), `${e.version} ${lang}: unknown section ${key}`);
      for (const items of Object.values(e[lang])) for (const item of items) assert.ok(typeof item === 'string' && item.trim(), e.version);
    }
    const shape = (lang) => SECTIONS.map((k) => e[lang][k]?.length ?? 0).join();
    assert.equal(shape('fr'), shape('en'), `${e.version}: French and English differ`);
    assert.ok(Object.keys(e.en).length, `${e.version} has no notes`);
  }
});

test('changelog: the version in package.json, and every older one, is released with a date', () => {
  assert.ok(CHANGELOG.some((e) => e.version === PKG.version), `no entry for ${PKG.version}`);
  for (const e of releasedUpTo(PKG.version)) assert.ok(e.date, `${e.version} has no date`);
  assert.equal(entryFor(PKG.version).version, PKG.version);
});

test('compareVersions and releasedUpTo', () => {
  assert.equal(compareVersions('0.1.10', '0.1.9'), 1);
  assert.equal(compareVersions('0.2.0', '0.10.0'), -1);
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  const list = [{ version: '0.2.0' }, { version: '0.1.5' }, { version: '0.1.4' }];
  assert.deepEqual(releasedUpTo('0.1.5', list).map((e) => e.version), ['0.1.5', '0.1.4']);
});

test('sanitizeChangelog keeps known versions, sections and strings only', () => {
  const out = sanitizeChangelog({
    changelog: [
      { version: '0.1.4', date: '2026-10-18', en: { fixed: ['Port kept'] }, fr: { fixed: ['Port gardé'] } },
      { version: '0.1.6', date: 'tomorrow', en: { new: ['<img src=x onerror=alert(1)>', 42, ''], hacks: ['x'] }, fr: null },
      { version: '../../etc', en: { new: ['x'] } },
      null,
    ],
  });
  assert.deepEqual(out, [
    // Strings are kept as text: the page escapes them.
    { version: '0.1.6', date: null, en: { new: ['<img src=x onerror=alert(1)>'] }, fr: {} },
    { version: '0.1.4', date: '2026-10-18', en: { fixed: ['Port kept'] }, fr: { fixed: ['Port gardé'] } },
  ]);
  assert.deepEqual(sanitizeChangelog('nope'), []);
});

test('release notes: French then English, with section titles, and none without an entry and a date', () => {
  const md = releaseNotes({ version: '9.9.9', date: '2026-01-01', en: { new: ['A'], fixed: ['B'] }, fr: { new: ['A fr'], fixed: ['B fr'] } });
  assert.equal(md, '### Français\n\n**Nouveau**\n- A fr\n\n**Corrigé**\n- B fr\n\n### English\n\n**New**\n- A\n\n**Fixed**\n- B\n');
  assert.throws(() => entryFor('9.9.9'), /no entry for 9\.9\.9/);
  assert.throws(() => entryFor('1.0.0', [{ version: '1.0.0', date: null }]), /no date/);
});

test('the app window gets the updater through its preload, and only that', () => {
  const main = fs.readFileSync(path.join(ROOT, 'desktop', 'main.js'), 'utf8');
  assert.match(main, /preload: path\.join\(HERE, 'preload\.cjs'\)/);
  const preload = fs.readFileSync(path.join(ROOT, 'desktop', 'preload.cjs'), 'utf8');
  assert.match(preload, /exposeInMainWorld\('vigieDesktop', \{\s+updates: \{/);
  for (const channel of preload.matchAll(/ipcRenderer\.(?:invoke|on)\('([^']+)'/g)) assert.match(channel[1], /^updates:/);
  // Every channel the page can call is answered, and only for the app's own page.
  for (const channel of preload.matchAll(/ipcRenderer\.invoke\('([^']+)'/g)) assert.ok(main.includes(`handle('${channel[1]}'`), channel[1]);
  assert.match(main, /if \(!fromApp\(event\)\) throw/);
});
