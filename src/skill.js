// Install the agent skill (skill/SKILL.md). Shared by `vigie skill install` and the desktop tray.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SKILL_FILE } from './paths.js';

/** Copy SKILL.md to ~/.agents/skills/vigie, and to ~/.claude/skills/vigie when Claude Code is installed. Returns the directories written. */
export function installSkill() {
  const targets = [path.join(os.homedir(), '.agents', 'skills', 'vigie')];
  if (fs.existsSync(path.join(os.homedir(), '.claude'))) targets.push(path.join(os.homedir(), '.claude', 'skills', 'vigie'));
  // readFileSync instead of copyFileSync: in the desktop app SKILL_FILE lives inside app.asar.
  const text = fs.readFileSync(SKILL_FILE);
  for (const dir of targets) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), text);
  }
  return targets;
}
