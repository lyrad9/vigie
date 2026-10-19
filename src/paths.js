import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERSION = '0.1.5';
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
 * The AppImage file this process runs from, or null. An AppImage runs its binary from a mount
 * (/tmp/.mount_XXXX) that is new on every launch and gone once it quits, so whatever must outlive
 * this process (the CLI shim, the login item, the app started by the CLI) runs the AppImage file.
 * The runtime sets APPIMAGE and APPDIR for what it launches and every child inherits them: they
 * only count when this binary sits in that APPDIR.
 */
export function appImageFile({ env = process.env, exe = process.execPath, platform = process.platform } = {}) {
  if (platform !== 'linux' || !env.APPIMAGE || !env.APPDIR) return null;
  let dir = env.APPDIR;
  try {
    dir = fs.realpathSync(dir);
  } catch {
    /* keep it as given */
  }
  const rel = path.posix.relative(dir, exe);
  return rel && rel.split('/')[0] !== '..' && !path.posix.isAbsolute(rel) ? env.APPIMAGE : null;
}

/**
 * How to start the supervisor in the background. Through the app's shim, process.execPath is the
 * Vigie binary: launch the app itself, hidden in the tray, so there is a single supervisor. With
 * plain Node, run `vigie daemon`.
 */
export function supervisorCommand({
  viaApp = VIA_APP,
  exe = process.execPath,
  env: parentEnv = process.env,
  packageRoot = PACKAGE_ROOT,
  appImage = appImageFile({ env: parentEnv, exe }),
} = {}) {
  if (!viaApp) return { file: exe, args: [BIN_FILE, 'daemon'], env: parentEnv, app: false };
  const env = { ...parentEnv };
  delete env.ELECTRON_RUN_AS_NODE;
  // Packaged, the app code is resources/app.asar and the binary loads it by itself. Unpackaged
  // (`npm run app`), process.execPath is the stock electron binary and needs the app folder.
  const packaged = path.basename(packageRoot) === 'app.asar';
  if (!packaged) return { file: exe, args: [packageRoot, '--hidden'], env, app: true };
  // From an AppImage, exe sits in this run's mount: start the AppImage file, which mounts its own
  // (and whose AppRun adds --no-sandbox where the system needs it).
  return { file: appImage || exe, args: ['--hidden'], env, app: true };
}

/** Replace the home directory prefix with ~ for display. */
export function tildify(p) {
  const home = os.homedir();
  if (!p) return p;
  if (p.toLowerCase().startsWith(home.toLowerCase())) return '~' + p.slice(home.length).replace(/\\/g, '/');
  return p;
}
