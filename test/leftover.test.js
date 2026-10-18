// A server left running by a previous Vigie is recognized, and nothing else is.
import assert from 'node:assert/strict';
import test from 'node:test';
import { absolutePaths, findLeftover } from '../src/leftover.js';

const NODE = '"C:\\Program Files\\nodejs\\node.exe"';
const T = 1_800_000_000_000;

/** The tree Vigie 0.1.0 left on the user's machine when the 0.1.2 installer killed it (old Vigie: pid 4321). */
function kreafyTree() {
  return [
    [5000, 4321, 'cmd.exe', 'C:\\WINDOWS\\system32\\cmd.exe /d /s /c "pnpm dev -p 3000"'],
    [5001, 5000, 'conhost.exe', '\\??\\C:\\WINDOWS\\system32\\conhost.exe 0x4'],
    [5002, 5000, 'node.exe', `${NODE} "C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\pnpm\\bin\\pnpm.cjs" dev -p 3000`],
    [5003, 5002, 'cmd.exe', 'C:\\WINDOWS\\system32\\cmd.exe /d /s /c next dev "-p" "3000"'],
    [5004, 5003, 'node.exe', `${NODE} "D:\\Code\\kreafy.ai\\node_modules\\.bin\\\\..\\next\\dist\\bin\\next" dev -p 3000`],
    [1640, 5004, 'node.exe', `${NODE} D:\\Code\\kreafy.ai\\node_modules\\next\\dist\\server\\lib\\start-server.js`],
    [9000, 1, 'Vigie.exe', '"C:\\Users\\me\\AppData\\Local\\Programs\\Vigie\\Vigie.exe"'],
    [7000, 6000, 'node.exe', `${NODE} D:\\Code\\other\\server.js`],
  ];
}

function table(rows, extra = {}) {
  return new Map(rows.map(([pid, ppid, name, command], i) => [pid, { pid, ppid, name, command, started: T + i * 10, ...extra[pid] }]));
}

const win = (procs, over = {}) =>
  findLeftover({ command: 'pnpm dev -p 3000', root: 'D:\\Code\\kreafy.ai', owners: [{ pid: 1640, kind: 'external' }], procs, platform: 'win32', selfPid: 9000, ...over });

test('leftover: the orphan tree of the same server is found from its root shell', () => {
  const found = win(table(kreafyTree()));
  assert.equal(found.root, 5000);
  assert.equal(found.reason, 'same command');
  assert.deepEqual([...found.pids].sort(), [1640, 5000, 5001, 5002, 5003, 5004]);
  // Windows paths compare without case.
  assert.equal(win(table(kreafyTree()), { root: 'd:\\code\\KREAFY.AI\\' })?.root, 5000);
});

test('leftover: a pid reused by a newer process is not a live parent', () => {
  const rows = [...kreafyTree(), [4321, 1, 'chrome.exe', 'chrome.exe --type=renderer']];
  assert.equal(win(table(rows, { 4321: { started: T + 999_999 } }))?.root, 5000);
});

test('leftover: a server whose launcher is still alive is never touched', () => {
  // Started from a terminal (or an editor, an agent…) that is still open.
  const rows = [...kreafyTree(), [4321, 3000, 'pwsh.exe', 'pwsh.exe'], [3000, 2000, 'WindowsTerminal.exe', 'WindowsTerminal.exe']];
  assert.equal(win(table(rows, { 4321: { started: T - 50 }, 3000: { started: T - 100 } })), null);
});

test('leftover: another project, command or port owner is never touched', () => {
  const procs = table(kreafyTree());
  assert.equal(win(procs, { root: 'D:\\Code\\other' }), null, 'other project root');
  assert.equal(win(procs, { root: 'D:\\Code\\kreafy' }), null, 'a sibling folder with a common prefix');
  assert.equal(win(procs, { command: 'npm run dev' }), null, 'other command');
  assert.equal(win(procs, { owners: [{ pid: 1640, kind: 'system' }] }), null, 'protected process');
  assert.equal(win(procs, { owners: [{ pid: 1640, kind: 'managed' }] }), null, 'managed server');
  assert.equal(win(procs, { owners: [{ pid: 7000, kind: 'external' }] }), null, 'unrelated node process');
  assert.equal(win(procs, { owners: [{ pid: 1640, kind: 'external' }, { pid: 7000, kind: 'external' }] }), null, 'a second, unrelated listener');
  assert.equal(win(procs, { owners: [{ pid: 1234, kind: 'external' }] }), null, 'unknown process');
  assert.equal(win(procs, { owners: [] }), null);
});

