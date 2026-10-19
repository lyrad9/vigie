import { AnsiTerminal } from './ansi.js';
import { SECTIONS, compareVersions, releasedUpTo } from './changelog.js';
import { MANUAL } from './manual.js';
import { resolveLanguage, translator } from './strings.js';

const $ = (sel) => document.querySelector(sel);
const ACTIVE = new Set(['starting', 'running', 'unhealthy', 'restarting']);
// Project identity colors stay clear of green, amber and red: those only ever mean server state.
const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#6366F1', '#0EA5E9', '#B45309', '#64748B'];

const state = {
  status: null,
  ports: null,
  route: { view: 'empty', id: null },
  logsFor: null,
  conflict: null, // { serverId, port, owners }
  offline: false,
  updates: null, // the desktop updater's state (desktop/preload.cjs)
  remoteNotes: null, // { version, entries, loading }: notes of a newer release
};

const term = new AnsiTerminal($('#term'));
term.onWrite = () => {
  if ($('#term-follow').checked) $('#term').scrollTop = $('#term').scrollHeight;
  syncTermEmpty();
};

// --------------------------------------------------------------- language

let langSetting = 'auto';
let lang = 'en';
let t = translator('en');
try {
  lang = localStorage.getItem('vigie-lang-resolved') || resolveLanguage('auto', navigator.language);
  t = translator(lang);
} catch {}

/** Fill every static text: data-i18n sets the text, data-i18n-attr="attr:key;attr:key" sets attributes. */
function applyStaticTexts() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':');
      el.setAttribute(attr, t(key));
    }
  }
}

function setLanguage(setting) {
  langSetting = setting;
  const next = resolveLanguage(setting, navigator.language);
  $('#lang-select').value = setting;
  if (next === lang && document.documentElement.lang === lang) return;
  lang = next;
  t = translator(lang);
  try {
    localStorage.setItem('vigie-lang-resolved', lang);
  } catch {}
  applyStaticTexts();
  renderManual();
  render();
}

$('#lang-select').addEventListener('change', async (e) => {
  const value = e.target.value;
  setLanguage(value);
  await api('PATCH', '/settings', { language: value }).catch((err) => toast(err.message, 'error'));
});

// ------------------------------------------------------------------ helpers

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function tildify(p) {
  return String(p || '').replace(/^[A-Z]:\\Users\\[^\\]+/i, '~').replace(/^\/(Users|home)\/[^/]+/, '~').replace(/\\/g, '/');
}

function uptime(iso) {
  if (!iso) return '';
  let s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s %= 86400) / 3600);
  const m = Math.floor((s %= 3600) / 60);
  if (d) return t('time.days', { d, h });
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

async function api(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json();
  if (!payload.ok) throw Object.assign(new Error(payload.error.message), payload.error);
  return payload.data;
}

function toast(message, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.textContent = message;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), kind === 'error' ? 6000 : 3200);
}

function confirmDialog(title, text, okLabel = t('btn.confirm')) {
  const dlg = $('#dlg-confirm');
  $('#confirm-title').textContent = title;
  $('#confirm-text').textContent = text;
  $('#confirm-ok').textContent = okLabel;
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise((resolve) => dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true }));
}

const allServers = () => (state.status?.projects || []).flatMap((p) => p.servers.map((s) => ({ project: p, server: s })));
const findServer = (id) => allServers().find((x) => x.server.id === id) || null;

function upsertServer(view) {
  for (const p of state.status?.projects || []) {
    const i = p.servers.findIndex((s) => s.id === view.id);
    if (i !== -1) p.servers[i] = view;
  }
}

/** The project's logo when it has one (and wants it), else its initial on its color. */
function markHtml(p, cls = '') {
  const letter = esc(p.name[0]?.toUpperCase() || '?');
  if (p.icon !== 'letter' && p.logo) {
    const src = `/api/projects/${encodeURIComponent(p.id)}/logo?v=${p.logo.version}`;
    return `<span class="mark logo ${cls}" data-letter="${letter}" style="--mark:${esc(p.color)}"><img src="${src}" alt="" draggable="false" /></span>`;
  }
  return `<span class="mark ${cls}" style="--mark:${esc(p.color)}">${letter}</span>`;
}

// A logo that fails to load falls back to the letter.
document.addEventListener(
  'error',
  (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.parentElement?.classList.contains('logo')) return;
    const mark = img.parentElement;
    mark.classList.remove('logo');
    mark.textContent = mark.dataset.letter || '?';
  },
  true,
);

// ------------------------------------------------------------------ routing

function parseRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (hash === 'ports') return { view: 'ports', id: null };
  if (hash === 'updates') return { view: 'updates', id: null };
  if (hash === 'manual' || hash.startsWith('manual/')) return { view: 'manual', id: hash.slice(7) || null };
  if (hash.startsWith('s/')) return { view: 'server', id: decodeURIComponent(hash.slice(2)) };
  return { view: 'default', id: null };
}

