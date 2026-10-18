import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { VigieError } from './errors.js';
import { checkHealth } from './health.js';
import { inspectDirectory } from './inspect.js';
import { LogBuffer } from './logs.js';
import { IS_WIN, LOG_DIR, STATE_FILE, VERSION } from './paths.js';
import { descendantsOf, isProtected, killTree, listListeners, listProcesses, processCwd } from './platform.js';
import { ancestry, findLeftover } from './leftover.js';
import { PROJECT_COLORS, normalizeConfig, normalizeProject, normalizeServer, saveConfig } from './config.js';
import { projectLogo } from './logo.js';

const ACTIVE = new Set(['starting', 'running', 'unhealthy', 'restarting']);
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

export class Supervisor extends EventEmitter {
  /** @param {{config: any, text: string}} loaded */
  constructor(loaded, { apiPort }) {
    super();
    this.config = loaded.config;
    this.configText = loaded.text;
    this.apiPort = apiPort;
    this.rt = new Map();
    this.shuttingDown = false;
    this.persistTimer = null;
    this.syncRuntime();
  }

  // ---------------------------------------------------------------- lookup

  lookup(serverId) {
    for (const project of this.config.projects) {
      const server = project.servers.find((s) => s.id === serverId);
      if (server) return { project, server };
    }
    return null;
  }

  project(ref) {
    const p = this.config.projects.find((x) => x.id === ref || x.name.toLowerCase() === String(ref).toLowerCase());
    if (!p) throw new VigieError('NOT_FOUND', `No project matches "${ref}"`, undefined, 404);
    return p;
  }

  /**
   * Resolve a server reference: an id, "project/server", ":3000" or "3000",
   * a unique server name, or a project name that has exactly one server.
   */
  find(ref) {
    ref = String(ref ?? '').trim();
    if (!ref) throw new VigieError('NOT_FOUND', 'No server given');
    const all = this.config.projects.flatMap((project) => project.servers.map((server) => ({ project, server })));
    const lc = ref.toLowerCase();
    const byId = all.find((x) => x.server.id === ref);
    if (byId) return byId;
    let matches;
    if (/^:?\d+$/.test(ref)) {
      const port = Number(ref.replace(':', ''));
      matches = all.filter((x) => x.server.port === port);
    } else if (ref.includes('/')) {
      const [p, s] = lc.split('/');
      matches = all.filter((x) => x.project.name.toLowerCase() === p && x.server.name.toLowerCase() === s);
    } else {
      matches = all.filter((x) => x.server.name.toLowerCase() === lc);
      if (!matches.length) matches = all.filter((x) => x.project.name.toLowerCase() === lc);
    }
    if (matches.length === 1) return matches[0];
    if (!matches.length) throw new VigieError('NOT_FOUND', `No server matches "${ref}"`, undefined, 404);
    throw new VigieError('AMBIGUOUS', `"${ref}" matches ${matches.length} servers; use project/server`, {
      candidates: matches.map((x) => `${x.project.name}/${x.server.name}`),
    });
  }

  /** Find the project whose root contains `cwd` (deepest match wins). */
  resolveCwd(cwd) {
    const norm = (p) => {
      const r = path.resolve(p);
      return IS_WIN ? r.toLowerCase() : r;
    };
    const target = norm(cwd);
    let best = null;
    for (const project of this.config.projects) {
      const root = norm(project.root);
      if ((target === root || target.startsWith(root + path.sep)) && (!best || root.length > norm(best.root).length)) best = project;
    }
    return best;
  }

  // ------------------------------------------------------------------ views

  view(serverId) {
    const found = this.lookup(serverId);
    if (!found) return null;
    const { project, server } = found;
    const r = this.rt.get(serverId);
    return {
      id: server.id,
      projectId: project.id,
      name: server.name,
      command: server.command,
      cwd: server.cwd,
      port: server.port,
      url: server.port ? `http://localhost:${server.port}` : null,
      env: server.env,
      autostart: server.autostart,
      health: server.health,
      maxRestartAttempts: server.maxRestartAttempts,
      state: r.state,
      healthy: r.healthy,
      pid: r.pid,
      startedAt: r.startedAt,
      restartCount: r.restartCount,
      lastExitCode: r.lastExitCode,
      lastError: r.lastError,
      lastHealthAt: r.lastHealthAt,
    };
  }

