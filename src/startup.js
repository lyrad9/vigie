// Launch the daemon at login: Startup folder on Windows, LaunchAgent on macOS, systemd user unit on Linux.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { IS_WIN, supervisorCommand } from './paths.js';

function target() {
  // Plain Node runs `vigie daemon`; through the desktop app's shim this is the app, hidden in the tray.
  const { file, args } = supervisorCommand();
  const argv = [file, ...args];
  if (IS_WIN) {
    const dir = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
    const vbsArg = (p) => `""${p.replace(/"/g, '""')}""`;
    return {
      file: path.join(dir, 'vigie.vbs'),
      // A .vbs launcher runs node without flashing a console window.
      content: `Set sh = CreateObject("WScript.Shell")\r\nsh.Run "${argv.map(vbsArg).join(' ')}", 0, False\r\n`,
    };
  }
  if (process.platform === 'darwin') {
    return {
      file: path.join(os.homedir(), 'Library', 'LaunchAgents', 'dev.vigie.daemon.plist'),
      content: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>dev.vigie.daemon</string>
  <key>ProgramArguments</key>
  <array>${argv.map((a) => `<string>${a}</string>`).join('')}</array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
`,
    };
  }
  return {
    file: path.join(os.homedir(), '.config', 'systemd', 'user', 'vigie.service'),
    content: `[Unit]\nDescription=Vigie dev server supervisor\n\n[Service]\nExecStart=${argv.map((a) => `"${a}"`).join(' ')}\nRestart=on-failure\n\n[Install]\nWantedBy=default.target\n`,
    systemd: true,
  };
}

export function startupCommand(action) {
  const t = target();
  if (action === 'enable') {
    fs.mkdirSync(path.dirname(t.file), { recursive: true });
    fs.writeFileSync(t.file, t.content);
    if (t.systemd) {
      try {
        execFileSync('systemctl', ['--user', 'enable', 'vigie.service'], { stdio: 'ignore' });
      } catch {
        console.log('systemctl --user enable vigie.service failed; enable it manually.');
      }
    }
    return console.log(`✓ Vigie will start at login (${t.file})`);
  }
  if (action === 'disable') {
    if (t.systemd) {
      try {
        execFileSync('systemctl', ['--user', 'disable', 'vigie.service'], { stdio: 'ignore' });
      } catch {
        /* not enabled */
      }
    }
    fs.rmSync(t.file, { force: true });
    return console.log('✓ Vigie will no longer start at login');
  }
  console.log(fs.existsSync(t.file) ? `enabled (${t.file})` : 'disabled');
}
