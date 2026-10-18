import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERSION = '0.1.0';
export const DEFAULT_API_PORT = 7744;

export const HOME = process.env.VIGIE_HOME || path.join(os.homedir(), '.config', 'vigie');
export const CONFIG_FILE = path.join(HOME, 'config.json');
export const STATE_FILE = path.join(HOME, 'state.json');
export const LOG_DIR = path.join(HOME, 'logs');
export const DAEMON_LOG = path.join(HOME, 'daemon.log');

export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const UI_DIR = path.join(PACKAGE_ROOT, 'ui');
export const BIN_FILE = path.join(PACKAGE_ROOT, 'bin', 'vigie.js');
export const SKILL_FILE = path.join(PACKAGE_ROOT, 'skill', 'SKILL.md');

export const IS_WIN = process.platform === 'win32';

/** True when the CLI runs through the desktop app's shim (the Vigie binary with ELECTRON_RUN_AS_NODE=1). */
export const VIA_APP = Boolean(process.versions.electron);

/**
 * How to start the supervisor in the background. Through the app's shim, process.execPath is the
 * Vigie binary: launch the app itself, hidden in the tray, so there is a single supervisor. With
 * plain Node, run `vigie daemon`.
 */
export function supervisorCommand() {
  if (!VIA_APP) return { file: process.execPath, args: [BIN_FILE, 'daemon'], env: process.env, app: false };
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  // Packaged, the app code is resources/app.asar and the binary loads it by itself. Unpackaged
  // (`npm run app`), process.execPath is the stock electron binary and needs the app folder.
  const packaged = path.basename(PACKAGE_ROOT) === 'app.asar';
  return { file: process.execPath, args: packaged ? ['--hidden'] : [PACKAGE_ROOT, '--hidden'], env, app: true };
}

/** Replace the home directory prefix with ~ for display. */
export function tildify(p) {
  const home = os.homedir();
  if (!p) return p;
  if (p.toLowerCase().startsWith(home.toLowerCase())) return '~' + p.slice(home.length).replace(/\\/g, '/');
  return p;
}