function applyRoute() {
  let route = parseRoute();
  if (route.view === 'server' && state.status && !findServer(route.id)) route = { view: 'default', id: null };
  if (route.view === 'default') {
    const first = allServers().find((x) => ACTIVE.has(x.server.state)) || allServers()[0];
    route = first ? { view: 'server', id: first.server.id } : { view: 'empty', id: null };
  }
  const enteringManual = route.view === 'manual' && (state.route.view !== 'manual' || state.route.id !== route.id);
  state.route = route;
  if (route.view === 'server' && state.logsFor !== route.id) loadLogs(route.id);
  if (route.view === 'ports') refreshPorts();
  render();
  if (enteringManual) scrollManual(route.id);
}

async function loadLogs(id) {
  state.logsFor = id;
  term.reset();
  syncTermEmpty();
  try {
    const { text } = await api('GET', `/servers/${encodeURIComponent(id)}/logs?chars=300000`);
    if (state.logsFor !== id) return;
    term.reset();
    term.write(text);
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ------------------------------------------------------------------- render

function render() {
  if (!state.status) return;
  renderSidebar();
  for (const v of ['server', 'ports', 'updates', 'manual', 'empty']) $(`#view-${v}`).hidden = state.route.view !== v;
  $('#btn-ports').classList.toggle('active', state.route.view === 'ports');
  $('#btn-manual').classList.toggle('active', state.route.view === 'manual');
  $('#btn-updates').classList.toggle('active', state.route.view === 'updates');
  $('#btn-ports').toggleAttribute('aria-current', state.route.view === 'ports');
  $('#btn-manual').toggleAttribute('aria-current', state.route.view === 'manual');
  $('#btn-updates').toggleAttribute('aria-current', state.route.view === 'updates');
  if (state.route.view === 'ports') document.title = t('doc.ports');
  else if (state.route.view === 'manual') document.title = t('doc.manual');
  else if (state.route.view === 'updates') document.title = t('doc.updates');
  else if (state.route.view !== 'server') document.title = 'Vigie';
  if (state.route.view === 'server') renderServer();
  if (state.route.view === 'ports') renderPorts();
  if (state.route.view === 'updates') renderUpdates();
  renderUpdatesDot();
}

function renderSidebar() {
  const servers = allServers();
  const running = servers.filter((x) => x.server.state === 'running').length;
  $('#run-count').textContent = servers.length ? t('run.count', { running, total: servers.length }) : '';
  $('#projects').innerHTML = state.status.projects
    .map(
      (p) => `
      <section class="project">
        <div class="project-head">
          ${markHtml(p)}
          <span class="pname" title="${esc(p.root)}">${esc(p.name)}</span>
          <button class="icon-btn" type="button" data-add-server="${esc(p.id)}" title="${esc(t('project.addServer'))}" aria-label="${esc(t('project.addServerTo', { name: p.name }))}">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9"/></svg>
          </button>
          <button class="icon-btn" type="button" data-edit-project="${esc(p.id)}" title="${esc(t('project.edit'))}" aria-label="${esc(t('project.editNamed', { name: p.name }))}">
            <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.5" cy="8" r=".7"/><circle cx="8" cy="8" r=".7"/><circle cx="12.5" cy="8" r=".7"/></svg>
          </button>
        </div>
        ${
          p.servers.length
            ? p.servers
                .map(
                  (s) => `
          <a class="srv${state.route.view === 'server' && state.route.id === s.id ? ' active' : ''}" href="#/s/${encodeURIComponent(s.id)}" title="${esc(s.command)}"${state.route.view === 'server' && state.route.id === s.id ? ' aria-current="page"' : ''}>
            <span class="dot ${esc(s.state)}" aria-hidden="true"></span>
            <span class="sname">${esc(s.name)}</span>
            <span class="sup" data-uptime="${esc(ACTIVE.has(s.state) ? s.startedAt || '' : '')}">${ACTIVE.has(s.state) ? uptime(s.startedAt) : ''}</span>
            <span class="surl">${s.port ? `localhost:${s.port}` : esc(t('srv.noPort'))}</span>
            <span class="sr-only">${esc(t(`state.${s.state}`))}</span>
          </a>`,
                )
                .join('')
            : `<div class="no-servers">${esc(t('project.noServers'))}</div>`
        }
      </section>`,
    )
    .join('');
}

function renderServer() {
  const found = findServer(state.route.id);
  if (!found) return;
  const { project, server: s } = found;
  const active = ACTIVE.has(s.state);

  $('#srv-name').textContent = s.name;
  $('#srv-crumb').innerHTML = `${markHtml(project, 'sm')}<span>${esc(project.name)}</span><span class="sep">/</span><span class="path">${esc(tildify(project.root))}${s.cwd ? '/' + esc(s.cwd) : ''}</span>`;
  document.title = `${s.name} · ${project.name} · Vigie`;

  const toggle = $('#srv-toggle');
  toggle.textContent = s.state === 'stopping' ? t('srv.stopping') : active ? t('srv.stop') : t('srv.start');
  toggle.disabled = s.state === 'stopping';
  toggle.className = active ? 'btn quiet' : 'btn primary';
  $('#srv-restart').disabled = !active;
  const open = $('#srv-open');
  open.href = s.url || '#';
  open.setAttribute('aria-disabled', String(!(s.url && s.state === 'running')));
  $('#srv-terminal').title = t('srv.terminalTitle', { dir: tildify(s.cwd ? `${project.root}/${s.cwd}` : project.root) });

  const st = $('#st-state');
  st.className = `pill ${s.state}`;
  st.textContent = t(`state.${s.state}`);
  $('#st-pid').textContent = s.pid ?? '—';
  $('#st-port').textContent = s.port ?? '—';
  const up = $('#st-uptime');
  up.dataset.uptime = active ? s.startedAt || '' : '';
  up.textContent = active && s.startedAt ? uptime(s.startedAt) : '—';
  $('#st-restarts').textContent = `${s.restartCount} / ${s.maxRestartAttempts}`;
  const kind = s.health.type === 'http' ? `HTTP ${s.health.path}` : 'TCP';
  const health = $('#st-health');
  health.textContent = s.health.type === 'none' ? t('health.off') : s.healthy === true ? `${kind} ✓` : s.healthy === false ? `${kind} ✕` : `${kind} …`;
  health.className = s.health.type !== 'none' && s.healthy === false ? 'bad' : '';

  const err = $('#srv-error');
  err.hidden = !(s.lastError && ['failed', 'restarting', 'unhealthy'].includes(s.state));
  err.textContent = s.lastError || '';

  $('#srv-command').textContent = s.command;
  $('#term-empty-text').textContent = t('term.stoppedText', { name: s.name });

  const c = state.conflict;
  const showConflict = c && c.serverId === s.id && !active;
  $('#conflict').hidden = !showConflict;
  if (showConflict) {
    const o = c.owners[0];
    $('#conflict-text').textContent = t('conflict.text', { name: o.name, pid: o.pid, port: c.port });
  }
  syncTermEmpty();
}

function syncTermEmpty() {
  const s = findServer(state.route.id)?.server;
  $('#term-empty').hidden = !s || ACTIVE.has(s.state) || s.state === 'stopping' || term.hasText;
}

// -------------------------------------------------------------------- ports

let portsTimer = null;

async function refreshPorts() {
  clearTimeout(portsTimer);
  try {
    state.ports = await api('GET', '/ports');
    if (state.route.view === 'ports') renderPorts();
  } catch (err) {
    toast(err.message, 'error');
  }
  if (state.route.view === 'ports') portsTimer = setTimeout(refreshPorts, 5000);
}

/** Muted line under a server's main port listing its other listeners, e.g. Next.js workers. */
function internalNote(o, internals) {
  if (!internals.length) return '';
  const same = internals.every((i) => i.pid === o.pid);
  const list = internals.map((i) => (same ? i.port : `${i.port} (PID ${i.pid})`)).join(', ');
  const title = t('ports.internalTitle', { server: o.serverName });
  return `<div class="pi" title="${esc(title)}">${esc(t('ports.internal', { list }))}${same ? ` ${esc(t('ports.sameProcess'))}` : ''}</div>`;
}

function portRow(o, internals = []) {
  // A server that is starting or restarting holds its port before it listens on it.
  const idle = o.listening === false;
  const http = o.kind !== 'system' && !idle ? `<a class="btn tiny quiet" href="http://localhost:${o.port}" target="_blank" rel="noreferrer">${esc(t('ports.open'))}</a>` : '';
  const action =
    o.kind === 'managed'
      ? `<a class="btn tiny quiet" href="#/s/${encodeURIComponent(o.serverId)}">${esc(t('ports.show'))}</a>`
      : o.kind === 'external'
        ? `<button class="btn tiny danger" type="button" data-kill="${o.pid}" data-name="${esc(o.name)}" data-port="${o.port}">${esc(t('ports.stopProcess'))}</button>`
        : '';
  const label = o.kind === 'managed' ? o.serverName.split('/')[1] : o.name;
  const meta = idle
    ? esc(t('ports.notListening', { state: t(`state.${o.state}`) }))
    : `${esc(o.name)} · PID ${o.pid}${o.user ? ' · ' + esc(o.user) : ''}${o.kind === 'external' && o.command ? ' · ' + esc(o.command) : ''}`;
  return `
    <div class="prow">
      <span class="pp">:${o.port}</span>
      <div class="pbody">
        <div class="pn">${esc(label)} <span class="badge ${o.kind}">${esc(t(`badge.${o.kind}`))}</span></div>
        <div class="pm" title="${esc(o.command)}">${meta}</div>
        ${internalNote(o, internals)}
      </div>
      <div class="pa">${http}${action}</div>
    </div>`;
}

function group(mark, title, sub, count, rows) {
  return `
    <section class="pgroup">
      <div class="pgroup-head">${mark}<div class="pgroup-title"><div class="t">${esc(title)}</div><div class="s">${esc(sub)}</div></div><span class="n">${esc(count)}</span></div>
      ${rows.join('')}
    </section>`;
}

function renderPorts() {
  const r = state.ports;
  if (!r) return;
  const q = $('#ports-search').value.trim().toLowerCase();
  const match = (o) => !q || [o.port, o.name, o.command, o.serverName, o.pid].some((v) => String(v ?? '').toLowerCase().includes(q));
  // A server's internal listeners ride on its main row, and a search hit on either shows both.
  const rows = [];
  const mainRow = new Map();
  for (const o of r.ports.filter((p) => !p.internal)) {
    const row = { o, internals: [] };
    if (o.kind === 'managed' && !mainRow.has(o.serverId)) mainRow.set(o.serverId, row);
    rows.push(row);
  }
  for (const o of r.ports.filter((p) => p.internal)) {
    const main = mainRow.get(o.serverId);
    if (main) main.internals.push(o);
    else rows.push({ o, internals: [] });
  }
  const shown = rows.filter((x) => match(x.o) || x.internals.some(match));
  const s = r.summary;
  $('#ports-summary').textContent =
    t('ports.summary', { listening: s.listening, managed: s.managed, external: s.external, system: s.system }) +
    (s.internal ? t('ports.summaryInternal', { n: s.internal }) : '') +
    (s.reserved ? t('ports.summaryReserved', { n: s.reserved }) : '');

  const html = [];
  for (const p of state.status.projects) {
    const list = shown.filter((x) => x.o.projectId === p.id);
    if (!list.length) continue;
    const extra = list.reduce((n, x) => n + x.internals.length, 0);
    const count = t.plural('ports.count', list.length) + (extra ? t('ports.countInternal', { n: extra }) : '');
    html.push(group(markHtml(p, 'lg'), p.name, tildify(p.root), count, list.map((x) => portRow(x.o, x.internals))));
  }
  const ports = shown.map((x) => x.o);
  const external = ports.filter((o) => o.kind === 'external');
  if (external.length) {
    const mark = `<span class="mark lg warn" aria-hidden="true">!</span>`;
    html.push(group(mark, t('ports.externalTitle'), t('ports.externalSub'), t('ports.externalCount', { n: external.length }), external.map((o) => portRow(o))));
  }
  const system = ports.filter((o) => o.kind === 'system');
  if (system.length) {
    const mark = `<span class="mark lg sys" aria-hidden="true">S</span>`;
    const services = new Set(system.map((o) => o.name)).size;
    html.push(group(mark, t('ports.systemTitle'), t('ports.systemSub'), t('ports.systemCount', { services, ports: system.length }), system.map((o) => portRow(o))));
  }
  $('#ports-groups').innerHTML = html.join('') || `<div class="ports-empty">${esc(q ? t('ports.noMatch') : t('ports.none'))}</div>`;
  $('#ports-foot').textContent = t.plural('ports.foot', s.registeredProjects);
}

async function killProcess(pid, name, port) {
  const text = port ? t('kill.textPort', { pid, port }) : t('kill.text', { pid });
  const ok = await confirmDialog(t('kill.title', { name }), text, t('ports.stopProcess'));
  if (!ok) return false;
  try {
    await api('POST', `/processes/${pid}/kill`);
    toast(t('kill.done', { name, pid }));
    return true;
  } catch (err) {
    toast(err.message, 'error');
    return false;
  }
}

// ------------------------------------------------------------------ updates

// The desktop app's updater, through desktop/preload.cjs. A browser has none: the page then only lists versions.
const updater = window.vigieDesktop?.updates ?? null;
const RELEASES_URL = 'https://github.com/lyrad9/vigie/releases';

function setUpdates(next) {
  state.updates = next;
  // Notes for a version this copy does not know come from that release.
  const v = next?.version;
  if (v && compareVersions(v, next.current) > 0 && state.remoteNotes?.version !== v) {
    state.remoteNotes = { version: v, entries: null, loading: true };
    updater.notes(v).then((entries) => {
      if (state.remoteNotes?.version !== v) return;
      state.remoteNotes = { version: v, entries, loading: false };
      if (state.route.view === 'updates') renderUpdates();
    });
  }
  renderUpdatesDot();
  if (state.route.view === 'updates') renderUpdates();
}

function renderUpdatesDot() {
  const ready = state.updates?.status === 'ready';
  $('#updates-dot').hidden = !ready;
  $('#btn-updates').title = ready ? t('updates.ready', { version: state.updates.version }) : '';
}

const formatDate = (iso, withTime = false) => {
  try {
    const d = withTime ? new Date(iso) : new Date(`${iso}T12:00:00`);
    return new Intl.DateTimeFormat(lang, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'long' }).format(d);
  } catch {
    return iso;
  }
};

/** The card at the top: where this copy stands, and the one action that fits. */
function updateStatusCard(u, current) {
  const card = (kind, title, sub, actions = '', extra = '') => `
    <section class="pgroup upd-status ${kind}">
      <div class="upd-status-row">
        <span class="upd-icon" aria-hidden="true"></span>
        <div class="upd-text"><div class="t">${esc(title)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ''}${extra}</div>
        ${actions ? `<div class="upd-actions">${actions}</div>` : ''}
      </div>
    </section>`;
  const releases = `<a class="btn quiet" href="${RELEASES_URL}" target="_blank" rel="noopener">${esc(t('updates.releases'))}</a>`;
  if (!updater) return card('info', t('updates.current', { version: current }), t('updates.browser'), releases);
  if (!u.enabled) return card('info', t('updates.unavailable'), t('updates.unavailableSub'), releases);
  const checked = u.checkedAt ? t('updates.checkedAt', { when: formatDate(u.checkedAt, true) }) : t('updates.idle');
  switch (u.status) {
    case 'checking':
      return card('busy', t('updates.checking'), checked);
    case 'downloading': {
      const progress = Math.max(0, Math.min(100, u.progress ?? 0));
      const bar = `<div class="upd-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div>`;
      return card('busy', t('updates.downloading', { version: u.version, progress }), t('updates.downloadingSub'), '', bar);
    }
    case 'ready':
      return card('ready', t('updates.ready', { version: u.version }), t('updates.readySub'), `<button class="btn primary" type="button" data-update="install">${esc(t('updates.install'))}</button>`);
    case 'error':
      return card('error', t('updates.error'), u.error || '', releases);
    default:
      return card('ok', u.status === 'current' ? t('updates.upToDate') : t('updates.current', { version: current }), checked);
  }
}

/** One version's notes. `sub` replaces the date line (a version known only by its number has none). */
function changelogEntry(entry, badge = '', sub = null) {
  const notes = entry[lang] || entry.en || {};
  const sections = SECTIONS.filter((k) => notes[k]?.length)
    .map((k) => `<h3>${esc(t(`updates.section.${k}`))}</h3><ul>${notes[k].map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`)
    .join('');
  const missing = `<p>${esc(t('updates.notesUnavailable'))} <a href="${RELEASES_URL}/tag/v${esc(entry.version)}" target="_blank" rel="noopener">${esc(t('updates.releases'))}</a></p>`;
  return `
    <section class="pgroup upd-entry">
      <div class="pgroup-head">
        <div class="pgroup-title"><div class="t">Vigie ${esc(entry.version)}</div><div class="s">${esc(sub ?? (entry.date ? formatDate(entry.date) : t('updates.unreleased')))}</div></div>
        ${badge}
      </div>
      <div class="upd-notes">${sections || missing}</div>
    </section>`;
}

function renderUpdates() {
  if (!state.status) return;
  const u = state.updates;
  const current = u?.current || state.status.version;
  $('#updates-current').textContent = t('updates.current', { version: current });
  $('#updates-check').hidden = !updater || !u?.enabled;
  $('#updates-check').disabled = ['checking', 'downloading', 'ready'].includes(u?.status);

  const html = [updateStatusCard(u || {}, current)];
  // A newer version: its own notes when the release has them, else a pointer to the release page.
  if (u?.version && compareVersions(u.version, current) > 0) {
    const remote = state.remoteNotes?.version === u.version ? state.remoteNotes : null;
    const newer = (remote?.entries || []).filter((e) => compareVersions(e.version, current) > 0 && compareVersions(e.version, u.version) <= 0);
    const badge = `<span class="badge managed">${esc(t('updates.available'))}</span>`;
    if (newer.length) html.push(...newer.map((e) => changelogEntry(e, badge)));
    else if (!remote?.loading) html.push(changelogEntry({ version: u.version, date: null, en: {}, fr: {} }, badge, ''));
  }
  html.push(`<p class="upd-heading">${esc(t('updates.history'))}</p>`);
  html.push(...releasedUpTo(current).map((e) => changelogEntry(e, e.version === current ? `<span class="badge system">${esc(t('updates.installed'))}</span>` : '')));
  $('#updates-body').innerHTML = html.join('');
}

$('#updates-check').addEventListener('click', async () => {
  $('#updates-check').disabled = true;
  try {
    setUpdates(await updater.check());
  } catch (err) {
    toast(err.message, 'error');
    renderUpdates();
  }
});
$('#updates-body').addEventListener('click', async (e) => {
  const button = e.target.closest('[data-update="install"]');
  if (!button) return;
  button.disabled = true;
  button.textContent = t('updates.installing');
  try {
    if (!(await updater.install())) renderUpdates();
  } catch (err) {
    toast(err.message, 'error');
    renderUpdates();
  }
});
if (updater) {
  updater.get().then(setUpdates).catch(() => {});
  updater.onChange(setUpdates);
}

// ------------------------------------------------------------------- manual

function renderManual() {
  const chapters = MANUAL[lang] || MANUAL.en;
  $('#toc').innerHTML = chapters.map((c) => `<li><a href="#/manual/${c.id}" data-chapter="${c.id}">${esc(c.title)}</a></li>`).join('');
  // Chapters are static HTML written in manual.js, never user data.
  $('#doc-body').innerHTML = chapters.map((c) => `<section class="chapter" id="m-${c.id}" aria-labelledby="h-${c.id}"><h2 id="h-${c.id}">${esc(c.title)}</h2>${c.html}</section>`).join('');
  syncToc();
}

function scrollManual(id) {
  const target = id && document.getElementById(`m-${id}`);
  if (target) target.scrollIntoView({ block: 'start' });
  else $('#doc').scrollTop = 0;
  syncToc();
}

/** Highlight the chapter being read. */
function syncToc() {
  const doc = $('#doc');
  const top = doc.getBoundingClientRect().top + 96;
  let current = null;
  for (const section of doc.querySelectorAll('.chapter')) if (section.getBoundingClientRect().top <= top) current = section.id.slice(2);
  current ??= doc.querySelector('.chapter')?.id.slice(2);
  for (const a of document.querySelectorAll('#toc a')) {
    const on = a.dataset.chapter === current;
    a.classList.toggle('active', on);
    a.toggleAttribute('aria-current', on);
  }
}
$('#doc').addEventListener('scroll', syncToc, { passive: true });

// ------------------------------------------------------------------ actions

async function startServer(id, takeover = false) {
  try {
    const view = await api('POST', `/servers/${encodeURIComponent(id)}/start`, { takeover });
    state.conflict = null;
    upsertServer(view);
    render();
  } catch (err) {
    if (err.code === 'PORT_IN_USE' && err.details?.owners?.some((o) => o.kind === 'external')) {
      state.conflict = { serverId: id, port: err.details.port, owners: err.details.owners.filter((o) => o.kind === 'external') };
      render();
    } else {
      toast(err.message, 'error');
    }
  }
}

async function serverAction(id, action) {
  try {
    upsertServer(await api('POST', `/servers/${encodeURIComponent(id)}/${action}`));
    render();
  } catch (err) {
    toast(err.message, 'error');
  }
}

$('#srv-toggle').addEventListener('click', () => {
  const s = findServer(state.route.id)?.server;
  if (!s) return;
  if (ACTIVE.has(s.state)) serverAction(s.id, 'stop');
  else startServer(s.id);
});
$('#term-start').addEventListener('click', () => startServer(state.route.id));
$('#srv-restart').addEventListener('click', () => serverAction(state.route.id, 'restart'));
$('#srv-edit').addEventListener('click', () => openServerDialog(state.route.id));
$('#srv-terminal').addEventListener('click', async () => {
  const found = findServer(state.route.id);
  if (!found) return;
  const btn = $('#srv-terminal');
  btn.disabled = true;
  try {
    const r = await api('POST', `/projects/${encodeURIComponent(found.project.id)}/terminal`, { server: found.server.id });
    toast(t('toast.terminal', { terminal: r.terminal, dir: tildify(r.opened) }));
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});
$('#term-clear').addEventListener('click', async () => {
  await api('POST', `/servers/${encodeURIComponent(state.route.id)}/clear-logs`).catch(() => {});
  term.reset();
  syncTermEmpty();
});
$('#term').addEventListener('scroll', () => {
  const el = $('#term');
  $('#term-follow').checked = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
});
$('#conflict-takeover').addEventListener('click', () => startServer(state.conflict.serverId, true));
$('#conflict-kill').addEventListener('click', async () => {
  const o = state.conflict.owners[0];
  if (await killProcess(o.pid, o.name, state.conflict.port)) {
    state.conflict = null;
    render();
  }
});

$('#ports-refresh').addEventListener('click', refreshPorts);
$('#ports-search').addEventListener('input', renderPorts);
$('#ports-groups').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-kill]');
  if (!btn) return;
  if (await killProcess(Number(btn.dataset.kill), btn.dataset.name, Number(btn.dataset.port))) refreshPorts();
});

