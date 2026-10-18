// Open the system terminal in a folder: Windows Terminal or PowerShell, Terminal.app, or the first
// terminal emulator found on Linux.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { VigieError } from './errors.js';

function onPath(name, env) {
  const dirs = String(env.PATH || env.Path || '').split(path.delimiter).filter(Boolean);
  return dirs.some((d) => {
    try {
      return fs.statSync(path.join(d, name)).isFile();
    } catch {
      return false;
    }
  });
}

/**
 * The command that opens a terminal in `dir`, without running it.
 * `has(name)` says whether an executable is available (injectable for tests).
 */
export function terminalCommand(dir, { platform = process.platform, env = process.env, has = (n) => onPath(n, env) } = {}) {
  if (platform === 'win32') {
    const wt = path.join(env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps', 'wt.exe');
    if (has('wt.exe') || (env.LOCALAPPDATA && fs.existsSync(wt))) return { name: 'Windows Terminal', file: 'wt.exe', args: ['-d', dir] };
    // A detached console program gets its own window on Windows.
    return { name: 'PowerShell', file: 'powershell.exe', args: ['-NoLogo', '-NoExit'], cwd: dir };
  }
  if (platform === 'darwin') return { name: 'Terminal', file: 'open', args: ['-a', 'Terminal', dir] };
  const candidates = [
    ['x-terminal-emulator', []],
    ['gnome-terminal', [`--working-directory=${dir}`]],
    ['konsole', ['--workdir', dir]],
    ['xfce4-terminal', [`--working-directory=${dir}`]],
    ['kitty', ['--directory', dir]],
    ['alacritty', ['--working-directory', dir]],
    ['xterm', []],
  ];
  for (const [file, args] of candidates) if (has(file)) return { name: file, file, args, cwd: dir };
  return null;
}

export async function openTerminal(dir) {
  if (!fs.existsSync(dir)) throw new VigieError('ROOT_NOT_FOUND', `Directory not found: ${dir}`);
  const cmd = terminalCommand(dir);
  if (!cmd) throw new VigieError('NO_TERMINAL', 'No terminal application was found on this system');
  try {
    return await launch(cmd, dir);
  } catch (err) {
    // The wt.exe alias can outlive an uninstalled Windows Terminal: fall back to PowerShell.
    if (cmd.file !== 'wt.exe') throw err;
    return launch(terminalCommand(dir, { has: () => false, env: {} }), dir);
  }
}

function launch(cmd, dir) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd.file, cmd.args, { cwd: cmd.cwd || dir, detached: true, stdio: 'ignore', windowsHide: false });
    child.once('error', (err) => reject(new VigieError('TERMINAL_FAILED', `Could not open ${cmd.name}: ${err.message}`)));
    child.once('spawn', () => {
      child.unref();
      resolve({ opened: dir, terminal: cmd.name });
    });
  });
}
