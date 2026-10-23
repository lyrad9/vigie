// Windows: a Vigie folder given as an 8.3 short path (C:\Users\NGAKOD~1\…, the usual form of TEMP
// for a user name with a space) must not kill the daemon when config.json changes. libuv aborts the
// process at the first event of a folder watched under its short path.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function until(fn, { timeout = 30000, every = 300, what = 'condition' } = {}) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {
      /* not yet */
    }
    await sleep(every);
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** The 8.3 form of an existing folder, or the same path when the volume keeps no short names. */
function shortPath(dir) {
  const out = execFileSync('cmd.exe', ['/d', '/c', `for %I in ("${dir}") do @echo %~sI`], { windowsVerbatimArguments: true, encoding: 'utf8' });
  return out.trim().split(/\r?\n/).pop();
}

test('a Vigie folder given as a Windows short path survives config changes', { skip: process.platform !== 'win32' && 'Windows only', timeout: 90000 }, async (t) => {
  const long = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'vigie-short-path-'));
  const home = shortPath(long);
  t.after(() => fs.rmSync(long, { recursive: true, force: true }));
  if (home.toLowerCase() === long.toLowerCase()) return t.skip('this volume has no 8.3 short names');

  const port = await freePort();
  const daemon = spawn(process.execPath, [path.join(ROOT, 'bin', 'vigie.js'), 'daemon'], {
    env: { ...process.env, VIGIE_HOME: home, VIGIE_PORT: String(port) },
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });
  let stderr = '';
  daemon.stderr.on('data', (d) => (stderr += d));
  const api = (method, route) => fetch(`http://127.0.0.1:${port}/api${route}`, { method }).then((r) => r.json());
  t.after(async () => {
    await api('POST', '/shutdown').catch(() => {});
    await until(() => daemon.exitCode !== null, { timeout: 15000, what: 'daemon exit' }).catch(() => daemon.kill());
  });

  await until(() => api('GET', '/health').then((r) => r.ok), { what: `daemon health (stderr: ${stderr})` });

  // An edit by hand: the watcher sees it and reloads, and the daemon keeps answering.
  const file = path.join(long, 'config.json');
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, JSON.stringify({ ...config, language: 'fr' }, null, 2));
  const log = path.join(long, 'daemon.log');
  await until(() => fs.readFileSync(log, 'utf8').includes('config.json changed; reloaded'), { timeout: 15000, what: `the reload (stderr: ${stderr})` });
  assert.equal(daemon.exitCode, null, stderr);
  assert.equal((await api('GET', '/status')).data.language, 'fr');
});