  status() {
    return {
      version: VERSION,
      apiPort: this.apiPort,
      platform: process.platform,
      language: this.config.language,
      projects: this.config.projects.map((p) => {
        const logo = projectLogo(p.root);
        return {
          id: p.id,
          name: p.name,
          root: p.root,
          color: p.color,
          icon: p.icon,
          logo: logo ? { path: logo.rel, version: logo.version } : null,
          servers: p.servers.map((s) => this.view(s.id)),
        };
      }),
    };
  }

  /** The logo file shown for a project, or a NOT_FOUND error. */
  logoFile(ref) {
    const project = this.project(ref);
    const logo = projectLogo(project.root, { ttl: 0 });
    if (!logo) throw new VigieError('NOT_FOUND', `No logo found in ${project.root}`, undefined, 404);
    return logo.file;
  }

  /** The folder a terminal opens in: the server's working directory, else the project root. */
  terminalDir(projectRef, serverRef) {
    if (serverRef) {
      const { project, server } = this.find(serverRef);
      return server.cwd ? path.resolve(project.root, server.cwd) : project.root;
    }
    return this.project(projectRef).root;
  }

  updateSettings(patch) {
    const next = normalizeConfig({ ...this.config, ...pick(patch, ['language']) });
    this.config.language = next.language;
    this.commit();
    return { language: this.config.language };
  }

  // -------------------------------------------------------------- runtime

  syncRuntime() {
    const ids = new Set();
    for (const p of this.config.projects) {
      for (const s of p.servers) {
        ids.add(s.id);
        if (!this.rt.has(s.id)) this.rt.set(s.id, this.newRuntime(s.id));
      }
    }
    for (const [id, r] of this.rt) {
      if (ids.has(id)) continue;
      r.removed = true;
      clearTimeout(r.timers.restart);
      clearTimeout(r.timers.health);
      if (r.pid) killTree(r.pid, { force: true, group: !IS_WIN });
      r.logs.close();
      this.rt.delete(id);
    }
  }

  newRuntime(id) {
    return {
      id,
      gen: 0,
      state: 'stopped',
      child: null,
      pid: null,
      startedAt: null,
      restartCount: 0,
      lastExitCode: null,
      lastError: null,
      healthy: null,
      healthFailures: 0,
      lastHealthAt: null,
      stopRequested: false,
      removed: false,
      stopWaiters: [],
      timers: { health: null, restart: null },
      logs: new LogBuffer(path.join(LOG_DIR, `${id}.log`)),
    };
  }

  setState(r, state) {
    r.state = state;
    if (r.removed) return;
    this.emit('server', this.view(r.id));
    this.schedulePersist();
  }

  log(r, text) {
    r.logs.append(text);
    if (!r.removed) this.emit('log', { id: r.id, text });
  }

  // -------------------------------------------------------------- control

  /** `restore`: started at boot, so a leftover of this same server from a previous Vigie may be replaced. */
  async start(ref, { takeover = false, restore = false } = {}) {
    const { project, server } = this.find(ref);
    const r = this.rt.get(server.id);
    if (r.child && ACTIVE.has(r.state)) return this.view(server.id);
    if (r.state === 'stopping') await this.waitExit(r, 10000);
    clearTimeout(r.timers.restart);
    if (server.port) {
      await this.ensurePortFree(server, takeover, restore ? project : null);
      // Again with no await before the spawn: servers started together (at boot) all found the port free.
      const rival = this.reservations([], server.port).find((o) => o.serverId !== server.id);
      if (rival) throw portTaken(server.port, rival, [rival]);
    }
    r.restartCount = 0;
    this.spawnServer(project, server, r);
    return this.view(server.id);
  }

