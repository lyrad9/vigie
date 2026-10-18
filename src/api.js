// Loopback HTTP API. Every CLI action is a route; responses are { ok, data } or { ok: false, error }.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { VigieError } from './errors.js';
import { LOGO_TYPES } from './logo.js';
import { lastLines } from './logs.js';
import { UI_DIR, VERSION } from './paths.js';
import { openTerminal } from './terminal.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

/** @param {import('./supervisor.js').Supervisor} sup */
export function createApi(sup, { port, onShutdown }) {
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]);
  const allowedOrigins = new Set([...allowedHosts].map((h) => `http://${h}`));
  const clients = new Set();

  const broadcast = (event, data) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) res.write(payload);
  };
  sup.on('server', (view) => broadcast('server', view));
  sup.on('config', () => broadcast('status', sup.status()));
  sup.on('log', (entry) => broadcast('log', entry));
  setInterval(() => broadcast('ping', Date.now()), 25000).unref();

  const routes = [
    ['GET', '/api/health', () => ({ version: VERSION, pid: process.pid })],
    ['GET', '/api/status', () => sup.status()],
    ['GET', '/api/resolve', (_, q) => resolve(sup, q)],
    ['GET', '/api/ports', () => sup.portsReport()],
    ['GET', '/api/port/:port', (p) => sup.portInfo(Number(p.port))],
    ['GET', '/api/inspect', (_, q) => sup.inspect(q.get('root'), { port: Number(q.get('port')) || null })],
    ['GET', '/api/servers/:ref', (p) => sup.view(sup.find(p.ref).server.id)],
    ['GET', '/api/servers/:ref/logs', (p, q) => {
      const text = sup.logs(p.ref, Number(q.get('chars')) || 200_000);
      return { id: sup.find(p.ref).server.id, text: lastLines(text, Number(q.get('lines')) || 0) };
    }],
    ['POST', '/api/projects', (_, __, b) => sup.addProject(b)],
    ['PATCH', '/api/projects/:ref', (p, _, b) => sup.updateProject(p.ref, b)],
    ['DELETE', '/api/projects/:ref', (p) => sup.removeProject(p.ref)],
    ['POST', '/api/projects/:ref/servers', (p, _, b) => sup.addServer(p.ref, b)],
    ['PATCH', '/api/servers/:ref', (p, _, b) => sup.updateServer(p.ref, b)],
    ['DELETE', '/api/servers/:ref', (p) => sup.removeServer(p.ref)],
    ['POST', '/api/servers/:ref/start', (p, _, b) => sup.start(p.ref, { takeover: Boolean(b.takeover) })],
    ['POST', '/api/servers/:ref/stop', (p) => sup.stop(p.ref)],
    ['POST', '/api/servers/:ref/restart', (p) => sup.restart(p.ref)],
    ['POST', '/api/servers/:ref/clear-logs', (p) => (sup.clearLogs(p.ref), { cleared: true })],
    ['POST', '/api/stop-all', () => sup.stopAll()],
    ['POST', '/api/processes/:pid/kill', (p) => sup.killProcess(p.pid)],
    ['POST', '/api/projects/:ref/terminal', (p, _, b) => openTerminal(sup.terminalDir(p.ref, b.server))],
    ['PATCH', '/api/settings', (_, __, b) => sup.updateSettings(b)],
    ['POST', '/api/shutdown', () => (setTimeout(onShutdown, 50), { stopping: true })],
  ].map(([method, pattern, handler]) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
    return { method, re, keys, handler };
  });

  const server = http.createServer(async (req, res) => {
    try {
      // Reject DNS-rebinding and cross-site requests: the API can spawn processes.
      if (!allowedHosts.has(req.headers.host || '')) throw new VigieError('FORBIDDEN_HOST', 'Invalid Host header', undefined, 403);
      if (req.method !== 'GET' && req.headers.origin && !allowedOrigins.has(req.headers.origin)) {
        throw new VigieError('FORBIDDEN_ORIGIN', 'Cross-origin requests are not allowed', undefined, 403);
      }
      const url = new URL(req.url, `http://${req.headers.host}`);

      if (url.pathname === '/api/events') return openStream(req, res);
      if (!url.pathname.startsWith('/api/')) return serveStatic(url.pathname, res);
      const logo = req.method === 'GET' && url.pathname.match(/^\/api\/projects\/([^/]+)\/logo$/);
      if (logo) return serveLogo(sup.logoFile(decodeURIComponent(logo[1])), res);

      const route = routes.find((r) => r.method === req.method && r.re.test(url.pathname));
      if (!route) throw new VigieError('NOT_FOUND', `No route ${req.method} ${url.pathname}`, undefined, 404);
      const m = url.pathname.match(route.re);
      const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      const body = req.method === 'GET' ? {} : await readBody(req);
      send(res, 200, { ok: true, data: await route.handler(params, url.searchParams, body) });
    } catch (err) {
      const status = err instanceof VigieError ? err.status : 500;
      send(res, status, { ok: false, error: { code: err.code || 'INTERNAL', message: err.message, details: err.details } });
    }
  });

  function openStream(req, res) {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write(`event: status\ndata: ${JSON.stringify(sup.status())}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
  }

  return server;
}

async function resolve(sup, q) {
  const cwd = q.get('cwd') || process.cwd();
  const project = sup.resolveCwd(cwd);
  if (!project) return { cwd, project: null, server: null, inspect: await sup.inspect(cwd) };
  const name = q.get('server');
  const server = name ? project.servers.find((s) => s.name === name) : project.servers[0];
  return {
    cwd,
    project: sup.status().projects.find((p) => p.id === project.id),
    server: server ? sup.view(server.id) : null,
  };
}

function send(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 1024 * 1024) reject(new VigieError('TOO_LARGE', 'Request body too large', undefined, 413));
      else chunks.push(c);
    });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) return resolve({});
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new VigieError('INVALID_JSON', 'Body must be JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * A project's logo comes from a folder Vigie does not control. An SVG can carry script, so the
 * response is sandboxed: opened directly, it cannot run code against this API's origin.
 */
function serveLogo(file, res) {
  res.writeHead(200, {
    'content-type': LOGO_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
}

function serveStatic(pathname, res) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.resolve(UI_DIR, rel);
  if (!file.startsWith(UI_DIR + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('Not found');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}
