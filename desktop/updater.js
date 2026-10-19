// Automatic updates from the GitHub releases (electron-updater reads latest.yml next to the installer).
// Only the installed app updates itself: not `npm run app`, and not macOS, where an unsigned app
// cannot be replaced in place. A failure here never stops the app from running.
import fs from 'node:fs';
import { app, net } from 'electron';
import { DAEMON_LOG } from '../src/paths.js';
import { sanitizeChangelog } from '../ui/changelog.js';

const EVERY = 4 * 60 * 60 * 1000;
// The releases electron-updater reads (build.publish in package.json).
export const RELEASES = 'https://github.com/lyrad9/vigie/releases';
const notesCache = new Map();

function log(message) {
  try {
    fs.appendFileSync(DAEMON_LOG, `${new Date().toISOString()} updater: ${message}\n`);
  } catch {
    /* ignore */
  }
}

/** Whether this copy of the app can update itself. */
export function canSelfUpdate({ packaged = app.isPackaged, platform = process.platform, env = process.env } = {}) {
  return packaged && (platform === 'win32' || (platform === 'linux' && Boolean(env.APPIMAGE)));
}

/**
 * @param {{ onChange: () => void, onReady: (version: string) => void }} hooks
 */
export function createUpdater({ onChange, onReady }) {
  // status: idle | checking | downloading | ready | current | error. progress: download percent. checkedAt: last answer from GitHub.
  const state = { status: 'idle', version: null, error: null, progress: null, checkedAt: null };
  let updater = null;
  let timer = null;

  const set = (patch) => {
    Object.assign(state, patch);
    onChange();
  };
  const now = () => new Date().toISOString();

  async function load() {
    if (updater) return updater;
    if (!canSelfUpdate()) return null;
    try {
      const mod = await import('electron-updater');
      updater = (mod.default ?? mod).autoUpdater;
    } catch (err) {
      log(`unavailable: ${err.message}`);
      return null;
    }
    updater.autoDownload = true;
    // Quitting goes through our own quit(), which stops the servers first and then installs.
    updater.autoInstallOnAppQuit = false;
    updater.logger = { info: () => {}, warn: (m) => log(String(m)), error: (m) => log(String(m)), debug: () => {} };
    updater.on('checking-for-update', () => state.status !== 'ready' && set({ status: 'checking', error: null }));
    updater.on('update-not-available', () => state.status !== 'ready' && set({ status: 'current', checkedAt: now() }));
    updater.on('update-available', (info) => set({ status: 'downloading', version: info.version, progress: 0, checkedAt: now() }));
    updater.on('download-progress', (p) => {
      const progress = Math.floor(p?.percent ?? 0);
      if (state.status === 'downloading' && progress !== state.progress) set({ progress });
    });
    updater.on('update-downloaded', (info) => {
      log(`${info.version} downloaded`);
      set({ status: 'ready', version: info.version, progress: 100 });
      onReady(info.version);
    });
    updater.on('error', (err) => {
      log(`error: ${err?.message || err}`);
      if (state.status !== 'ready') set({ status: 'error', error: err?.message || String(err), progress: null, checkedAt: now() });
    });
    return updater;
  }

  return {
    state,
    enabled: canSelfUpdate(),

    /** Check now; with `schedule`, keep checking every few hours. Resolves to the final state. */
    async check({ schedule = false } = {}) {
      const u = await load();
      if (!u) return state;
      if (schedule && !timer) {
        timer = setInterval(() => u.checkForUpdates().catch(() => {}), EVERY);
        timer.unref?.();
      }
      if (state.status === 'ready' || state.status === 'downloading') return state;
      try {
        await u.checkForUpdates();
      } catch (err) {
        if (state.status !== 'ready') set({ status: 'error', error: err.message });
      }
      return state;
    },

    /**
     * What changed up to `version`, read from that release's changelog.json (scripts/release-notes.js),
     * so the Updates page can describe a version this copy does not know yet. Null when unreachable.
     */
    async notes(version) {
      if (!/^\d+\.\d+\.\d+$/.test(String(version))) return null;
      if (!notesCache.has(version)) {
        notesCache.set(
          version,
          net
            .fetch(`${RELEASES}/download/v${version}/changelog.json`, { signal: AbortSignal.timeout(10000) })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => (data ? sanitizeChangelog(data) : null))
            .catch((err) => {
              log(`notes for ${version}: ${err.message}`);
              return null;
            }),
        );
      }
      const notes = await notesCache.get(version);
      if (!notes) notesCache.delete(version); // try again next time
      return notes;
    },

    /** Run the downloaded installer silently. Returns false when there is nothing to install. */
    install({ restart }) {
      if (state.status !== 'ready' || !updater) return false;
      log(`installing ${state.version}${restart ? ' and restarting' : ''}`);
      try {
        updater.quitAndInstall(true, restart);
        return true;
      } catch (err) {
        log(`install failed: ${err.message}`);
        return false;
      }
    },
  };
}