  async stop(ref) {
    const { server } = this.find(ref);
    const r = this.rt.get(server.id);
    clearTimeout(r.timers.restart);
    clearTimeout(r.timers.health);
    if (!r.child) {
      r.startedAt = null;
      if (r.state !== 'stopped') this.setState(r, 'stopped');
      return this.view(server.id);
    }
    r.stopRequested = true;
    this.setState(r, 'stopping');
    this.log(r, dim('\r\n[vigie] stopping…\r\n'));
    const exited = this.waitExit(r, IS_WIN ? 8000 : 5000);
    await killTree(r.pid, { group: !IS_WIN });
    if (!(await exited)) {
      await killTree(r.pid, { force: true, group: !IS_WIN });
      if (!(await this.waitExit(r, 3000))) {
        // Process refuses to report exit; forget it rather than wedge the UI.
        r.gen++;
        r.child = null;
        r.pid = null;
        r.startedAt = null;
        this.setState(r, 'stopped');
      }
    }
    return this.view(server.id);
  }

  async restart(ref) {
    const { server } = this.find(ref);
    await this.stop(server.id);
    return this.start(server.id);
  }

  async stopAll() {
    const ids = [...this.rt.values()].filter((r) => r.child || r.state !== 'stopped').map((r) => r.id);
    await Promise.allSettled(ids.map((id) => this.stop(id)));
    return this.status();
  }

  clearLogs(ref) {
    const { server } = this.find(ref);
    this.rt.get(server.id).logs.clear();
    this.emit('server', this.view(server.id));
  }

  logs(ref, maxChars) {
    const { server } = this.find(ref);
    return this.rt.get(server.id).logs.tail(maxChars);
  }

  waitExit(r, ms) {
    return new Promise((resolve) => {
      if (!r.child) return resolve(true);
      const timer = setTimeout(() => resolve(false), ms);
      r.stopWaiters.push(() => {
        clearTimeout(timer);
        resolve(true);
      });
    });
  }

  managedPids() {
    return [...this.rt.values()].filter((r) => r.pid).map((r) => r.pid);
  }

  /**
   * Throws PORT_IN_USE unless the port is free; with takeover, stops the external owner first.
   * Another active Vigie server configured on the port holds it even while it is not listening.
   * With `restoring` (the server's project, at boot), a port held by what a previous Vigie left of
   * this same server is freed too; any other owner still gets PORT_IN_USE.
   */
  async ensurePortFree(server, takeover, restoring = null) {
    const owners = (await this.portOwners(server.port)).filter((o) => o.serverId !== server.id);
    if (!owners.length) return;
    const managed = owners.find((o) => o.kind === 'managed');
    if (managed) throw portTaken(server.port, managed, owners);
    const leftover = restoring && !takeover ? await this.leftoverOf(restoring, server, owners) : null;
    if (leftover) {
      const message = `${restoring.name}/${server.name}: port ${server.port} is held by what a previous Vigie left of this server (pid ${leftover.root}, ${leftover.reason}); stopping it and starting the server again`;
      this.emit('notice', message);
      this.log(this.rt.get(server.id), dim(`[vigie] ${message}`) + '\r\n');
      // taskkill /T stops the whole tree from its root; elsewhere each process gets its own signal.
      return this.releasePort(server.port, IS_WIN ? [leftover.root] : leftover.pids);
    }
    if (!takeover) {
      const o = owners[0];
      throw new VigieError('PORT_IN_USE', `Port ${server.port} is used by ${o.name || 'an unknown process'} (pid ${o.pid}), started outside Vigie`, { port: server.port, owners }, 409);
    }
    const blocked = owners.find((o) => o.kind === 'system');
    if (blocked) throw new VigieError('PROTECTED', `Port ${server.port} belongs to protected process ${blocked.name} (pid ${blocked.pid})`, { port: server.port, owners }, 403);
    return this.releasePort(server.port, owners.map((o) => o.pid));
  }

  /** Stop `pids`, forcing them if they linger, until nothing listens on `port`. */
  async releasePort(port, pids) {
    for (const pid of pids) await killTree(pid, { force: false });
    for (let i = 0; i < 25; i++) {
      if (!(await listListeners()).some((l) => l.port === port)) return;
      if (i === 10) for (const pid of pids) await killTree(pid, { force: true });
      await new Promise((res) => setTimeout(res, 200));
    }
    throw new VigieError('PORT_IN_USE', `Port ${port} is still in use after stopping its owner`, { port }, 409);
  }

