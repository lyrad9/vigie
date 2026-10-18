import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadConfig } from './config.js';
import { DAEMON_LOG, DEFAULT_API_PORT, HOME, IS_WIN, VERSION, VIA_APP, supervisorCommand, tildify } from './paths.js';
import { installSkill } from './skill.js';
import { startupCommand } from './startup.js';

const HELP = `vigie ${VERSION}: one supervisor for every local dev server

Usage: vigie <command> [options]

Inspect (read live state before launching anything)
  status [--json]                     Projects, servers, ports, PIDs, health
  resolve [--cwd <dir>] [--json]      Which registered server belongs to this directory
  port <number> [--json]              Who owns a port (managed, external or system), and
                                      which servers are configured on it
  ports [--json]                      Every listening TCP port, grouped by owner
  logs <server> [--lines 100] [-f]    Recent output; -f follows live

Control
  start [server] [--takeover]         Start a server (defaults to the one for the cwd)
  stop [server]                       Stop a server
  restart [server]                    Restart a server
  stop-all                            Stop every managed server

Register
  register [--root .] [--name <project>] [--server dev] [--command "<cmd>"] [--port <n>]
           [--health http --health-path /] [--autostart] [--share-port]
                                      Register a project + server (guesses from package.json).
                                      A port another server is configured on is refused
                                      unless --share-port (servers never run at once)
  unregister <project>                Remove a project (stops its servers)

App
  open                                Open the Vigie window in your browser
  daemon                              Run the supervisor in the foreground
  shutdown                            Stop the daemon and its servers
  startup enable|disable|status       Launch Vigie at login
  skill install                       Install the agent skill (~/.agents/skills/vigie)

<server> accepts an id, project/server, :port, or a unique name.
All commands talk to http://127.0.0.1:${DEFAULT_API_PORT} and start the daemon when needed.
Config: ${tildify(path.join(HOME, 'config.json'))}`;