test('leftover: with the root shell gone, the package manager running the command is the root', () => {
  // cmd.exe exits with the Vigie that spawned it; pnpm and next survive.
  const found = win(table(kreafyTree().filter(([pid]) => pid !== 5000 && pid !== 5001)));
  assert.equal(found.root, 5002);
  assert.equal(found.reason, 'same command');
});

test('leftover: with its shells gone, the project dev binary still counts', () => {
  const rows = kreafyTree().filter(([pid]) => pid === 5004 || pid === 1640);
  const found = win(table(rows));
  assert.equal(found.root, 5004);
  assert.equal(found.reason, 'project dev binary');
  // A dev binary from another project's node_modules does not.
  assert.equal(win(table(rows), { root: 'D:\\Code\\other' }), null);
});

test('leftover: never a tree that contains Vigie itself', () => {
  assert.equal(win(table(kreafyTree()), { selfPid: 5003 }), null);
});

const posix = (rows, over = {}) =>
  findLeftover({
    command: 'pnpm dev -p 3000',
    root: '/home/me/kreafy',
    owners: [{ pid: 30, kind: 'external' }],
    procs: new Map(rows.map(([pid, ppid, name, command, cwd]) => [pid, { pid, ppid, name, command, started: null, cwd }])),
    platform: 'linux',
    selfPid: 99,
    ...over,
  });

test('leftover (POSIX): the shell Vigie spawned, adopted by init or a user systemd', () => {
  const rows = (ppid) => [
    [10, ppid, 'zsh', '/bin/zsh -lc pnpm dev -p 3000', '/home/me/kreafy'],
    [20, 10, 'node', 'node /usr/local/bin/pnpm dev -p 3000', '/home/me/kreafy'],
    [30, 20, 'node', 'node /home/me/kreafy/node_modules/.bin/next dev -p 3000', '/home/me/kreafy'],
  ];
  assert.equal(posix(rows(1))?.root, 10);
  assert.equal(posix([...rows(1500), [1500, 1, 'systemd', '/usr/lib/systemd/systemd --user', '/']])?.root, 10);
  // The shell exec'd pnpm: the root is pnpm itself.
  assert.equal(posix(rows(1).slice(1).map((r) => (r[0] === 20 ? [20, 1, ...r.slice(2)] : r)))?.reason, 'same command');
});

test('leftover (POSIX): a tmux or terminal session running the command is never touched', () => {
  const rows = [
    [10, 1, 'tmux', 'tmux new-session -s dev pnpm dev -p 3000', '/home/me'],
    [20, 10, 'node', 'node /usr/local/bin/pnpm dev -p 3000', '/home/me/kreafy'],
    [30, 20, 'node', 'node /home/me/kreafy/node_modules/.bin/next dev -p 3000', '/home/me/kreafy'],
  ];
  assert.equal(posix(rows), null);
  // Its cwd is the only sign of the project: without it, nothing matches either.
  assert.equal(posix([[10, 1, 'zsh', '/bin/zsh -lc pnpm dev -p 3000', '/tmp'], [30, 10, 'node', 'node server.js', '/tmp']]), null);
});

test('absolutePaths reads quoted, bare and --flag= paths', () => {
  assert.deepEqual(absolutePaths(`${NODE} "D:\\a b\\x.js" --dir=C:\\cache rel\\y.js`, true), ['C:\\Program Files\\nodejs\\node.exe', 'D:\\a b\\x.js', 'C:\\cache']);
  assert.deepEqual(absolutePaths("node '/srv/app/x.js' --root=/srv ./rel", false), ['/srv/app/x.js', '/srv']);
});
