// Vigie desktop: a native window over the supervisor, plus a tray menu to control servers
// without opening the window. The supervisor runs inside this process unless a daemon
// started by the CLI is already answering, in which case the app attaches to it.
import { app, BrowserWindow, dialog, Menu, Tray, nativeImage, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installSkill } from '../src/skill.js';
import { installCli, isCliInstalled, refreshCli, uninstallCli } from './cli-tool.js';
import { trayText } from './tray-strings.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ICONS = path.join(HERE, 'icons');
// The CLI the `vigie` shim runs: resources/app.asar/bin/vigie.js once packaged (Electron's node mode reads asar).
const CLI_SCRIPT = path.join(app.getAppPath(), 'bin', 'vigie.js');
const IS_MAC = process.platform === 'darwin';
const ACTIVE = new Set(['starting', 'running', 'unhealthy', 'restarting']);
const STATE_MARK = { running: '🟢', starting: '🟡', restarting: '🟡', stopping: '🟡', unhealthy: '🟠', failed: '🔴', stopped: '⚪' };

let apiBase = '';
let daemon = null; // set when the supervisor runs in this process
let win = null;
let tray = null;
let quitting = false;
let lastMenuKey = '';

if (!app.requestSingleInstanceLock()) app.quit();
// The CLI launches the app with --hidden when no supervisor answers: make sure one runs, but don't pop the window.
app.on('second-instance', (_event, argv) => {
  if (apiBase) ensureSupervisor().catch(() => {});
  if (!argv.includes('--hidden')) showWindow();
});
app.setAppUserModelId('dev.vigie.app');

// ------------------------------------------------------------------ daemon

async function ping() {
  try {
    const res = await fetch(`${apiBase}/api/health`, { signal: AbortSignal.timeout(800) });
    return res.ok;
  } catch {
    return false;
  }
}

async function startSupervisor() {
  const { loadConfig } = await import('../src/config.js');
  const port = Number(process.env.VIGIE_PORT) || loadConfig().config.apiPort;
  apiBase = `http://127.0.0.1:${port}`;
  await ensureSupervisor();
}

let takingOver = null;

/** Run the supervisor here unless another daemon answers. Also called when an attached CLI daemon goes away. */
function ensureSupervisor() {
  takingOver ??= (async () => {
    if (daemon || (await ping())) return false;
    const { runDaemon } = await import('../src/daemon.js');
    daemon = await runDaemon({ handleSignals: false, onExit: () => quit() });
    return true;
  })().finally(() => (takingOver = null));
  return takingOver;
}

async function api(method, route, body) {
  const res = await fetch(`${apiBase}/api${route}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json();
  if (!payload.ok) throw new Error(payload.error.message);
  return payload.data;
}

// ------------------------------------------------------------------ window

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 820,
    minHeight: 520,
    show: false,
    title: 'Vigie',
    icon: path.join(ICONS, 'icon.png'),
    backgroundColor: '#161618',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.loadURL(apiBase);
  win.once('ready-to-show', () => {
    if (!process.argv.includes('--hidden')) win.show();
  });

  // Links such as "Open ↗" go to the user's browser, never inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(apiBase)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Closing the window keeps the supervisor running in the tray.
  win.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
  });
}

function showWindow(hash) {
  if (!win) return;
  if (hash) win.webContents.executeJavaScript(`location.hash = ${JSON.stringify(hash)}`).catch(() => {});
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// -------------------------------------------------------------------- tray

function trayIcon() {
  const file = IS_MAC ? 'trayTemplate.png' : 'tray.png';
  const image = nativeImage.createFromPath(path.join(ICONS, file));
  if (IS_MAC) image.setTemplateImage(true);
  return image.resize({ width: IS_MAC ? 18 : 16, height: IS_MAC ? 18 : 16 });
}

function serverItems(project, t) {
  return project.servers.map((s) => {
    const active = ACTIVE.has(s.state);
    const run = (action) => () => api('POST', `/servers/${encodeURIComponent(s.id)}/${action}`).catch(notifyError).finally(refreshTray);
    return {
      label: `${STATE_MARK[s.state] || '⚪'}  ${s.name}${s.port ? `   :${s.port}` : ''}`,
      submenu: [
        { label: `${project.name}/${s.name} · ${s.state}`, enabled: false },
        { type: 'separator' },
        active ? { label: t('stop'), click: run('stop') } : { label: t('start'), click: run('start') },
        { label: t('restart'), enabled: active, click: run('restart') },
        { label: t('openBrowser'), enabled: Boolean(s.url && s.state === 'running'), click: () => shell.openExternal(s.url) },
        { label: t('openTerminal'), click: () => api('POST', `/projects/${encodeURIComponent(project.id)}/terminal`, { server: s.id }).catch(notifyError) },
        { label: t('showLogs'), click: () => showWindow(`#/s/${encodeURIComponent(s.id)}`) },
      ],
    };
  });
}