const OPTIONS = {
  json: { type: 'boolean' },
  follow: { type: 'boolean', short: 'f' },
  takeover: { type: 'boolean' },
  autostart: { type: 'boolean' },
  'share-port': { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  lines: { type: 'string', short: 'n' },
  cwd: { type: 'string' },
  root: { type: 'string' },
  name: { type: 'string' },
  server: { type: 'string' },
  command: { type: 'string' },
  port: { type: 'string' },
  health: { type: 'string' },
  'health-path': { type: 'string' },
};

// ------------------------------------------------------------------- output

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const c = { dim: paint(2), bold: paint(1), red: paint(31), green: paint(32), yellow: paint(33), blue: paint(34), cyan: paint(36) };
const STATE_COLOR = { running: c.green, starting: c.yellow, restarting: c.yellow, stopping: c.yellow, unhealthy: c.yellow, failed: c.red, stopped: c.dim };
const DOT = { running: '●', starting: '◐', restarting: '◐', stopping: '◐', unhealthy: '▲', failed: '✕', stopped: '○' };

function uptime(iso) {
  if (!iso) return '';
  let s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s %= 86400) / 3600);
  const m = Math.floor((s %= 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

const printJson = (data) => console.log(JSON.stringify(data, null, 2));
const pad = (s, n) => String(s ?? '').padEnd(n);

function printServer(s, indent = '  ') {
  const color = STATE_COLOR[s.state] || ((x) => x);
  const bits = [
    color(`${DOT[s.state] || '·'} ${pad(s.name, 12)}`),
    color(pad(s.state, 10)),
    pad(s.port ? `:${s.port}` : '', 7),
    pad(s.pid ? `pid ${s.pid}` : '', 11),
    pad(s.startedAt ? `up ${uptime(s.startedAt)}` : '', 11),
    c.dim(s.command),
  ];
  console.log(indent + bits.join(' '));
  if (s.lastError && s.state !== 'running') console.log(indent + '  ' + c.red(s.lastError));
}

// ------------------------------------------------------------------- client

function apiBase() {
  if (process.env.VIGIE_PORT) return `http://127.0.0.1:${process.env.VIGIE_PORT}`;
  try {
    return `http://127.0.0.1:${loadConfig().config.apiPort}`;
  } catch {
    return `http://127.0.0.1:${DEFAULT_API_PORT}`;
  }
}

class ApiError extends Error {
  constructor(error) {
    super(error.message);
    this.code = error.code;
    this.details = error.details;
  }
}

async function api(method, route, body) {
  const res = await fetch(apiBase() + '/api' + route, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json();
  if (!payload.ok) throw new ApiError(payload.error);
  return payload.data;
}

async function ping() {
  try {
    const res = await fetch(apiBase() + '/api/health', { signal: AbortSignal.timeout(800) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Start the supervisor in the background if it is not already answering: the desktop app when run through its shim, else `vigie daemon`. */
async function ensureDaemon() {
  if (await ping()) return false;
  fs.mkdirSync(HOME, { recursive: true });
  const { file, args, env, app } = supervisorCommand();
  if (app && IS_WIN) {
    // Electron's node mode leaves our stdout pipe inheritable, and CreateProcess would hand it to the
    // long-lived app: an agent capturing `vigie status --json` would then wait for EOF forever.
    // Start-Process goes through ShellExecute, which passes no handles to the app.
    const launch = 'Start-Process -FilePath $env:VIGIE_APP_FILE -ArgumentList $env:VIGIE_APP_ARGS';
    const appEnv = { ...env, VIGIE_APP_FILE: file, VIGIE_APP_ARGS: args.map((a) => `"${a}"`).join(' ') };
    spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', launch], { env: appEnv, windowsHide: true, stdio: 'ignore' }).unref();
  } else {
    // windowsHide only for the console daemon: on a GUI app it would swallow the window's first show().
    const out = fs.openSync(DAEMON_LOG, 'a');
    spawn(file, args, { env, detached: true, windowsHide: !app, stdio: ['ignore', out, out] }).unref();
  }
  // The app takes longer than a bare daemon to come up (Electron + window).
  for (let i = 0; i < (app ? 200 : 50); i++) {
    await new Promise((r) => setTimeout(r, 100));
    if (await ping()) return true;
  }
  throw new Error(`${app ? 'the Vigie app' : 'the daemon'} did not start; see ${DAEMON_LOG}`);
}

function openBrowser(url) {
  const [cmd, args] = IS_WIN ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}

const enc = encodeURIComponent;

/** Server reference from argv, or the one registered for the current directory. */
async function serverRef(arg, values) {
  if (arg) return arg;
  const r = await api('GET', `/resolve?cwd=${enc(values.cwd || process.cwd())}`);
  if (!r.server) throw new Error(`no server registered for ${process.cwd()}; run "vigie register" or pass a server name`);
  return r.server.id;
}

// ----------------------------------------------------------------- commands

export async function main(argv) {
  const { values, positionals } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: false });
  const [cmd, ...rest] = positionals;
  if (values.version) return console.log(VERSION);
  if (!cmd || values.help || cmd === 'help') return console.log(HELP);

  if (cmd === 'daemon') {
    const { runDaemon } = await import('./daemon.js');
    return runDaemon();
  }
  if (cmd === 'startup') return startupCommand(rest[0] || 'status');
  if (cmd === 'skill') {
    for (const dir of installSkill()) console.log(`✓ skill installed at ${tildify(dir)}`);
    return;
  }

  if (cmd === 'shutdown') {
    if (!(await ping())) return console.log('Vigie is not running.');
    await api('POST', '/shutdown');
    return console.log('Vigie stopped. Managed servers were stopped.');
  }

  const started = await ensureDaemon();
  if (started && !values.json) console.error(c.dim(`started ${VIA_APP ? 'the Vigie app' : 'vigie daemon'} on ${apiBase()}`));

  try {
    await run(cmd, rest, values);
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    if (values.json) {
      printJson({ ok: false, error: { code: err.code, message: err.message, details: err.details } });
      process.exitCode = 1;
      return;
    }
    console.error(c.red(`error: ${err.message}`));
    if (err.code === 'PORT_IN_USE' && err.details?.owners?.some((o) => o.kind === 'external')) {
      console.error(c.dim('Re-run with --takeover to stop that process and start the server under Vigie.'));
    }
    if (err.code === 'PORT_CONFLICT') {
      const free = err.details?.suggestedPort;
      console.error(c.dim(`${free ? `Use --port ${free}` : 'Pick another --port'}, or add --share-port if these servers never run at the same time.`));
    }
    if (err.details?.candidates) console.error(c.dim(`candidates: ${err.details.candidates.join(', ')}`));
    process.exitCode = 1;
  }
}

async function run(cmd, rest, values) {
  switch (cmd) {
    case 'status': {
      const status = await api('GET', '/status');
      if (values.json) return printJson(status);
      const servers = status.projects.flatMap((p) => p.servers);
      const running = servers.filter((s) => s.state === 'running').length;
      console.log(`${c.bold('Vigie')} ${status.version} · api 127.0.0.1:${status.apiPort} · ${running}/${servers.length} running`);
      if (!status.projects.length) return console.log(c.dim('\nNo projects yet. Register one with: vigie register --command "npm run dev" --port 3000'));
      for (const p of status.projects) {
        console.log(`\n${c.bold(p.name)}  ${c.dim(tildify(p.root))}`);
        if (!p.servers.length) console.log(c.dim('  (no servers)'));
        for (const s of p.servers) printServer(s);
      }
      return;
    }

    case 'resolve': {
      const r = await api('GET', `/resolve?cwd=${enc(values.cwd || process.cwd())}${values.server ? `&server=${enc(values.server)}` : ''}`);
      if (values.json) return printJson(r);
      if (!r.project) {
        console.log(`No registered project contains ${r.cwd}.`);
        const g = r.inspect?.suggestion;
        if (g) console.log(c.dim(`Suggested: vigie register --command "${g.command}" --port ${g.port}`));
        if (g?.portMovedFrom) console.log(c.dim(`  (port ${g.portMovedFrom} is taken by ${takenBy(g.portTakenBy)})`));
        return;
      }
      console.log(`${c.bold(r.project.name)}  ${c.dim(tildify(r.project.root))}`);
      for (const s of r.project.servers) printServer(s);
      return;
    }

    case 'start':
    case 'stop':
    case 'restart': {
      const ref = await serverRef(rest[0], values);
      const body = cmd === 'start' ? { takeover: Boolean(values.takeover) } : {};
      let s = await api('POST', `/servers/${enc(ref)}/${cmd}`, body);
      if (cmd !== 'stop' && s.state === 'starting') s = await waitReady(s.id);
      if (values.json) return printJson(s);
      printServer(s, '');
      if (s.url && s.state === 'running') console.log(c.dim(`  ${s.url}`));
      return;
    }

    case 'stop-all': {
      const status = await api('POST', '/stop-all');
      return values.json ? printJson(status) : console.log('All managed servers stopped.');
    }

    case 'logs': {
      const ref = await serverRef(rest[0], values);
      const lines = Number(values.lines) || 100;
      const { id, text } = await api('GET', `/servers/${enc(ref)}/logs?lines=${lines}`);
      if (values.json) return printJson({ id, text });
      process.stdout.write(useColor ? text : stripAnsi(text));
      if (values.follow) await follow(id);
      return;
    }

    case 'port': {
      const port = Number(String(rest[0] ?? '').replace(':', ''));
      if (!port) throw new Error('usage: vigie port <number>');
      const r = await api('GET', `/port/${port}`);
      if (values.json) return printJson(r);
      for (const o of r.owners) printPortEntry(o);
      // Stopped or failed servers do not hold the port, but they will want it back when started.
      const holders = new Set(r.owners.map((o) => o.serverId));
      const idle = (r.configured || []).filter((s) => !holders.has(s.serverId));
      if (!r.owners.length) console.log(`Port ${port} is free${idle.length ? ' right now' : ''}.`);
      if (idle.length) console.log(c.dim(`  Configured for ${idle.map((s) => `${s.serverName} (${s.state})`).join(', ')}: give a new server another port.`));
      return;
    }

    case 'ports': {
      const r = await api('GET', '/ports');
      if (values.json) return printJson(r);
      const s = r.summary;
      const internal = s.internal ? ` (+${s.internal} internal)` : '';
      const reserved = s.reserved ? ` · ${s.reserved} reserved` : '';
      console.log(`${s.listening} listening · ${s.managed} managed${internal}${reserved} · ${s.external} external · ${s.system} system\n`);
      const internals = r.ports.filter((p) => p.internal);
      const shown = new Set();
      for (const kind of ['managed', 'external', 'system']) {
        const list = r.ports.filter((p) => p.kind === kind && !p.internal);
        if (!list.length) continue;
        console.log(c.bold({ managed: 'Managed by Vigie', external: 'Started outside Vigie', system: 'System (read only)' }[kind]));
        for (const o of list) {
          // A server's other listeners are listed under its main port, once.
          const own = kind === 'managed' && !shown.has(o.serverId) ? internals.filter((i) => i.serverId === o.serverId) : [];
          shown.add(o.serverId);
          printPortEntry(o, own);
        }
        console.log();
      }
      return;
    }

    case 'register':
      return register(values);

    case 'unregister': {
      if (!rest[0]) throw new Error('usage: vigie unregister <project>');
      await api('DELETE', `/projects/${enc(rest[0])}`);
      return console.log(`Removed project ${rest[0]}.`);
    }

    case 'open': {
      const url = apiBase();
      openBrowser(url);
      return console.log(`Opening ${url}`);
    }

    default:
      throw new Error(`unknown command "${cmd}". Run "vigie help".`);
  }
}

function printPortEntry(o, internals = []) {
  const badge = { managed: c.green('Managed'), external: c.yellow('External'), system: c.dim('Protected') }[o.kind];
  const who = o.serverName ? c.bold(o.serverName) : o.name;
  const meta = o.listening === false ? c.yellow(`not listening · ${o.state}`) : c.dim(`pid ${o.pid}${o.user ? ' · ' + o.user : ''}`);
  console.log(`  ${pad(':' + o.port, 7)} ${badge.padEnd(useColor ? 18 : 9)} ${who} ${meta}`);
  if (o.listening === false) console.log(c.dim(`          reserved: ${o.serverName} is ${o.state}, so this port is not free`));
  if (o.internal) console.log(c.dim(`          internal port of ${o.serverName}, main port :${o.primaryPort}`));
  if (o.command && o.kind !== 'system') console.log(c.dim(`          ${o.command.slice(0, 110)}`));
  if (internals.length) {
    const same = internals.every((i) => i.pid === o.pid);
    const list = internals.map((i) => (same ? i.port : `${i.port} (pid ${i.pid})`)).join(', ');
    console.log(c.dim(`          +${internals.length} internal port${internals.length > 1 ? 's' : ''}: ${list}${same ? ' (same process)' : ''}`));
  }
}

async function waitReady(id) {
  let s;
  for (let i = 0; i < 120; i++) {
    s = await api('GET', `/servers/${enc(id)}`);
    if (s.state !== 'starting') return s;
    await new Promise((r) => setTimeout(r, 500));
  }
  return s;
}

async function follow(id) {
  const res = await fetch(apiBase() + '/api/events');
  const decoder = new TextDecoder();
  let buf = '';
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) !== -1) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const event = block.match(/^event: (.*)$/m)?.[1];
      const data = block.match(/^data: (.*)$/m)?.[1];
      if (event !== 'log' || !data) continue;
      const entry = JSON.parse(data);
      if (entry.id === id) process.stdout.write(useColor ? entry.text : stripAnsi(entry.text));
    }
  }
}

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '');
}

