// Recognize a server left running by a previous Vigie that died without stopping it (killed by an
// installer, a crash…). On Windows its tree (cmd -> pnpm -> next) survives as an orphan holding the
// port, so restoring the server at boot would fail with PORT_IN_USE. Pure: the caller passes the
// port owners and the process table, and decides what to do with the answer.
import path from 'node:path';

// Processes that adopt orphans on POSIX: a tree under one of them has lost its real parent.
const REAPERS = new Set(['init', 'systemd', 'launchd']);

/**
 * The tree to stop when every listener on the server's port is what is left of that same server:
 * - each owner is an external, unprotected process;
 * - its tree root lost its parent (gone, replaced by a newer process with the same pid, or an
 *   orphan reaper), so no terminal, editor or agent is holding it;
 * - that root was launched with the server's command, or runs a dev binary from the project's
 *   node_modules;
 * - a process of the chain works in the project: its cwd, or a path on its command line, is inside
 *   the project root.
 * Anything else returns null and the caller keeps PORT_IN_USE.
 *
 * @param {{ command: string, root: string, owners: Array<{ pid: number, kind: string }>,
 *   procs: Map<number, { pid: number, ppid: number, name?: string, command?: string, started?: number | null, cwd?: string | null }>,
 *   platform?: string, selfPid?: number }} input
 * @returns {{ root: number, pids: number[], reason: string } | null}
 */
export function findLeftover({ command, root, owners, procs, platform = process.platform, selfPid = process.pid }) {
  if (!owners.length || !command || !root) return null;
  const win = platform === 'win32';
  const p = win ? path.win32 : path.posix;
  const fold = (s) => (win ? s.toLowerCase() : s);
  const projectRoot = fold(p.resolve(root));
  const inside = (file, dir) => {
    const f = fold(p.normalize(file));
    return f === dir || f.startsWith(dir.endsWith(p.sep) ? dir : dir + p.sep);
  };
  const words = argv(command);
  const wanted = { line: fold(squash(command)), argv: fold([program(words[0] || ''), ...words.slice(1)].join(' ')) };

  let found = null;
  for (const owner of owners) {
    if (owner.kind !== 'external' || !procs.has(owner.pid)) return null;
    const chain = ancestry(owner.pid, procs);
    const top = chain[chain.length - 1];
    if (!orphaned(top, procs)) return null;
    if (found && found.root !== top.pid) return null; // two unrelated trees share the port

    const how = launchedAs(top.command || '', wanted, (f) => inside(f, p.join(projectRoot, 'node_modules')), { win, fold });
    if (!how) return null;
    const inProject = chain.some((x) => (x.cwd && inside(x.cwd, projectRoot)) || absolutePaths(x.command || '', win).some((f) => inside(f, projectRoot)));
    if (!inProject) return null;

    const pids = treeOf(top.pid, procs);
    if (pids.includes(selfPid)) return null;
    found = { root: top.pid, pids, reason: how };
  }
  return found;
}

const INTERPRETERS = new Set(['node', 'bun', 'deno', 'python', 'python3', 'ruby', 'php']);

/**
 * How a tree root was started, if it looks like one of Vigie's own launches. Only these shapes count,
 * so a root that merely mentions the command (a tmux or terminal session running it) never matches:
 * - the shell Vigie spawns: `cmd.exe /d /s /c "<command>"` on Windows, `<shell> -lc <command>` elsewhere;
 * - the command itself, when the shell exec'd it (`npm run dev`, `node /usr/local/bin/pnpm dev`);
 * - an interpreter running a dev binary from the project's node_modules (`node …/node_modules/.bin/vite`).
 */
function launchedAs(commandLine, wanted, inNodeModules, { win, fold }) {
  const line = fold(squash(commandLine));
  const shell = win ? line.match(/^"?(?:[^"]*[\\/])?cmd(?:\.exe)?"?\s+\/d\s+\/s\s+\/c\s+"(.*)"$/) : line.match(/^(?:\S*\/)?[a-z]*sh\s+-l?c\s+(.*)$/);
  if (shell && shell[1] === wanted.line) return 'same command';

  const tokens = argv(commandLine);
  const interpreted = INTERPRETERS.has(program(tokens[0] || ''));
  const same = (list) => list.length > 0 && fold([program(list[0]), ...list.slice(1)].join(' ')) === wanted.argv;
  if (same(tokens) || (interpreted && same(tokens.slice(1)))) return 'same command';
  // Not the configured command (a package script often wraps the binary), but the project's own dev server binary.
  if (inNodeModules(tokens[0] || '') || (interpreted && tokens[1] && inNodeModules(tokens[1]))) return 'project dev binary';
  return null;
}

/** Arguments of a command line, quotes removed. */
function argv(commandLine) {
  return (String(commandLine).match(/"[^"]*"|'[^']*'|\S+/g) || []).map((t) => t.replace(/^["']|["']$/g, ''));
}

/** A program's name without its folder or extension: C:\…\node.exe -> node, /usr/local/bin/pnpm -> pnpm. */
function program(file) {
  return file.split(/[\\/]/).pop().replace(/\.(exe|cmd|bat|cjs|mjs|js)$/i, '').toLowerCase();
}

/** The process and its ancestors still in the table, nearest first. A parent newer than its child is a reused pid. */
export function ancestry(pid, procs) {
  const chain = [];
  let cur = procs.get(pid);
  const seen = new Set();
  while (cur && !seen.has(cur.pid)) {
    chain.push(cur);
    seen.add(cur.pid);
    const parent = procs.get(cur.ppid);
    if (!parent || cur.ppid <= 1 || REAPERS.has(baseName(parent)) || newer(parent, cur)) break;
    cur = parent;
  }
  return chain;
}

function orphaned(top, procs) {
  const parent = procs.get(top.ppid);
  return !parent || top.ppid <= 1 || REAPERS.has(baseName(parent)) || newer(parent, top);
}

function newer(parent, child) {
  return parent.started != null && child.started != null && parent.started > child.started;
}

function baseName(proc) {
  return String(proc.name || '').replace(/\.exe$/i, '').toLowerCase();
}

function treeOf(rootPid, procs) {
  const children = new Map();
  for (const x of procs.values()) {
    if (!children.has(x.ppid)) children.set(x.ppid, []);
    children.get(x.ppid).push(x);
  }
  const out = [];
  const stack = [procs.get(rootPid)];
  while (stack.length) {
    const x = stack.pop();
    if (out.includes(x.pid)) continue;
    out.push(x.pid);
    // A child older than its parent belongs to an earlier process with the same pid.
    for (const c of children.get(x.pid) || []) if (!newer(x, c)) stack.push(c);
  }
  return out;
}

function squash(s) {
  return String(s).trim().replace(/\s+/g, ' ');
}

/** Absolute paths on a command line: quoted or bare arguments, and the value of --flag=/path. */
export function absolutePaths(commandLine, win) {
  const out = [];
  for (const token of String(commandLine).match(/"[^"]*"|'[^']*'|\S+/g) || []) {
    const value = token.replace(/^["']|["']$/g, '');
    for (const part of [value, value.slice(value.indexOf('=') + 1)]) {
      if (win ? /^[a-zA-Z]:[\\/]/.test(part) : part.startsWith('/')) out.push(part);
    }
  }
  return [...new Set(out)];
}
