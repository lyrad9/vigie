// OS-specific process and port inspection. Everything here is read-only except killTree.
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { IS_WIN } from './paths.js';

function run(cmd, args, { timeout = 10000 } = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, windowsHide: true, maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => {
      resolve(String(stdout ?? ''));
    });
  });
}

function splitHostPort(value) {
  const i = value.lastIndexOf(':');
  return { address: value.slice(0, i).replace(/^\[|\]$/g, ''), port: Number(value.slice(i + 1)) };
}

/** Merge IPv4/IPv6 duplicates into one entry per (port, pid). */
function dedupe(entries) {
  const map = new Map();
  for (const e of entries) {
    if (!e.port) continue;
    const key = `${e.port}:${e.pid}`;
    const prev = map.get(key);
    if (prev) {
      if (!prev.addresses.includes(e.address)) prev.addresses.push(e.address);
    } else {
      map.set(key, { port: e.port, pid: e.pid, addresses: [e.address], name: e.name, user: e.user });
    }
  }
  return [...map.values()].sort((a, b) => a.port - b.port || a.pid - b.pid);
}

// netstat columns are locale-independent except the state label, so a listener is
// detected by its wildcard remote address rather than by the word LISTENING.
export function parseNetstat(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const p = line.trim().split(/\s+/);
    if (p[0] !== 'TCP' || p.length < 5) continue;
    if (!/^(0\.0\.0\.0|\[::\]):0$/.test(p[2]) || p[3] === 'BOUND') continue;
    const { address, port } = splitHostPort(p[1]);
    out.push({ port, address, pid: Number(p[p.length - 1]) });
  }
  return out;
}

export function parseLsof(text) {
  const out = [];
  let pid = 0;
  let name = '';
  let user = '';
  for (const line of text.split('\n')) {
    const tag = line[0];
    const value = line.slice(1);
    if (tag === 'p') pid = Number(value);
    else if (tag === 'c') name = value;
    else if (tag === 'L') user = value;
    else if (tag === 'n') out.push({ ...splitHostPort(value.replace(/^\*/, '0.0.0.0')), pid, name, user });
  }
  return out;
}

export function parseSs(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const p = line.trim().split(/\s+/);
    if (p.length < 4) continue;
    const local = splitHostPort(p[3].replace(/^\*/, '0.0.0.0'));
    const users = [...line.matchAll(/\("([^"]+)",pid=(\d+)/g)];
    if (!users.length) out.push({ ...local, pid: 0, name: '' });
    for (const u of users) out.push({ ...local, pid: Number(u[2]), name: u[1] });
  }
  return out;
}

/** Every listening TCP socket: [{ port, pid, addresses, name?, user? }]. */
export async function listListeners() {
  if (IS_WIN) {
    const [v4, v6] = await Promise.all([run('netstat', ['-ano', '-p', 'TCP']), run('netstat', ['-ano', '-p', 'TCPv6'])]);
    return dedupe(parseNetstat(v4 + '\n' + v6));
  }
  const lsof = await run('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-FpcLn']);
  if (lsof.trim()) return dedupe(parseLsof(lsof));
  return dedupe(parseSs(await run('ss', ['-ltnpH'])));
}

let procCache = { at: 0, promise: null };

/** Map<pid, { pid, ppid, name, user, session, command }>, cached for 2 seconds. */
export function listProcesses({ fresh = false } = {}) {
  if (!fresh && procCache.promise && Date.now() - procCache.at < 2000) return procCache.promise;
  procCache = { at: Date.now(), promise: readProcesses() };
  return procCache.promise;
}

async function readProcesses() {
  const map = new Map();
  if (IS_WIN) {
    const script =
      "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-CimInstance Win32_Process | ForEach-Object { '{0}|{1}|{2}|{3}|{4}' -f $_.ProcessId,$_.ParentProcessId,$_.SessionId,$_.Name,($_.CommandLine -replace '[\\r\\n]',' ') }";
    const text = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 15000 });
    for (const line of text.split(/\r?\n/)) {
      const parts = line.split('|');
      if (parts.length < 4) continue;
      const pid = Number(parts[0]);
      map.set(pid, {
        pid,
        ppid: Number(parts[1]),
        session: Number(parts[2]),
        name: parts[3],
        user: '',
        command: parts.slice(4).join('|').trim(),
      });
    }
    if (map.size) return map;
    // Fallback without parent ids.
    const csv = await run('tasklist', ['/FO', 'CSV', '/NH']);
    for (const line of csv.split(/\r?\n/)) {
      const cols = [...line.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
      if (cols.length < 4) continue;
      const pid = Number(cols[1]);
      map.set(pid, { pid, ppid: 0, session: Number(cols[3]), name: cols[0], user: '', command: '' });
    }
    return map;
  }
  const text = await run('ps', ['-axww', '-o', 'pid=,ppid=,user=,args=']);
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/);
    if (!m) continue;
    const command = m[4].trim();
    const exe = command.split(/\s+-/)[0].trim();
    map.set(Number(m[1]), {
      pid: Number(m[1]),
      ppid: Number(m[2]),
      user: m[3],
      session: null,
      name: path.basename(exe.split(' ')[0]) || exe,
      command,
    });
  }
  return map;
}

/** All descendants of the given root pids, including the roots. Returns Map<pid, rootPid>. */
export function descendantsOf(roots, procs) {
  const children = new Map();
  for (const p of procs.values()) {
    if (!children.has(p.ppid)) children.set(p.ppid, []);
    children.get(p.ppid).push(p.pid);
  }
  const owner = new Map();
  for (const root of roots) {
    const stack = [root];
    while (stack.length) {
      const pid = stack.pop();
      if (owner.has(pid)) continue;
      owner.set(pid, root);
      for (const c of children.get(pid) || []) stack.push(c);
    }
  }
  return owner;
}

const WIN_SYSTEM = new Set(['system', 'system idle process', 'svchost.exe', 'lsass.exe', 'services.exe', 'wininit.exe', 'spoolsv.exe', 'smss.exe', 'csrss.exe']);
const currentUser = (() => {
  try {
    return os.userInfo().username;
  } catch {
    return '';
  }
})();

/** Processes the user should not stop from Vigie: OS services and other users' processes. */
export function isProtected(proc, pid) {
  if (pid <= 4) return true;
  if (!proc) return IS_WIN; // On Windows, unreadable processes are almost always services.
  if (IS_WIN) return proc.session === 0 || WIN_SYSTEM.has(proc.name.toLowerCase());
  if (proc.user && currentUser && proc.user !== currentUser) return true;
  return /^\/(System|usr\/libexec|usr\/sbin|sbin)\//.test(proc.command);
}

export function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

/**
 * Stop a process and its children.
 * group: the pid leads its own process group (true for servers Vigie spawned on POSIX).
 */
export async function killTree(pid, { force = false, group = false } = {}) {
  if (!pid) return;
  if (IS_WIN) {
    // Console processes ignore taskkill without /F, so Windows always force-kills the tree.
    await run('taskkill', ['/PID', String(pid), '/T', '/F']);
    return;
  }
  const signal = force ? 'SIGKILL' : 'SIGTERM';
  try {
    process.kill(group ? -pid : pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      /* already gone */
    }
  }
}