  /** The leftover tree of `server` holding its port (see findLeftover), or null. */
  async leftoverOf(project, server, owners) {
    const procs = new Map(await listProcesses()); // the snapshot portOwners just read
    if (!IS_WIN) {
      for (const o of owners) for (const x of ancestry(o.pid, procs)) procs.set(x.pid, { ...x, cwd: await processCwd(x.pid) });
    }
    return findLeftover({ command: server.command, root: project.root, owners, procs });
  }

  spawnServer(project, server, r) {
    const cwd = path.resolve(project.root, server.cwd || '.');
    if (!fs.existsSync(cwd)) {
      r.lastError = `Directory not found: ${cwd}`;
      this.setState(r, 'failed');
      throw new VigieError('CWD_NOT_FOUND', r.lastError);
    }
    const env = {
      ...process.env,
      ...server.env,
      VIGIE: '1',
      VIGIE_SERVER: server.name,
      VIGIE_PROJECT: project.name,
      FORCE_COLOR: process.env.FORCE_COLOR ?? '1',
    };
    if (server.port) env.PORT = String(server.port);
    // NO_COLOR inherited from the daemon's shell would fight FORCE_COLOR (Node warns about it).
    if (!server.env.NO_COLOR) delete env.NO_COLOR;

    const gen = ++r.gen;
    const shell = IS_WIN ? null : process.env.SHELL || '/bin/sh';
    const child = IS_WIN
      ? spawn(server.command, { cwd, env, shell: true, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      : spawn(shell, ['-lc', server.command], { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });

    r.child = child;
    r.pid = child.pid ?? null;
    r.startedAt = new Date().toISOString();
    r.stopRequested = false;
    r.healthy = null;
    r.healthFailures = 0;
    r.lastError = null;
    r.lastExitCode = null;
    this.log(r, dim(`[vigie] starting: ${server.command}`) + '\r\n' + dim(`[vigie] cwd: ${cwd}${server.port ? `  PORT=${server.port}` : ''}`) + '\r\n\r\n');

    for (const stream of [child.stdout, child.stderr]) {
      const decoder = new StringDecoder('utf8');
      stream.on('data', (d) => this.log(r, decoder.write(d)));
    }
    let exited = false;
    const onExit = (code, signal) => {
      if (exited) return;
      exited = true;
      this.handleExit(r, gen, code, signal);
    };
    child.once('exit', onExit);
    child.once('error', (err) => {
      r.lastError = err.message;
      this.log(r, `\r\n[vigie] ${err.message}\r\n`);
      if (!child.pid) onExit(null, null);
    });

    const checked = server.port && server.health.type !== 'none';
    this.setState(r, checked ? 'starting' : 'running');
    if (checked) this.scheduleHealth(r, gen, 1000);
  }

  handleExit(r, gen, code, signal) {
    if (gen !== r.gen) return;
    clearTimeout(r.timers.health);
    r.child = null;
    r.pid = null;
    r.lastExitCode = code ?? signal ?? null;
    this.log(r, dim(`\r\n[vigie] process exited (${code ?? signal ?? 'unknown'})`) + '\r\n');
    for (const resolve of r.stopWaiters.splice(0)) resolve();
    if (r.stopRequested || this.shuttingDown || r.removed) {
      r.startedAt = null;
      this.setState(r, 'stopped');
      return;
    }
    this.scheduleRestart(r, `exited with code ${code ?? signal}`);
  }

  scheduleRestart(r, reason) {
    const found = this.lookup(r.id);
    if (!found) return;
    const { project, server } = found;
    const max = server.maxRestartAttempts;
    r.startedAt = null;
    if (r.restartCount >= max) {
      r.lastError = `${reason}; gave up after ${max} restart${max === 1 ? '' : 's'}`;
      this.log(r, `\x1b[31m[vigie] ${r.lastError}\x1b[0m\r\n`);
      this.setState(r, 'failed');
      return;
    }
    r.restartCount++;
    const delay = Math.min(30000, 1000 * 2 ** (r.restartCount - 1));
    r.lastError = reason;
    this.log(r, `\x1b[33m[vigie] ${reason}; restarting in ${delay / 1000}s (attempt ${r.restartCount}/${max})\x1b[0m\r\n`);
    this.setState(r, 'restarting');
    r.timers.restart = setTimeout(() => {
      try {
        this.spawnServer(project, server, r);
      } catch (err) {
        r.lastError = err.message;
        this.setState(r, 'failed');
      }
    }, delay);
  }

  scheduleHealth(r, gen, delay) {
    clearTimeout(r.timers.health);
    r.timers.health = setTimeout(() => this.runHealth(r, gen), delay);
  }

  async runHealth(r, gen) {
    if (gen !== r.gen || !r.child) return;
    const found = this.lookup(r.id);
    if (!found) return;
    const { server } = found;
    const h = server.health;
    const ok = await checkHealth(server);
    if (gen !== r.gen || !r.child) return;
    r.lastHealthAt = new Date().toISOString();

    if (ok === null) {
      if (r.state !== 'running') this.setState(r, 'running');
      return;
    }
    if (ok) {
      r.healthFailures = 0;
      const changed = r.healthy !== true || r.state !== 'running';
      r.healthy = true;
      if (changed) this.setState(r, 'running');
    } else {
      const age = Date.now() - Date.parse(r.startedAt);
      const booting = r.state === 'starting' && age < h.startupGraceSeconds * 1000;
      if (!booting) {
        r.healthFailures++;
        r.healthy = false;
        if (r.healthFailures >= h.failureThreshold) return this.restartUnhealthy(r, `health check failed ${r.healthFailures} times`);
        if (r.state !== 'unhealthy') this.setState(r, 'unhealthy');
        else this.emit('server', this.view(r.id));
      }
    }
    this.scheduleHealth(r, gen, r.state === 'starting' ? 1000 : h.intervalSeconds * 1000);
  }

  async restartUnhealthy(r, reason) {
    const pid = r.pid;
    r.gen++; // ignore the exit of the process we are about to kill
    r.child = null;
    r.pid = null;
    clearTimeout(r.timers.health);
    this.log(r, `\r\n\x1b[33m[vigie] ${reason}\x1b[0m\r\n`);
    if (pid) await killTree(pid, { force: true, group: !IS_WIN });
    this.scheduleRestart(r, reason);
  }

  // ------------------------------------------------------------ persistence

  runningIds() {
    return [...this.rt.values()].filter((r) => ACTIVE.has(r.state)).map((r) => r.id);
  }

  schedulePersist() {
    if (this.shuttingDown) return;
    clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persistNow(), 300);
  }

  persistNow() {
    clearTimeout(this.persistTimer);
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify({ running: this.runningIds(), savedAt: new Date().toISOString() }, null, 2));
    } catch {
      /* best effort */
    }
  }

  /** Start autostart servers plus whatever was running when the daemon last stopped. */
  async boot() {
    let previous = [];
    try {
      previous = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')).running || [];
    } catch {
      /* first run */
    }
    const ids = new Set(previous);
    for (const p of this.config.projects) for (const s of p.servers) if (s.autostart) ids.add(s.id);
    const results = await Promise.allSettled([...ids].filter((id) => this.lookup(id)).map((id) => this.start(id, { restore: true })));
    return results.filter((x) => x.status === 'rejected').map((x) => x.reason.message);
  }

  async shutdown() {
    this.persistNow();
    this.shuttingDown = true;
    await this.stopAll();
    for (const r of this.rt.values()) r.logs.close();
  }

  // ---------------------------------------------------------------- config

  commit() {
    this.configText = saveConfig(this.config);
    this.syncRuntime();
    this.emit('config');
  }

  /** Called by the file watcher when config.json was edited by hand. */
  reconcile(config, text) {
    this.config = config;
    this.configText = text;
    this.syncRuntime();
    this.emit('config');
  }

  async addProject(input) {
    const servers = (input.servers || []).map((s) => normalizeServer(s));
    const project = normalizeProject(
      { ...input, color: input.color || PROJECT_COLORS[this.config.projects.length % PROJECT_COLORS.length], servers },
      this.config.projects.length,
    );
    if (!fs.existsSync(project.root)) throw new VigieError('ROOT_NOT_FOUND', `Directory not found: ${project.root}`);
    const dup = this.config.projects.find((p) => p.name.toLowerCase() === project.name.toLowerCase());
    if (dup) throw new VigieError('DUPLICATE_PROJECT', `A project named "${project.name}" already exists`);
    for (const [i, server] of project.servers.entries()) {
      const before = project.servers.slice(0, i).map((s) => claim(project, s, 'stopped'));
      await this.checkPort(server.port, { sharePort: input.sharePort, pending: before });
    }
    this.config.projects.push(project);
    this.commit();
    return this.status().projects.find((p) => p.id === project.id);
  }

  updateProject(ref, patch) {
    const project = this.project(ref);
    const next = normalizeProject({ ...project, ...pick(patch, ['name', 'root', 'color', 'icon']), servers: project.servers });
    if (!fs.existsSync(next.root)) throw new VigieError('ROOT_NOT_FOUND', `Directory not found: ${next.root}`);
    Object.assign(project, { name: next.name, root: next.root, color: next.color, icon: next.icon });
    this.commit();
    return this.status().projects.find((p) => p.id === project.id);
  }

  async removeProject(ref) {
    const project = this.project(ref);
    await Promise.allSettled(project.servers.map((s) => this.stop(s.id)));
    this.config.projects = this.config.projects.filter((p) => p !== project);
    this.commit();
    return { removed: project.id };
  }

  async addServer(projectRef, input) {
    const project = this.project(projectRef);
    const server = normalizeServer(input);
    if (project.servers.some((s) => s.name.toLowerCase() === server.name.toLowerCase())) {
      throw new VigieError('DUPLICATE_SERVER', `Project "${project.name}" already has a server named "${server.name}"`);
    }
    await this.checkPort(server.port, { sharePort: input.sharePort });
    project.servers.push(server);
    this.commit();
    return this.view(server.id);
  }

  async updateServer(ref, patch) {
    const { project, server } = this.find(ref);
    const merged = { ...server, ...pick(patch, ['name', 'command', 'port', 'cwd', 'env', 'autostart', 'maxRestartAttempts']) };
    if (patch.health) merged.health = { ...server.health, ...patch.health };
    if ('port' in patch && !patch.health?.type && server.health.type === 'none' && patch.port) merged.health.type = 'tcp';
    const next = normalizeServer(merged);
    if (project.servers.some((s) => s !== server && s.name.toLowerCase() === next.name.toLowerCase())) {
      throw new VigieError('DUPLICATE_SERVER', `Project "${project.name}" already has a server named "${next.name}"`);
    }
    // Only a port that changes is checked: saving a server that already shares its port stays possible.
    if (next.port !== server.port) await this.checkPort(next.port, { except: server.id, sharePort: patch.sharePort });
    Object.assign(server, next, { id: server.id });
    this.commit();
    return this.view(server.id);
  }

  async removeServer(ref) {
    const { project, server } = this.find(ref);
    await this.stop(server.id);
    project.servers = project.servers.filter((s) => s !== server);
    this.commit();
    return { removed: server.id };
  }

  // ----------------------------------------------------------------- ports

  /**
   * Every listener on `port`, classified as managed / external / system, plus the active server
   * configured on it while it does not listen (`listening: false`): starting, between restarts…
   */
  async portOwners(port) {
    const listeners = await listListeners();
    if (!listeners.some((l) => l.port === port)) return this.reservations([], port);
    // Classify every listener so a server's extra ports are known to be internal, then keep this one.
    return this.classify(listeners, await listProcesses({ fresh: true })).filter((o) => o.port === port);
  }

  /** `vigie port <n>`: who holds the port now, and which servers are configured on it whatever their state. */
  async portInfo(port) {
    return { port, owners: await this.portOwners(port), configured: this.configuredOn(port) };
  }

  /** Servers configured on `port`, except the one with id `except`, as { serverId, serverName, projectId, port, state }. */
  configuredOn(port, except = null) {
    if (!port) return [];
    return this.config.projects.flatMap((p) => p.servers.filter((s) => s.port === port && s.id !== except).map((s) => claim(p, s, this.rt.get(s.id)?.state)));
  }

  /**
   * An active server holds its configured port even when nothing listens on it yet: while it boots,
   * or while Vigie restarts it after failed health checks. One `listening: false` entry for each such
   * server (on `port` only, when given) that `ports` does not already show listening there.
   */
  reservations(ports, port) {
    const out = [];
    for (const project of this.config.projects) {
      for (const server of project.servers) {
        const r = this.rt.get(server.id);
        if (!server.port || (port && server.port !== port) || !ACTIVE.has(r?.state)) continue;
        if (ports.some((p) => p.serverId === server.id && p.port === server.port)) continue;
        out.push({
          port: server.port,
          pid: r.pid,
          addresses: [],
          name: '',
          command: server.command,
          user: '',
          kind: 'managed',
          listening: false,
          state: r.state,
          serverId: server.id,
          serverName: `${project.name}/${server.name}`,
          projectId: project.id,
          internal: false,
          primaryPort: server.port,
        });
      }
    }
    return out;
  }

  /**
   * Refuses a port another server is configured on, naming it and the next free port: two servers
   * on one port cannot run together. `sharePort` allows it for servers never run at the same time.
   * `pending` lists servers not saved yet (the other servers of a project being added).
   */
  async checkPort(port, { except = null, sharePort = false, pending = [] } = {}) {
    if (!port || sharePort) return;
    const others = [...this.configuredOn(port, except), ...pending.filter((x) => x.port === port)];
    if (!others.length) return;
    const suggestedPort = await this.freePort(port + 1, { reserved: pending.map((x) => x.port), except });
    const names = others.map((x) => x.serverName).join(', ');
    throw new VigieError(
      'PORT_CONFLICT',
      `Port ${port} is already configured for ${names}${suggestedPort ? `; port ${suggestedPort} is free` : ''}`,
      { port, servers: others, suggestedPort },
      409,
    );
  }

  /** The first port from `from` up that no server (but `except`) is configured on and nothing listens on. */
  async freePort(from, { reserved = [], except = null, listeners = null } = {}) {
    const taken = new Set([this.apiPort, ...reserved]);
    for (const p of this.config.projects) for (const s of p.servers) if (s.port && s.id !== except) taken.add(s.port);
    for (const l of listeners ?? (await listListeners())) taken.add(l.port);
    for (let port = from; port <= 65535; port++) if (!taken.has(port)) return port;
    return null;
  }

  /**
   * The server `vigie register` would guess for a folder. Without an explicit `port`, a framework
   * default that another server is configured on, or that something listens on, moves to the next
   * free port (command included); `portMovedFrom` and `portTakenBy` say why.
   */
  async inspect(root, { port = null } = {}) {
    const info = inspectDirectory(root, { port });
    const wanted = info.suggestion?.port;
    if (port || !wanted) return info;
    const listeners = await listListeners();
    const servers = this.configuredOn(wanted).map((s) => s.serverName);
    const listening = listeners.some((l) => l.port === wanted);
    if (!servers.length && !listening) return info;
    const free = await this.freePort(wanted, { listeners });
    if (!free) return info;
    const moved = inspectDirectory(root, { port: free });
    Object.assign(moved.suggestion, { portMovedFrom: wanted, portTakenBy: { servers, listening } });
    return moved;
  }

  classify(listeners, procs) {
    const roots = new Map();
    for (const r of this.rt.values()) if (r.pid) roots.set(r.pid, r.id);
    const owner = descendantsOf([...roots.keys()], procs);
    const ports = listeners.map((l) => {
      const proc = procs.get(l.pid);
      let serverId = owner.has(l.pid) ? roots.get(owner.get(l.pid)) : null;
      if (!serverId) {
        // Fallback when parent ids are unavailable: a running server bound to its own configured port.
        const byPort = [...this.rt.values()].find((r) => r.pid && this.lookup(r.id)?.server.port === l.port);
        if (byPort && !procs.size) serverId = byPort.id;
      }
      const found = serverId ? this.lookup(serverId) : null;
      const kind = found ? 'managed' : isProtected(proc, l.pid) ? 'system' : 'external';
      return {
        port: l.port,
        pid: l.pid,
        addresses: l.addresses,
        name: proc?.name || l.name || (l.pid === 4 ? 'System' : 'unknown'),
        command: proc?.command || '',
        user: proc?.user || l.user || '',
        kind,
        listening: true,
        serverId: found?.server.id ?? null,
        serverName: found ? `${found.project.name}/${found.server.name}` : null,
        projectId: found?.project.id ?? null,
      };
    });
    ports.push(...this.reservations(ports));
    return markInternal(ports, (id) => this.lookup(id)?.server.port ?? null);
  }

  async portsReport() {
    const [listeners, procs] = await Promise.all([listListeners(), listProcesses()]);
    const ports = this.classify(listeners, procs).filter((p) => p.port !== this.apiPort || p.pid !== process.pid);
    const count = (k) => ports.filter((p) => p.kind === k && !p.internal).length;
    return {
      summary: {
        listening: ports.filter((p) => p.listening).length,
        reserved: ports.filter((p) => !p.listening).length,
        managed: count('managed'),
        internal: ports.filter((p) => p.internal).length,
        external: count('external'),
        system: count('system'),
        registeredProjects: this.config.projects.length,
      },
      ports,
    };
  }

  async killProcess(pid) {
    pid = Number(pid);
    const procs = await listProcesses({ fresh: true });
    const proc = procs.get(pid);
    if (!proc) throw new VigieError('NOT_FOUND', `No process with pid ${pid}`, undefined, 404);
    if (isProtected(proc, pid)) throw new VigieError('PROTECTED', `${proc.name} (pid ${pid}) is a protected system process`, undefined, 403);
    const owner = descendantsOf(this.managedPids(), procs);
    if (owner.has(pid)) throw new VigieError('MANAGED', `pid ${pid} belongs to a Vigie server; stop the server instead`);
    await killTree(pid);
    return { killed: pid, name: proc.name };
  }
}