$('#projects').addEventListener('click', (e) => {
  const add = e.target.closest('[data-add-server]');
  if (add) return openServerDialog(null, add.dataset.addServer);
  const edit = e.target.closest('[data-edit-project]');
  if (edit) return openProjectDialog(edit.dataset.editProject);
});

$('#btn-add-project').addEventListener('click', () => openProjectDialog());
$('#empty-add').addEventListener('click', () => openProjectDialog());

// Theme: System, Light or Dark. Stored per viewer; "System" follows the OS.
function applyTheme(theme) {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  for (const b of document.querySelectorAll('[data-theme-choice]')) b.setAttribute('aria-checked', String(b.dataset.themeChoice === theme));
}
let theme = 'system';
try {
  theme = localStorage.getItem('vigie-theme') || 'system';
} catch {}
applyTheme(theme);
$('#theme-seg').addEventListener('click', (e) => {
  const b = e.target.closest('[data-theme-choice]');
  if (!b) return;
  theme = b.dataset.themeChoice;
  try {
    localStorage.setItem('vigie-theme', theme);
  } catch {}
  applyTheme(theme);
});

// ------------------------------------------------------------------ dialogs

function formError(form, message) {
  const el = form.querySelector('.form-error');
  el.hidden = !message;
  el.textContent = message || '';
}

