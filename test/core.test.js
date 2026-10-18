import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeServer } from '../src/config.js';
import { lastLines } from '../src/logs.js';
import { descendantsOf, parseLsof, parseNetstat, parseSs } from '../src/platform.js';

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
