// Release notes from ui/changelog.js, for the release workflow.
//   node scripts/release-notes.js 0.1.5                         prints the GitHub release notes (French, then English)
//   node scripts/release-notes.js 0.1.5 --json dist/changelog.json   also writes the changelog up to that version,
//                                                                which the app's Updates page reads for a version it does not know yet
// Fails when the version has no entry or no release date, so a release cannot ship without notes.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { CHANGELOG, SECTIONS, releasedUpTo } from '../ui/changelog.js';
import { translator } from '../ui/strings.js';

/** Markdown for one changelog entry, French first like the README. */
export function releaseNotes(entry) {
  const blocks = [];
  for (const [lang, heading] of [
    ['fr', 'Français'],
    ['en', 'English'],
  ]) {
    const t = translator(lang);
    const notes = entry[lang] || {};
    const parts = SECTIONS.filter((k) => notes[k]?.length).map((k) => `**${t(`updates.section.${k}`)}**\n${notes[k].map((item) => `- ${item}`).join('\n')}`);
    blocks.push(`### ${heading}\n\n${parts.join('\n\n')}`);
  }
  return `${blocks.join('\n\n')}\n`;
}

export function entryFor(version, changelog = CHANGELOG) {
  const entry = changelog.find((e) => e.version === version);
  if (!entry) throw new Error(`ui/changelog.js has no entry for ${version}: add one before releasing.`);
  if (!entry.date) throw new Error(`The ${version} entry of ui/changelog.js has no date: set it to the release day.`);
  return entry;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [version, flag, out] = process.argv.slice(2);
  try {
    const entry = entryFor(String(version || '').replace(/^v/, ''));
    process.stdout.write(releaseNotes(entry));
    if (flag === '--json' && out) fs.writeFileSync(out, JSON.stringify({ changelog: releasedUpTo(entry.version) }, null, 2) + '\n');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
