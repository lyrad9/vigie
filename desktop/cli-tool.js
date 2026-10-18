// "Install command-line tool": puts a `vigie` shim on the PATH that runs the CLI bundled in this
// app (the Vigie binary with ELECTRON_RUN_AS_NODE=1 against bin/vigie.js), so agents can call
// `vigie status --json` without Node or `npm link`.
//   Windows: %LOCALAPPDATA%\Vigie\bin\vigie.cmd (+ a `vigie` sh script for Git Bash), folder
//            added to the user PATH (HKCU\Environment).
//   macOS/Linux: ~/.config/vigie/bin/vigie, symlinked from ~/.local/bin/vigie.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HOME } from '../src/paths.js';

const IS_WIN = process.platform === 'win32';
export const CLI_DIR = IS_WIN ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Vigie', 'bin') : path.join(HOME, 'bin');
const LINK = path.join(os.homedir(), '.local', 'bin', 'vigie');
const NOTICE = 'Vigie command-line tool: runs the CLI bundled in the desktop app. Written by Vigie (tray menu); do not edit.';

/** Shim files to write, as { file: content }. `script` is the bundled bin/vigie.js (inside app.asar when packaged). */
function shims(script, exe = process.execPath) {
  const sq = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
  const fwd = (p) => p.replace(/\\/g, '/');
  // POSIX sh shim: macOS/Linux, and Git Bash on Windows (it does not run .cmd files without the extension).
  const sh = (e, s) =>
    `#!/bin/sh\n# ${NOTICE}\n[ -e ${sq(e)} ] || { echo "vigie: the Vigie app was moved or uninstalled; reinstall the command-line tool from its tray menu." >&2; exit 1; }\nELECTRON_RUN_AS_NODE=1 exec ${sq(e)} ${sq(s)} "$@"\n`;
  if (!IS_WIN) return { [path.join(CLI_DIR, 'vigie')]: sh(exe, script) };
  const bat = (p) => p.replace(/%/g, '%%');
  const cmd = [
    '@echo off',
    `rem ${NOTICE}`,
    `if not exist "${bat(exe)}" goto missing`,
    'setlocal',
    'set ELECTRON_RUN_AS_NODE=1',
    `"${bat(exe)}" "${bat(script)}" %*`,
    'exit /b %ERRORLEVEL%',
    ':missing',
    'echo vigie: the Vigie app was moved or uninstalled; reinstall the command-line tool from its tray menu. 1>&2',
    'exit /b 1',
    '',
  ].join('\r\n');
  return { [path.join(CLI_DIR, 'vigie.cmd')]: cmd, [path.join(CLI_DIR, 'vigie')]: sh(fwd(exe), fwd(script)) };
}

export function isCliInstalled() {
  return IS_WIN ? fs.existsSync(path.join(CLI_DIR, 'vigie.cmd')) : isOurLink();
}

function isOurLink() {
  try {
    return fs.readlinkSync(LINK) === path.join(CLI_DIR, 'vigie');
  } catch {
    return false;
  }
}

function writeShims(script) {
  fs.mkdirSync(CLI_DIR, { recursive: true });
  for (const [file, content] of Object.entries(shims(script))) {
    let current = null;
    try {
      current = fs.readFileSync(file, 'utf8');
    } catch {
      /* new file */
    }
    if (current !== content) fs.writeFileSync(file, content, { mode: 0o755 });
  }
}

/** Keep an installed shim pointing at this copy of the app (after an update or a move). Never installs one. */
export function refreshCli(script) {
  if (isCliInstalled()) writeShims(script);
}

/** Install the shim and put it on the PATH. Returns { dir, onPath } where onPath says whether new terminals will find it. */
export async function installCli(script) {
  writeShims(script);
  if (IS_WIN) {
    await editUserPath('add');
    return { dir: CLI_DIR, onPath: true };
  }
  fs.mkdirSync(path.dirname(LINK), { recursive: true });
  let existing = null;
  try {
    existing = fs.lstatSync(LINK);
  } catch {
    /* free */
  }
  if (existing && !existing.isSymbolicLink()) throw new Error(`${LINK} already exists and is not a Vigie link; remove it first.`);
  if (existing) fs.rmSync(LINK);
  fs.symlinkSync(path.join(CLI_DIR, 'vigie'), LINK);
  const dirs = (process.env.PATH || '').split(path.delimiter);
  return { dir: path.dirname(LINK), onPath: dirs.includes(path.dirname(LINK)) };
}

export async function uninstallCli() {
  if (IS_WIN) await editUserPath('remove');
  else if (isOurLink()) fs.rmSync(LINK);
  for (const file of Object.keys(shims(''))) fs.rmSync(file, { force: true });
}

/**
 * Add CLI_DIR to (or remove it from) the user PATH in HKCU\Environment, keeping the value's
 * REG_EXPAND_SZ type and unexpanded %VARS%, then broadcast WM_SETTINGCHANGE so new terminals see it.
 */
function editUserPath(op) {
  const script = `
$dir = $env:VIGIE_CLI_DIR
$k = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey('Environment')
$cur = [string]$k.GetValue('Path', '', 'DoNotExpandEnvironmentNames')
$parts = @($cur -split ';' | Where-Object { $_ -and ($_.TrimEnd('\\') -ne $dir.TrimEnd('\\')) })
if ($env:VIGIE_PATH_OP -eq 'add') { $parts += $dir }
$next = $parts -join ';'
if ($next -ne $cur) {
  $kind = 'ExpandString'
  if ($cur -and $k.GetValueKind('Path') -eq 'String') { $kind = 'String' }
  $k.SetValue('Path', $next, $kind)
  # .NET broadcasts WM_SETTINGCHANGE("Environment") on every user-variable write.
  [Environment]::SetEnvironmentVariable('VIGIE_PATH_REFRESH', '1', 'User')
  [Environment]::SetEnvironmentVariable('VIGIE_PATH_REFRESH', $null, 'User')
}
$k.Close()`;
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { env: { ...process.env, VIGIE_CLI_DIR: CLI_DIR, VIGIE_PATH_OP: op }, windowsHide: true, timeout: 30000 },
      (err, _stdout, stderr) => (err ? reject(new Error(`could not update the user PATH: ${stderr.trim() || err.message}`)) : resolve()),
    );
  });
}