/** Who holds a framework's default port: the servers configured on it, else a listening program. */
const takenBy = (t) => (t.servers.length ? t.servers.join(', ') : 'a program outside Vigie');

async function register(values) {
  const root = path.resolve(values.root || process.cwd());
  const wanted = values.port ? Number(values.port) : null;
  // With a port, the guessed command pins it (next dev -p 3001). Without one, the daemon moves a
  // framework default that another server already has to the next free port.
  const inspect = (port) => api('GET', `/inspect?root=${enc(root)}${port ? `&port=${port}` : ''}`);
  let info = await inspect(wanted);
  if (!info.exists) throw new Error(`directory not found: ${root}`);
  const status = await api('GET', '/status');
  const existing = status.projects.find((p) => path.resolve(p.root).toLowerCase() === root.toLowerCase());
  const name = values.server || info.suggestion?.name || 'dev';
  const same = existing?.servers.find((s) => s.name === name);
  // Registering a server again keeps its port, unless --port says otherwise.
  if (!wanted && same?.port && info.suggestion && info.suggestion.port !== same.port) info = await inspect(same.port);
  const guess = info.suggestion || {};
  const command = values.command || guess.command;
  if (!command) throw new Error('could not guess a command; pass --command "<cmd>"');
  const port = wanted ?? (values.command ? null : guess.port ?? null);
  const moved = port && port === guess.port && guess.portMovedFrom ? guess : null;
  const sharePort = Boolean(values['share-port']);
  const server = {
    name,
    command,
    port,
    autostart: Boolean(values.autostart),
    health: { type: values.health || (port ? 'tcp' : 'none'), path: values['health-path'] || '/' },
  };

  let result;
  if (existing) {
    const body = { ...server, sharePort };
    result = same ? await api('PATCH', `/servers/${enc(same.id)}`, body) : await api('POST', `/projects/${enc(existing.id)}/servers`, body);
    result = { project: existing.name, server: result };
  } else {
    const project = await api('POST', '/projects', { name: values.name || info.name, root, servers: [server], sharePort });
    result = { project: project.name, server: project.servers[0] };
  }
  if (moved) Object.assign(result, { portMovedFrom: moved.portMovedFrom, portTakenBy: moved.portTakenBy });
  if (values.json) return printJson(result);
  console.log(`Registered ${c.bold(`${result.project}/${result.server.name}`)}: ${result.server.command}${result.server.port ? ` on :${result.server.port}` : ''}`);
  if (moved) console.log(c.dim(`Port ${moved.portMovedFrom} is taken by ${takenBy(moved.portTakenBy)}, so :${port} was picked.`));
  console.log(c.dim(`Start it with: vigie start ${result.project}/${result.server.name}`));
}
