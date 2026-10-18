// End to end: a previous Vigie died without stopping its server (the Windows installer killed it),
// so the server's tree still holds the port. The next daemon recognizes it, replaces it and logs it;
// a process started some other way on another restored server's port is left alone.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { normalizeConfig, serializeConfig } from '../src/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IS_WIN = process.platform === 'win32';
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

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
};

const SERVER = `
const http = require('node:http');
http.createServer((req, res) => res.end(process.pid + '\\n')).listen(Number(process.env.PORT), () => console.log('ready on ' + process.env.PORT));
`;

// Plays the old Vigie: spawns the server the way the supervisor does, prints the shell's pid once
// the port answers, then dies without stopping it.
const OLD_VIGIE = `
const { spawn } = require('node:child_process');
const net = require('node:net');
const [command, cwd, port] = process.argv.slice(2);
const env = { ...process.env, PORT: port };
const child = process.platform === 'win32'
  ? spawn(command, { cwd, env, shell: true, windowsHide: true, stdio: 'ignore' })
  : spawn(process.env.SHELL || '/bin/sh', ['-lc', command], { cwd, env, detached: true, stdio: 'ignore' });
child.unref();
const probe = () => {
  const s = net.connect(Number(port), '127.0.0.1');
  s.once('connect', () => { s.destroy(); console.log(child.pid); process.exit(0); });
  s.once('error', () => setTimeout(probe, 200));
};
probe();
`;

function run(args, opts) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true, ...opts });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.once('error', reject);
    child.once('exit', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`exit ${code}`))));
  });
}

test('at boot, a leftover of the same server is replaced, and nothing else is touched', { timeout: 180000 }, async (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vigie-restore-'));
  const project = path.join(home, 'kreafy');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'server.js'), SERVER);
  fs.writeFileSync(path.join(home, 'old-vigie.cjs'), OLD_VIGIE);
  // The script's absolute path is what ties the processes to the project on Windows, as a
  // framework's node_modules binary does for a real dev server.
  const command = `node "${path.join(project, 'server.js')}"`;
  const [apiPort, webPort, docsPort] = await Promise.all([freePort(), freePort(), freePort()]);

  const config = normalizeConfig({
    projects: [{ name: 'kreafy', root: project, servers: [{ name: 'web', command, port: webPort }, { name: 'docs', command, port: docsPort }] }],
  });
  const [web, docs] = config.projects[0].servers;
  fs.writeFileSync(path.join(home, 'config.json'), serializeConfig(config));
  fs.writeFileSync(path.join(home, 'state.json'), JSON.stringify({ running: [web.id, docs.id] }));

  // web: left behind by a dead Vigie. docs: the same command on its port, but started by a live
  // parent (this test), like a server the user runs in a terminal.
  const orphanRoot = Number(await run([path.join(home, 'old-vigie.cjs'), command, project, String(webPort)], { cwd: home }));
  const bystander = spawn(process.execPath, [path.join(project, 'server.js')], { cwd: project, env: { ...process.env, PORT: String(docsPort) }, stdio: 'ignore', windowsHide: true });
  const orphanPid = Number(await until(() => fetch(`http://127.0.0.1:${webPort}/`).then((r) => r.text()), { what: 'orphan server' }));
  await until(() => fetch(`http://127.0.0.1:${docsPort}/`).then((r) => r.ok), { what: 'bystander server' });

  const base = `http://127.0.0.1:${apiPort}/api`;
  const api = (method, route) => fetch(base + route, { method }).then((r) => r.json());
  const daemon = spawn(process.execPath, [path.join(ROOT, 'bin', 'vigie.js'), 'daemon'], {
    env: { ...process.env, VIGIE_HOME: home, VIGIE_PORT: String(apiPort) },
    stdio: 'ignore',
    windowsHide: true,
  });
  t.after(async () => {
    await api('POST', '/shutdown').catch(() => {});
    await until(() => daemon.exitCode !== null, { timeout: 20000, what: 'daemon exit' }).catch(() => daemon.kill());
    bystander.kill();
    for (const pid of [orphanRoot, orphanPid]) if (alive(pid)) spawn(IS_WIN ? 'taskkill' : 'kill', IS_WIN ? ['/PID', String(pid), '/T', '/F'] : ['-9', String(pid)]);
    await sleep(500);
    fs.rmSync(home, { recursive: true, force: true });
  });

  const view = await until(
    async () => {
      const r = await api('GET', `/servers/${web.id}`);
      return r.data.state === 'running' && r.data.healthy === true ? r.data : null;
    },
    { timeout: 90000, what: 'web restored and healthy' },
  );
  const servedBy = Number(await (await fetch(`http://127.0.0.1:${webPort}/`)).text());
  assert.notEqual(servedBy, orphanPid, 'the port is now served by the new process');
  assert.ok(view.pid);
  await until(() => !alive(orphanPid), { timeout: 10000, what: 'leftover to exit' });

  const log = fs.readFileSync(path.join(home, 'daemon.log'), 'utf8');
  const notice = log.match(new RegExp(`kreafy/web: port ${webPort} is held by what a previous Vigie left of this server \\(pid (\\d+), same command\\)`));
  assert.ok(notice, log);
  // The root is the shell, or the server itself when the shell is gone (on Windows cmd.exe dies with its parent).
  assert.ok([orphanRoot, orphanPid].includes(Number(notice[1])), `root pid ${notice[1]}`);

  // docs keeps PORT_IN_USE and its owner keeps running.
  const docsView = await api('GET', `/servers/${docs.id}`);
  assert.notEqual(docsView.data.state, 'running');
  assert.match(log, new RegExp(`Port ${docsPort} is used by .*started outside Vigie`));
  assert.equal(bystander.exitCode, null);
  assert.ok((await fetch(`http://127.0.0.1:${docsPort}/`)).ok);
});