/** A server configured on a port, as listed in PORT_CONFLICT errors and `vigie port`. */
function claim(project, server, state) {
  return { serverId: server.id, serverName: `${project.name}/${server.name}`, projectId: project.id, port: server.port, state: state ?? 'stopped' };
}

/** PORT_IN_USE for a port held by another Vigie server, listening or not. */
function portTaken(port, owner, owners) {
  const how = owner.listening === false ? `, which is ${owner.state} and not listening right now` : '';
  return new VigieError('PORT_IN_USE', `Port ${port} is used by Vigie server ${owner.serverName}${how}`, { port, owners }, 409);
}

/**
 * A managed server often listens on more than its own port (Next.js workers, HMR sockets…).
 * Its entry on the configured port (a listener, or a reservation while it boots) is the primary
 * one; the others are flagged `internal` so they read as part of that server, not as another
 * server. Without an entry on the configured port, the lowest port stands in as primary.
 * Sets `internal` and `primaryPort`.
 */
export function markInternal(ports, configuredPort) {
  const byServer = new Map();
  for (const p of ports) {
    p.internal = false;
    p.primaryPort = null;
    if (p.kind !== 'managed') continue;
    if (!byServer.has(p.serverId)) byServer.set(p.serverId, []);
    byServer.get(p.serverId).push(p);
  }
  for (const [id, list] of byServer) {
    const own = configuredPort(id);
    const primary = list.some((p) => p.port === own) ? own : Math.min(...list.map((p) => p.port));
    for (const p of list) Object.assign(p, { internal: p.port !== primary, primaryPort: primary });
  }
  return ports;
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj && k in obj) out[k] = obj[k];
  return out;
}