async function refreshTray() {
  if (!tray) return;
  let status = null;
  try {
    status = await api('GET', '/status');
  } catch {
    // The CLI daemon we were attached to stopped: take over so the window keeps working.
    if (!quitting && (await ensureSupervisor().catch(() => false))) {
      win?.reload();
      status = await api('GET', '/status').catch(() => null);
    }
  }
  const servers = status ? status.projects.flatMap((p) => p.servers) : [];
  const running = servers.filter((s) => s.state === 'running').length;
  const cliInstalled = isCliInstalled();
  const t = trayText(status?.language, app.getLocale());
  const key = JSON.stringify([status && status.projects.map((p) => [p.name, p.servers.map((s) => [s.id, s.name, s.state, s.port])]), status?.language, app.getLoginItemSettings().openAtLogin, cliInstalled]);
  if (key === lastMenuKey) return;
  lastMenuKey = key;

  const title = status ? t('running', { running, total: servers.length }) : t('unreachable');
  tray.setToolTip(title);
  const items = [{ label: title, enabled: false }];
  for (const p of status?.projects || []) {
    items.push({ type: 'separator' }, { label: p.name, enabled: false }, ...serverItems(p, t));
  }
  items.push(
    { type: 'separator' },
    { label: t('openVigie'), click: () => showWindow() },
    { label: t('ports'), click: () => showWindow('#/ports') },
    { label: t('manual'), click: () => showWindow('#/manual') },
    { label: t('stopAll'), enabled: servers.some((s) => ACTIVE.has(s.state)), click: () => api('POST', '/stop-all').catch(notifyError).finally(refreshTray) },
    { type: 'separator' },
    {
      label: t('launchAtLogin'),
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--hidden'] });
        refreshTray();
      },
    },
    cliInstalled ? { label: t('uninstallCli'), click: () => removeCliTool() } : { label: t('installCli'), click: () => addCliTool() },
    { label: t('installSkill'), click: () => addSkill() },
    { type: 'separator' },
    { label: daemon ? t('quitAll') : t('quit'), click: () => quit() },
  );
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

function notifyError(err) {
  if (tray && process.platform === 'win32') tray.displayBalloon({ iconType: 'error', title: 'Vigie', content: err.message });
}

function tell(message, detail, type = 'info') {
  return dialog.showMessageBox({ type, title: 'Vigie', message, detail, buttons: ['OK'], icon: type === 'info' ? path.join(ICONS, 'icon.png') : undefined });
}

// ------------------------------------------------------- command-line tool

async function addCliTool() {
  try {
    const { dir, onPath } = await installCli(CLI_SCRIPT);
    const where = process.platform === 'win32' ? `${dir} was added to your user PATH.` : `Linked from ${dir}/vigie.${onPath ? '' : `\n\n${dir} is not on your PATH yet: add it in your shell profile.`}`;
    await tell('The vigie command is installed', `${where}\n\nOpen a new terminal (or restart your editor / agent) and run:\n  vigie status --json\n\nTip: also choose "Install agent skill" so Claude Code, Codex and Cursor know to use it.`);
  } catch (err) {
    await tell('Could not install the vigie command', err.message, 'error');
  }
  refreshTray();
}

async function removeCliTool() {
  try {
    await uninstallCli();
    await tell('The vigie command was removed', 'Terminals opened from now on will no longer find it.');
  } catch (err) {
    await tell('Could not remove the vigie command', err.message, 'error');
  }
  refreshTray();
}

async function addSkill() {
  try {
    const dirs = installSkill();
    const cli = isCliInstalled() ? '' : '\n\nThe skill calls the vigie command: also choose "Install command-line tool".';
    await tell('Agent skill installed', `${dirs.join('\n')}${cli}`);
  } catch (err) {
    await tell('Could not install the agent skill', err.message, 'error');
  }
}

// --------------------------------------------------------------- lifecycle

async function quit() {
  if (quitting) return;
  quitting = true;
  tray?.destroy();
  tray = null;
  // Only stop servers if this app owns the supervisor; a CLI daemon keeps running.
  if (daemon) await daemon.shutdown().catch(() => {});
  app.exit(0);
}

app.on('before-quit', (event) => {
  if (quitting) return;
  event.preventDefault();
  quit();
});
app.on('window-all-closed', () => {
  /* stay alive in the tray */
});
app.on('activate', () => showWindow());

app.whenReady().then(async () => {
  try {
    await startSupervisor();
  } catch (err) {
    dialog.showErrorBox('Vigie could not start', err.message);
    app.exit(1);
    return;
  }
  try {
    refreshCli(CLI_SCRIPT, { isPackaged: app.isPackaged });
  } catch {
    /* the shim keeps its old target; reinstalling from the tray fixes it */
  }
  createWindow();
  tray = new Tray(trayIcon());
  tray.on('click', () => showWindow());
  tray.on('double-click', () => showWindow());
  await refreshTray();
  setInterval(refreshTray, 2000);
});
