import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeProject, normalizeServer } from '../src/config.js';
import { lastLines } from '../src/logs.js';
import { descendantsOf, parseLsof, parseNetstat, parseSs } from '../src/platform.js';
import { Supervisor, markInternal } from '../src/supervisor.js';

test('netstat: keeps listeners only, whatever the locale', () => {
  const text = `
Connexions actives

  Proto  Adresse locale         Adresse distante       État
  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       396
  TCP    127.0.0.1:3000         0.0.0.0:0              ABHÖREN         18552
  TCP    192.168.1.10:52011     140.82.112.21:443      ESTABLISHED     7000
  TCP    [::]:5173              [::]:0                 LISTENING       4242
  TCP    [::1]:4100             [::]:0                 BOUND           11`;
  assert.deepEqual(parseNetstat(text), [
    { port: 135, address: '0.0.0.0', pid: 396 },
    { port: 3000, address: '127.0.0.1', pid: 18552 },
    { port: 5173, address: '::', pid: 4242 },
  ]);
});

test('lsof field output', () => {
  const text = 'p41918\ncnode\nLmelvynx\nf20\nn*:3000\nf21\nn[::1]:3000\np660\ncControlCenter\nLmelvynx\nf9\nn*:5000\n';
  assert.deepEqual(
    parseLsof(text).map((l) => [l.port, l.pid, l.name, l.address]),
    [
      [3000, 41918, 'node', '0.0.0.0'],
      [3000, 41918, 'node', '::1'],
      [5000, 660, 'ControlCenter', '0.0.0.0'],
    ],
  );
});

test('ss output', () => {
  const text = 'LISTEN 0 511 0.0.0.0:3000 0.0.0.0:* users:(("node",pid=1234,fd=20))\nLISTEN 0 128 [::]:22 [::]:*\n';
  assert.deepEqual(
    parseSs(text).map((l) => [l.port, l.pid, l.name]),
    [
      [3000, 1234, 'node'],
      [22, 0, ''],
    ],
  );
});

test('descendantsOf maps grandchildren to their root', () => {
  const procs = new Map(
    [
      [10, 1], // cmd.exe spawned by Vigie
      [11, 10], // npm
      [12, 11], // node (owns the port)
      [20, 1], // unrelated
    ].map(([pid, ppid]) => [pid, { pid, ppid }]),
  );
  const owner = descendantsOf([10], procs);
  assert.equal(owner.get(12), 10);
  assert.equal(owner.has(20), false);
});

test('classify: extra listeners of a managed server are internal, not more servers', () => {
  const project = normalizeProject({ name: 'kreafy', root: '.', servers: [{ name: 'web', command: 'npm run dev', port: 3000 }] });
  const sup = new Supervisor({ config: { projects: [project] }, text: '' }, { apiPort: 7744 });
  const web = project.servers[0];
  sup.rt.get(web.id).pid = 100; // the shell Vigie spawned
  const proc = (pid, ppid, name) => [pid, { pid, ppid, session: 1, name, user: '', command: `${name} --dev` }];
  const procs = new Map([proc(100, 1, 'cmd.exe'), proc(14280, 100, 'node.exe'), proc(900, 1, 'node.exe')]);
  const listeners = [
    { port: 3000, pid: 14280, addresses: ['::'] },
    { port: 5173, pid: 900, addresses: ['0.0.0.0'] },
    { port: 55334, pid: 14280, addresses: ['127.0.0.1'] },
    { port: 55422, pid: 14280, addresses: ['127.0.0.1'] },
  ];
  const ports = sup.classify(listeners, procs);
  assert.deepEqual(
    ports.map((p) => [p.port, p.kind, p.serverName, p.internal, p.primaryPort]),
    [
      [3000, 'managed', 'kreafy/web', false, 3000],
      [5173, 'external', null, false, null],
      [55334, 'managed', 'kreafy/web', true, 3000],
      [55422, 'managed', 'kreafy/web', true, 3000],
    ],
  );
});

test('markInternal: lowest port is primary when the configured one is not listening', () => {
  const row = (port, serverId, kind = 'managed') => ({ port, serverId, kind });
  const ports = markInternal([row(3001, 'a'), row(4000, 'b'), row(60123, 'a'), row(61000, null, 'external')], (id) => ({ a: 3000, b: null })[id]);
  assert.deepEqual(
    ports.map((p) => [p.port, p.internal, p.primaryPort]),
    [
      [3001, false, 3001],
      [4000, false, 4000],
      [60123, true, 3001],
      [61000, false, null],
    ],
  );
});

test('normalizeServer fills defaults and turns off health checks without a port', () => {
  const s = normalizeServer({ command: 'npm run dev' });
  assert.equal(s.name, 'dev');
  assert.equal(s.port, null);
  assert.equal(s.health.type, 'none');
  assert.equal(normalizeServer({ command: 'x', port: '3000' }).health.type, 'tcp');
  assert.throws(() => normalizeServer({ command: 'x', port: 70000 }), /Invalid port/);
  assert.throws(() => normalizeServer({ name: 'web' }), /needs a command/);
});

test('lastLines', () => {
  assert.equal(lastLines('a\nb\nc\n', 2), 'b\nc\n');
  assert.equal(lastLines('a\nb', 5), 'a\nb\n');
});