/** Run `save` when the form is submitted with the OK button; keep the dialog open on error. */
function handleSubmit(form, save) {
  form.addEventListener('submit', async (e) => {
    if (e.submitter?.value !== 'ok') return;
    e.preventDefault();
    formError(form, '');
    const buttons = form.querySelectorAll('button');
    buttons.forEach((b) => (b.disabled = true));
    try {
      await save();
      form.closest('dialog').close();
    } catch (err) {
      if (err.code === 'PORT_CONFLICT') portConflict(form, err.details);
      else formError(form, err.message);
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  });
  form.querySelector('.form-error').addEventListener('click', (e) => {
    const use = e.target.closest('[data-use-port]');
    if (use) {
      form.port.value = use.dataset.usePort;
      formError(form, '');
      return form.port.focus();
    }
    const share = e.target.closest('[data-share-port]');
    if (share) {
      form.dataset.sharePort = share.dataset.sharePort;
      form.requestSubmit(form.querySelector('button[value="ok"]'));
    }
  });
}

/** Another server is configured on the port: offer the next free one, or sharing it on purpose. */
function portConflict(form, d) {
  const el = form.querySelector('.form-error');
  const servers = d.servers.map((s) => s.serverName).join(', ');
  const use = d.suggestedPort ? `<button class="btn tiny quiet" type="button" data-use-port="${d.suggestedPort}">${esc(t('portConflict.use', { port: d.suggestedPort }))}</button>` : '';
  const share = `<button class="btn tiny quiet" type="button" data-share-port="${d.port}">${esc(t('portConflict.share'))}</button>`;
  el.innerHTML = `${esc(t('portConflict.text', { port: d.port, servers }))}<span class="actions">${use}${share}</span>`;
  el.hidden = false;
}

/** True once the user chose to share this port despite the conflict. */
const sharesPort = (form, port) => Boolean(port) && form.dataset.sharePort === String(port);

let projectEdit = null;
let projectColor = COLORS[0];
let nameTouched = false;
let detectTimer = null;
let detectedLogo = null; // relative path found in the folder being added

function renderSwatches() {
  const colors = COLORS.includes(projectColor) ? COLORS : [projectColor, ...COLORS.slice(0, -1)];
  $('#swatches').innerHTML = colors
    .map((c) => `<button type="button" class="swatch" role="radio" aria-label="${c}" aria-checked="${c === projectColor}" data-color="${c}" style="background:${c}"></button>`)
    .join('');
  renderIconChoice();
}
$('#swatches').addEventListener('click', (e) => {
  const b = e.target.closest('[data-color]');
  if (!b) return;
  projectColor = b.dataset.color;
  renderSwatches();
});

/** Previews of both icon options, and a hint saying where the logo comes from. */
function renderIconChoice() {
  const form = $('#form-project');
  const name = form.name.value.trim() || '?';
  const letter = esc(name[0].toUpperCase());
  const logo = projectEdit?.logo || null;
  const preview = $('#icon-preview-auto');
  if (logo) {
    preview.className = 'mark lg logo';
    preview.style.setProperty('--mark', projectColor);
    preview.dataset.letter = letter;
    preview.innerHTML = `<img src="/api/projects/${encodeURIComponent(projectEdit.id)}/logo?v=${logo.version}" alt="" />`;
  } else {
    preview.className = 'mark lg';
    preview.style.setProperty('--mark', projectColor);
    preview.innerHTML = detectedLogo ? '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="2.5"/><path d="m4.5 11 2.6-3 2 2.2 1.3-1.4 1.6 2.2"/></svg>' : letter;
  }
  const letterMark = $('#icon-preview-letter');
  letterMark.style.setProperty('--mark', projectColor);
  letterMark.textContent = name[0].toUpperCase();
  const found = logo?.path || detectedLogo;
  $('#icon-hint').textContent = found ? t('icon.found', { path: found }) : t('icon.none');
}

function openProjectDialog(id = null) {
  const form = $('#form-project');
  form.reset();
  formError(form, '');
  delete form.dataset.sharePort;
  projectEdit = id ? state.status.projects.find((p) => p.id === id) : null;
  detectedLogo = null;
  nameTouched = Boolean(projectEdit);
  projectColor = projectEdit?.color || COLORS[state.status.projects.length % COLORS.length];
  $('#dlg-project-title').textContent = projectEdit ? t('dlg.editProject') : t('dlg.addProject');
  $('#project-submit').textContent = projectEdit ? t('btn.save') : t('dlg.addProject');
  $('#project-delete').hidden = !projectEdit;
  $('#first-server').hidden = Boolean(projectEdit);
  $('#detect-hint').textContent = t('f.folderHint');
  if (projectEdit) {
    form.root.value = projectEdit.root;
    form.name.value = projectEdit.name;
    form.icon.value = projectEdit.icon || 'auto';
  }
  renderSwatches();
  $('#dlg-project').showModal();
}

$('#form-project').name.addEventListener('input', () => {
  nameTouched = true;
  renderIconChoice();
});
$('#form-project').root.addEventListener('input', () => {
  clearTimeout(detectTimer);
  detectTimer = setTimeout(detectProject, 350);
});

async function detectProject() {
  const form = $('#form-project');
  const root = form.root.value.trim().replace(/^"|"$/g, '');
  if (!root) return;
  const info = await api('GET', `/inspect?root=${encodeURIComponent(root)}`).catch(() => null);
  if (!info) return;
  if (!info.exists) {
    $('#detect-hint').textContent = t('detect.notFound');
    return;
  }
  if (!nameTouched) form.name.value = info.name;
  detectedLogo = info.logo;
  const g = info.suggestion;
  if (!projectEdit && g) {
    form.serverName.value = g.name;
    form.command.value = g.command;
    form.port.value = g.port ?? '';
  }
  // The daemon already moved a default port that another server has, and says why.
  const moved = !projectEdit && g?.portMovedFrom
    ? ' ' + t('detect.portMoved', { from: g.portMovedFrom, port: g.port, by: g.portTakenBy.servers.join(', ') || t('detect.otherProgram') })
    : '';
  $('#detect-hint').textContent = g
    ? t('detect.found', { what: [g.framework, g.packageManager].filter(Boolean).join(' · ') || t('detect.devScript') }) + moved
    : t('detect.none');
  renderIconChoice();
}

handleSubmit($('#form-project'), async () => {
  const form = $('#form-project');
  const body = { name: form.name.value.trim(), root: form.root.value.trim().replace(/^"|"$/g, ''), color: projectColor, icon: form.icon.value };
  if (projectEdit) {
    await api('PATCH', `/projects/${encodeURIComponent(projectEdit.id)}`, body);
    toast(t('toast.saved', { name: body.name }));
    return;
  }
  if (form.command.value.trim()) {
    body.servers = [{ name: form.serverName.value.trim() || 'dev', command: form.command.value.trim(), port: form.port.value || null }];
    body.sharePort = sharesPort(form, form.port.value);
  }
  const project = await api('POST', '/projects', body);
  toast(t('toast.added', { name: project.name }));
  if (project.servers[0]) location.hash = `#/s/${encodeURIComponent(project.servers[0].id)}`;
});

$('#project-delete').addEventListener('click', async () => {
  const p = projectEdit;
  $('#dlg-project').close();
  const ok = await confirmDialog(t('remove.projectTitle', { name: p.name }), t('remove.projectText'), t('project.remove'));
  if (!ok) return;
  await api('DELETE', `/projects/${encodeURIComponent(p.id)}`).catch((err) => toast(err.message, 'error'));
});

let serverEdit = null;
let serverProject = null;

function openServerDialog(id, projectId = null) {
  const form = $('#form-server');
  form.reset();
  formError(form, '');
  delete form.dataset.sharePort;
  const found = id ? findServer(id) : null;
  serverEdit = found?.server || null;
  serverProject = found?.project || state.status.projects.find((p) => p.id === projectId);
  $('#dlg-server-title').textContent = serverEdit ? t('dlg.editServer', { name: serverEdit.name }) : t('dlg.addServer', { name: serverProject.name });
  $('#server-delete').hidden = !serverEdit;
  const s = serverEdit || { name: serverProject.servers.length ? '' : 'dev', command: '', port: null, cwd: '', env: {}, autostart: false, maxRestartAttempts: 5, health: { type: 'tcp', path: '/' } };
  form.name.value = s.name;
  form.command.value = s.command;
  form.port.value = s.port ?? '';
  form.cwd.value = s.cwd;
  form.healthType.value = s.health.type;
  form.healthPath.value = s.health.path;
  form.maxRestartAttempts.value = s.maxRestartAttempts;
  form.env.value = Object.entries(s.env).map(([k, v]) => `${k}=${v}`).join('\n');
  form.autostart.checked = s.autostart;
  syncHealthPath();
  $('#dlg-server').showModal();
}

/** The path only matters for an HTTP check. */
function syncHealthPath() {
  const form = $('#form-server');
  form.healthPath.disabled = form.healthType.value !== 'http';
}
$('#form-server').healthType.addEventListener('change', syncHealthPath);

handleSubmit($('#form-server'), async () => {
  const form = $('#form-server');
  const env = {};
  for (const line of form.env.value.split('\n')) {
    const i = line.indexOf('=');
    if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const body = {
    name: form.name.value.trim(),
    command: form.command.value.trim(),
    port: form.port.value ? Number(form.port.value) : null,
    cwd: form.cwd.value.trim(),
    env,
    autostart: form.autostart.checked,
    maxRestartAttempts: Number(form.maxRestartAttempts.value || 5),
    health: { type: form.healthType.value, path: form.healthPath.value.trim() || '/' },
    sharePort: sharesPort(form, form.port.value),
  };
  if (serverEdit) {
    await api('PATCH', `/servers/${encodeURIComponent(serverEdit.id)}`, body);
    toast(ACTIVE.has(serverEdit.state) ? t('toast.savedRestart') : t('toast.savedPlain'));
  } else {
    const view = await api('POST', `/projects/${encodeURIComponent(serverProject.id)}/servers`, body);
    location.hash = `#/s/${encodeURIComponent(view.id)}`;
  }
});

$('#server-delete').addEventListener('click', async () => {
  const s = serverEdit;
  $('#dlg-server').close();
  const ok = await confirmDialog(t('remove.serverTitle', { name: s.name }), t('remove.serverText'), t('server.remove'));
  if (!ok) return;
  await api('DELETE', `/servers/${encodeURIComponent(s.id)}`).catch((err) => toast(err.message, 'error'));
});

// ------------------------------------------------------------- live updates

function connect() {
  const es = new EventSource('/api/events');
  es.addEventListener('status', (e) => {
    state.status = JSON.parse(e.data);
    $('#app-version').textContent = t('side.version', { version: state.status.version });
    $('#offline').hidden = true;
    if (state.offline) {
      state.offline = false;
      state.logsFor = null; // reload output we may have missed
    }
    if (state.status.language !== langSetting || !$('#toc').children.length) setLanguage(state.status.language || 'auto');
    applyRoute();
  });
  es.addEventListener('server', (e) => {
    const view = JSON.parse(e.data);
    upsertServer(view);
    if (state.conflict?.serverId === view.id && ACTIVE.has(view.state)) state.conflict = null;
    render();
  });
  es.addEventListener('log', (e) => {
    const { id, text } = JSON.parse(e.data);
    if (id === state.logsFor) term.write(text);
  });
  es.onerror = () => {
    state.offline = true;
    $('#offline').hidden = false;
  };
}

setInterval(() => {
  for (const el of document.querySelectorAll('[data-uptime]')) {
    if (el.dataset.uptime) el.textContent = uptime(el.dataset.uptime);
  }
}, 1000);

applyStaticTexts();
renderManual();
window.addEventListener('hashchange', applyRoute);
connect();
