// End to end: a real daemon in a throwaway home, supervising the demo app on a free port.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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

  const daemon = spawn(process.execPath, [path.join(ROOT, 'bin', 'vigie.js'), 'daemon'], {
    env: { ...process.env, VIGIE_HOME: home, VIGIE_PORT: String(apiPort) },
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

  await t.test('a second server on the same port is refused, not moved', async () => {
    const added = await api('POST', '/projects/demo/servers', { name: 'twin', command: 'node server.js', port: appPort });
    assert.equal(added.ok, true, JSON.stringify(added.error));
    const res = await api('POST', '/servers/demo%2Ftwin/start', {});
    assert.equal(res.ok, false);
    assert.equal(res.error.code, 'PORT_IN_USE');
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
