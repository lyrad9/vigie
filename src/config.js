import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_FILE, DEFAULT_API_PORT, HOME } from './paths.js';
import { VigieError } from './errors.js';

export const PROJECT_COLORS = ['#0A84FF', '#30D158', '#FF9F0A', '#BF5AF2', '#FF375F', '#64D2FF', '#FFD60A', '#AC8E68'];

export function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(4).toString('hex')}`;
}

export function defaultHealth(port) {
  return {
    type: port ? 'tcp' : 'none',
    path: '/',
    expectedStatus: 200,
    intervalSeconds: 10,
    timeoutSeconds: 3,
    startupGraceSeconds: 90,
    failureThreshold: 3,
  };
}

function toPort(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) throw new VigieError('INVALID_PORT', `Invalid port: ${value}`);
  return n;
}

function positiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

/** Fill defaults and validate a server definition. Unknown keys are dropped. */
export function normalizeServer(raw, { requireCommand = true } = {}) {
  const port = toPort(raw.port);
  const name = String(raw.name ?? '').trim() || 'dev';
  const command = String(raw.command ?? '').trim();
  if (requireCommand && !command) throw new VigieError('INVALID_SERVER', `Server "${name}" needs a command`);
  const base = defaultHealth(port);
  const h = { ...base, ...(raw.health || {}) };
  const type = ['tcp', 'http', 'none'].includes(h.type) ? h.type : base.type;
  const env = {};
  for (const [k, v] of Object.entries(raw.env || {})) if (k) env[k] = String(v);
  return {
    id: raw.id || newId('srv'),
    name,
    command,
    port,
    cwd: String(raw.cwd ?? ''),
    env,
    autostart: Boolean(raw.autostart),
    maxRestartAttempts: positiveInt(raw.maxRestartAttempts, 5),
    health: {
      type: port ? type : 'none',
      path: String(h.path || '/').startsWith('/') ? String(h.path || '/') : '/' + h.path,
      expectedStatus: h.expectedStatus === null ? null : positiveInt(h.expectedStatus, 200),
      intervalSeconds: Math.max(1, positiveInt(h.intervalSeconds, base.intervalSeconds)),
      timeoutSeconds: Math.max(1, positiveInt(h.timeoutSeconds, base.timeoutSeconds)),
      startupGraceSeconds: positiveInt(h.startupGraceSeconds, base.startupGraceSeconds),
      failureThreshold: Math.max(1, positiveInt(h.failureThreshold, base.failureThreshold)),
    },
  };
}

export function normalizeProject(raw, index = 0) {
  const name = String(raw.name ?? '').trim();
  if (!name) throw new VigieError('INVALID_PROJECT', 'Project needs a name');
  if (!raw.root) throw new VigieError('INVALID_PROJECT', `Project "${name}" needs a root directory`);
  const servers = (raw.servers || []).map((s) => normalizeServer(s));
  const seen = new Set();
  for (const s of servers) {
    if (seen.has(s.name)) throw new VigieError('DUPLICATE_SERVER', `Project "${name}" has two servers named "${s.name}"`);
    seen.add(s.name);
  }
  return {
    id: raw.id || newId('prj'),
    name,
    root: path.resolve(String(raw.root)),
    color: /^#[0-9a-f]{6}$/i.test(raw.color || '') ? raw.color : PROJECT_COLORS[index % PROJECT_COLORS.length],
    servers,
  };
}

export function normalizeConfig(raw) {
  const projects = (raw.projects || []).map((p, i) => normalizeProject(p, i));
  return {
    apiPort: toPort(raw.apiPort) || DEFAULT_API_PORT,
    projects,
  };
}

export function serializeConfig(config) {
  return JSON.stringify(config, null, 2) + '\n';
}

/** Read the config file, creating it on first run. Returns { config, text }. */
export function loadConfig() {
  fs.mkdirSync(HOME, { recursive: true });
  if (!fs.existsSync(CONFIG_FILE)) {
    const config = normalizeConfig({});
    return { config, text: saveConfig(config) };
  }
  const text = fs.readFileSync(CONFIG_FILE, 'utf8');
  let raw;
  try {
    raw = JSON.parse(text || '{}');
  } catch (err) {
    throw new VigieError('INVALID_CONFIG', `${CONFIG_FILE} is not valid JSON: ${err.message}`);
  }
  const config = normalizeConfig(raw);
  const normalized = serializeConfig(config);
  // Persist generated ids so they stay stable across restarts.
  if (JSON.stringify(raw) !== JSON.stringify(JSON.parse(normalized))) return { config, text: saveConfig(config) };
  return { config, text };
}

/** Atomically write the config. Returns the written text. */
export function saveConfig(config) {
  fs.mkdirSync(HOME, { recursive: true });
  const text = serializeConfig(config);
  const tmp = `${CONFIG_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, CONFIG_FILE);
  return text;
}
