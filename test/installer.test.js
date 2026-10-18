// The Windows installer asks a running Vigie to stop its servers before closing it (build/installer.nsh).
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STOP_SCRIPT = path.join(ROOT, 'build', 'vigie-stop.ps1');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('the NSIS include is wired in and electron-builder still offers the hooks it replaces', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const include = path.join(ROOT, pkg.build.nsis.include);
  const nsh = fs.readFileSync(include, 'utf8');
  assert.match(nsh, /!macro customCheckAppRunning/);
  assert.match(nsh, /vigie-stop\.ps1/);
  assert.ok(fs.existsSync(STOP_SCRIPT));

  // customCheckAppRunning replaces electron-builder's check; installer.nsh calls the original macros
  // and declares what the template then leaves out. A new electron-builder must keep all of that.
  const require = createRequire(import.meta.url);
  const templates = path.join(path.dirname(require.resolve('app-builder-lib/package.json')), 'templates', 'nsis', 'include');
  const check = fs.readFileSync(path.join(templates, 'allowOnlyOneInstallerInstance.nsh'), 'utf8');
  assert.match(check, /!ifmacrondef customCheckAppRunning\s+!include "getProcessInfo\.nsh"\s+Var pid\s+!endif/);
  assert.match(check, /!ifmacrodef customCheckAppRunning\s+!insertmacro customCheckAppRunning/);
  assert.match(check, /\$PowerShellPath/);
  for (const name of ['IS_POWERSHELL_AVAILABLE', '_CHECK_APP_RUNNING']) assert.match(check, new RegExp(`!macro ${name}\\b`));
  assert.ok(fs.existsSync(path.join(templates, 'getProcessInfo.nsh')));
});

/** A stand-in for Vigie's API in a child process: answers /api/health with its pid, quits on /api/shutdown. */
const FAKE_VIGIE = `
const http = require('node:http');
const fs = require('node:fs');
const [record] = process.argv.slice(2);
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/api/health') return res.end(JSON.stringify({ ok: true, data: { pid: process.pid } }));
    if (req.method === 'POST' && req.url === '/api/shutdown') {
      fs.writeFileSync(record, JSON.stringify({ host: req.headers.host, body }));
      res.end(JSON.stringify({ ok: true, data: { stopping: true } }));
      return setTimeout(() => process.exit(0), 1500); // stopping servers takes a moment
    }
    res.statusCode = 404;
    res.end('{"ok":false}');
  });
});
server.listen(0, '127.0.0.1', () => process.stdout.write(String(server.address().port) + '\\n'));
`;

function startFake(exe, dir, name) {
  const script = path.join(dir, `${name}.cjs`);
  const record = path.join(dir, `${name}.json`);
  fs.writeFileSync(script, FAKE_VIGIE);
  const child = spawn(exe, [script, record], { stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true });
  const port = new Promise((resolve) => child.stdout.once('data', (d) => resolve(Number(String(d).trim()))));
  const exited = new Promise((resolve) => child.once('exit', () => resolve(true)));
  return { child, port, exited, record };
}

test('vigie-stop.ps1 asks the app running from the install folder to shut down, and only it', { skip: process.platform !== 'win32' && 'Windows installer only', timeout: 60000 }, async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vigie-setup-'));
  const installDir = path.join(dir, 'Programs', 'Vigie');
  fs.mkdirSync(installDir, { recursive: true });
  // The "installed app" is a copy of node.exe in the install folder; the bystander runs from elsewhere.
  const appExe = path.join(installDir, 'Vigie.exe');
  fs.copyFileSync(process.execPath, appExe);
  const app = startFake(appExe, dir, 'app');
  const bystander = startFake(process.execPath, dir, 'bystander');
  t.after(async () => {
    for (const p of [app, bystander]) p.child.kill();
    await Promise.race([Promise.all([app.exited, bystander.exited]), sleep(3000)]);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  await Promise.all([app.port, bystander.port]);

  const started = Date.now();
  const output = await new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', STOP_SCRIPT, '-InstallDir', installDir, '-TimeoutSeconds', '20'], { windowsHide: true }, (err, stdout, stderr) => resolve({ code: err?.code ?? 0, stdout, stderr }));
  });
  assert.equal(output.code, 0, output.stderr);
  assert.match(output.stdout, /is stopping its servers/);
  assert.match(output.stdout, /stopped its servers and quit/);

  // It waited for the app to exit on its own, after being asked as the installer.
  assert.equal(await Promise.race([app.exited, sleep(100).then(() => false)]), true);
  assert.ok(Date.now() - started >= 1000, 'returned before the app had quit');
  const asked = JSON.parse(fs.readFileSync(app.record, 'utf8'));
  assert.equal(asked.host, `127.0.0.1:${await app.port}`);
  assert.deepEqual(JSON.parse(asked.body), { reason: 'installer' });

  // The process outside the install folder was left alone.
  assert.equal(fs.existsSync(bystander.record), false);
  assert.equal(bystander.child.exitCode, null);
});

test('vigie-stop.ps1 returns at once when the app is not running', { skip: process.platform !== 'win32' && 'Windows installer only', timeout: 60000 }, async () => {
  const empty = path.join(os.tmpdir(), `vigie-not-installed-${process.pid}`);
  const started = Date.now();
  const code = await new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', STOP_SCRIPT, '-InstallDir', empty], { windowsHide: true }, (err) => resolve(err?.code ?? 0));
  });
  assert.equal(code, 0);
  assert.ok(Date.now() - started < 20000);
});
