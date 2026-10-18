// End to end: a real daemon in a throwaway home, supervising the demo app on a free port.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
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
  let last;
  while (Date.now() < end) {
    try {
      last = await fn();
      if (last) return last;
    } catch {
      /* not yet */
    }
    await sleep(every);
  }
  throw new Error(`timed out waiting for ${what}`);
}

test('daemon supervises a server end to end', { timeout: 180000 }, async (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vigie-smoke-'));
  const apiPort = await freePort();
  const appPort = await freePort();
  const base = `http://127.0.0.1:${apiPort}/api`;
  const api = async (method, route, body) => {
    const res = await fetch(base + route, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, ...(await res.json()) };
  };
  const env = { ...process.env, VIGIE_HOME: home, VIGIE_PORT: String(apiPort) };
  const cli = (...args) => spawnSync(process.execPath, [path.join(ROOT, 'bin', 'vigie.js'), ...args], { env, encoding: 'utf8', timeout: 30000 });

  const daemon = spawn(process.execPath, [path.join(ROOT, 'bin', 'vigie.js'), 'daemon'], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  daemon.stdout.on('data', (d) => (output += d));
  daemon.stderr.on('data', (d) => (output += d));

  t.after(async () => {
    await api('POST', '/shutdown').catch(() => {});
    await until(() => daemon.exitCode !== null, { timeout: 15000, what: 'daemon exit' }).catch(() => daemon.kill());
    fs.rmSync(home, { recursive: true, force: true });
  });

  await t.test('the API comes up on loopback', async () => {
    const health = await until(() => api('GET', '/health'), { what: `daemon health (output: ${output})` });
    assert.equal(health.ok, true);
  });

  await t.test('requests with a foreign Host header are refused', async () => {
    const status = await new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port: apiPort, path: '/api/status', headers: { Host: 'evil.example' } }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on('error', reject);
      req.end();
    });
    assert.equal(status, 403);
  });

  await t.test('a project is registered', async () => {
    const res = await api('POST', '/projects', {
      name: 'demo',
      root: path.join(ROOT, 'examples', 'demo-app'),
      servers: [{ name: 'dev', command: 'node server.js', port: appPort }],
    });
    assert.equal(res.ok, true, JSON.stringify(res.error));
    assert.equal(res.data.servers[0].port, appPort);
  });

  await t.test('the server starts, turns healthy and answers', async () => {
    const started = await api('POST', '/servers/demo%2Fdev/start', {});
    assert.equal(started.ok, true, JSON.stringify(started.error));
    const view = await until(
      async () => {
        const r = await api('GET', '/servers/demo%2Fdev');
        return r.data.state === 'running' && r.data.healthy === true ? r.data : null;
      },
      { timeout: 60000, what: 'server running and healthy' },
    );
    assert.equal(view.port, appPort);
    const body = await (await fetch(`http://127.0.0.1:${appPort}/`)).text();
    assert.match(body, /hello from demo-app/);
  });

  await t.test('the port is reported as managed by Vigie', async () => {
    const owners = await until(
      async () => {
        const r = await api('GET', `/port/${appPort}`);
        return r.data.owners.some((o) => o.kind === 'managed') ? r.data.owners : null;
      },
      { timeout: 30000, what: 'managed port owner' },
    );
    assert.equal(owners.find((o) => o.kind === 'managed').serverName, 'demo/dev');
  });

  let suggested;
  await t.test('registering a server on a port another server is configured on is refused, with a free port', async () => {
    const res = await api('POST', '/projects/demo/servers', { name: 'twin', command: 'node server.js', port: appPort });
    assert.equal(res.status, 409);
    assert.equal(res.error.code, 'PORT_CONFLICT');
    assert.match(res.error.message, /demo\/dev/);
    assert.deepEqual(res.error.details.servers.map((s) => [s.serverName, s.state]), [['demo/dev', 'running']]);
    const free = (suggested = res.error.details.suggestedPort);
    assert.ok(free > appPort && free !== apiPort, `suggested ${free}`);
    const owners = await api('GET', `/port/${free}`);
    assert.deepEqual([owners.data.owners, owners.data.configured], [[], []], 'the suggested port is neither held nor configured');

    const viaCli = cli('register', '--root', path.join(ROOT, 'examples', 'demo-app'), '--server', 'twin', '--command', 'node server.js', '--port', String(appPort), '--json');
    assert.equal(viaCli.status, 1, viaCli.stderr);
    const out = JSON.parse(viaCli.stdout);
    assert.equal(out.error.code, 'PORT_CONFLICT');
    assert.equal(out.error.details.suggestedPort, free);
  });

  await t.test('a second server on the same port is refused, not moved', async () => {
    const added = await api('POST', '/projects/demo/servers', { name: 'twin', command: 'node server.js', port: appPort, sharePort: true });
    assert.equal(added.ok, true, JSON.stringify(added.error));
    const res = await api('POST', '/servers/demo%2Ftwin/start', {});
    assert.equal(res.ok, false);
    assert.equal(res.error.code, 'PORT_IN_USE');
  });

  await t.test('moving a server onto a configured port is refused; saving one that shares its port is not', async () => {
    const edited = await api('PATCH', '/servers/demo%2Ftwin', { command: 'node server.js --twin', port: appPort });
    assert.equal(edited.ok, true, JSON.stringify(edited.error));
    const spare = await api('POST', '/projects/demo/servers', { name: 'spare', command: 'node server.js', port: suggested });
    assert.equal(spare.ok, true, JSON.stringify(spare.error));
    const moved = await api('PATCH', '/servers/demo%2Fspare', { port: appPort });
    assert.equal(moved.error?.code, 'PORT_CONFLICT');
    assert.deepEqual(moved.error.details.servers.map((s) => s.serverName).sort(), ['demo/dev', 'demo/twin']);
    assert.equal(moved.error.details.suggestedPort, suggested, 'the port it already has counts as free for it');
    const removed = await api('DELETE', '/servers/demo%2Fspare');
    assert.equal(removed.ok, true);
  });

  await t.test('a server between restarts keeps its port: reported, and no other server may start on it', async () => {
    // Exits at once, so Vigie keeps restarting it: like a dev server failing its health checks.
    const port = await freePort();
    const flaky = await api('POST', '/projects/demo/servers', { name: 'flaky', command: 'node --version', port, maxRestartAttempts: 50 });
    assert.equal(flaky.ok, true, JSON.stringify(flaky.error));
    await api('POST', '/servers/demo%2Fflaky/start', {});
    await until(async () => (await api('GET', '/servers/demo%2Fflaky')).data.state === 'restarting', { what: 'flaky restarting' });

    const { data } = await api('GET', `/port/${port}`);
    assert.equal(data.owners.length, 1);
    const [o] = data.owners;
    assert.deepEqual([o.kind, o.listening, o.serverName], ['managed', false, 'demo/flaky']);
    assert.ok(['starting', 'restarting'].includes(o.state), o.state);
    const report = await api('GET', '/ports');
    assert.ok(report.data.ports.some((p) => p.serverName === 'demo/flaky' && p.port === port && !p.listening));
    assert.ok(report.data.summary.reserved >= 1);
    assert.match(cli('port', String(port)).stdout, /demo\/flaky.*not listening/);

    const conflict = await api('POST', '/projects/demo/servers', { name: 'squatter', command: 'node server.js', port });
    assert.equal(conflict.error?.code, 'PORT_CONFLICT');
    assert.match(conflict.error.message, /demo\/flaky/);
    const squatter = await api('POST', '/projects/demo/servers', { name: 'squatter', command: 'node server.js', port, sharePort: true });
    assert.equal(squatter.ok, true, JSON.stringify(squatter.error));
    const refused = await api('POST', '/servers/demo%2Fsquatter/start', {});
    assert.equal(refused.error?.code, 'PORT_IN_USE');
    assert.match(refused.error.message, /demo\/flaky/);

    // Restarting a server that is between restarts is not blocked by its own reservation.
    const again = await api('POST', '/servers/demo%2Fflaky/start', {});
    assert.equal(again.ok, true, JSON.stringify(again.error));

    await api('POST', '/servers/demo%2Fflaky/stop', {});
    const after = await api('GET', `/port/${port}`);
    assert.deepEqual(after.data.owners, []);
    assert.deepEqual(after.data.configured.map((s) => [s.serverName, s.state]).sort(), [['demo/flaky', 'stopped'], ['demo/squatter', 'stopped']]);
    assert.match(cli('port', String(port)).stdout, /free right now[\s\S]*demo\/flaky \(stopped\)/);
    for (const name of ['flaky', 'squatter']) await api('DELETE', `/servers/demo%2F${name}`);
  });

  await t.test('a new folder is offered a port no other server has, and keeps it when registered again', async (t2) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vigie-next-'));
    t2.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'shop', scripts: { dev: 'next dev' }, dependencies: { next: '16.0.0' } }));
    // Next.js defaults to 3000: make sure another server has it, whatever runs on this machine.
    const holder = await api('POST', '/projects/demo/servers', { name: 'next', command: 'next dev', port: 3000, sharePort: true });
    assert.equal(holder.ok, true, JSON.stringify(holder.error));

    const r = await api('GET', `/resolve?cwd=${encodeURIComponent(dir)}`);
    const g = r.data.inspect.suggestion;
    assert.equal(g.portMovedFrom, 3000);
    assert.deepEqual(g.portTakenBy.servers, ['demo/next']);
    assert.ok(g.port > 3000, `suggested ${g.port}`);
    assert.equal(g.command, `npm run dev -- -p ${g.port}`);
    const free = await api('GET', `/port/${g.port}`);
    assert.deepEqual([free.data.owners, free.data.configured], [[], []]);
    const asked = await api('GET', `/inspect?root=${encodeURIComponent(dir)}&port=3000`);
    assert.deepEqual([asked.data.suggestion.port, asked.data.suggestion.portMovedFrom], [3000, undefined], 'an explicit port is kept');

    const first = cli('register', '--root', dir, '--json');
    assert.equal(first.status, 0, first.stderr + first.stdout);
    const registered = JSON.parse(first.stdout);
    assert.deepEqual([registered.server.port, registered.server.command, registered.portMovedFrom], [g.port, g.command, 3000]);
    const second = cli('register', '--root', dir, '--json');
    assert.equal(second.status, 0, second.stderr + second.stdout);
    const again = JSON.parse(second.stdout);
    assert.deepEqual([again.server.id, again.server.port, again.server.command], [registered.server.id, g.port, g.command]);

    await api('DELETE', '/projects/shop');
    await api('DELETE', '/servers/demo%2Fnext');
  });

  await t.test('logs are captured', async () => {
    const logs = await until(
      async () => {
        const r = await api('GET', '/servers/demo%2Fdev/logs?lines=50');
        return /ready on/.test(r.data.text) ? r.data.text : null;
      },
      { what: 'server output in logs' },
    );
    assert.match(logs, /\[vigie\] starting: node server\.js/);
  });

  await t.test('stopping frees the port', async () => {
    const stopped = await api('POST', '/servers/demo%2Fdev/stop', {});
    assert.equal(stopped.data.state, 'stopped');
    await until(
      () =>
        new Promise((resolve) => {
          const socket = net.connect({ port: appPort, host: '127.0.0.1' });
          socket.once('connect', () => (socket.destroy(), resolve(false)));
          socket.once('error', () => resolve(true));
        }),
      { timeout: 20000, what: 'port to be released' },
    );
  });
});
