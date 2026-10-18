import { AnsiTerminal } from './ansi.js';

const $ = (sel) => document.querySelector(sel);
const ACTIVE = new Set(['starting', 'running', 'unhealthy', 'restarting']);
const COLORS = ['#0A84FF', '#30D158', '#FF9F0A', '#BF5AF2', '#FF375F', '#64D2FF', '#FFD60A', '#AC8E68'];

const state = {
  status: null,
  ports: null,
  route: { view: 'empty', id: null },
  logsFor: null,
  conflict: null, // { serverId, port, owners }
  offline: false,
};

const term = new AnsiTerminal($('#term'));
term.onWrite = () => {
  if ($('#term-follow').checked) $('#term').scrollTop = $('#term').scrollHeight;
  syncTermEmpty();
};

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
  if (d) return `${d}d ${h}h`;
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
  el.textContent = message;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), kind === 'error' ? 6000 : 3000);
}

function confirmDialog(title, text, okLabel = 'Confirm') {
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

// ------------------------------------------------------------------ routing

function parseRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (hash === 'ports') return { view: 'ports', id: null };
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
  state.route = route;
  if (route.view === 'server' && state.logsFor !== route.id) loadLogs(route.id);
  if (route.view === 'ports') refreshPorts();
  render();
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
  for (const v of ['server', 'ports', 'empty']) $(`#view-${v}`).hidden = state.route.view !== v;
  $('#btn-ports').classList.toggle('active', state.route.view === 'ports');
  if (state.route.view !== 'server') document.title = state.route.view === 'ports' ? 'Ports · Vigie' : 'Vigie';
  if (state.route.view === 'server') renderServer();
  if (state.route.view === 'ports') renderPorts();
}

function renderSidebar() {
  const servers = allServers();
  const running = servers.filter((x) => x.server.state === 'running').length;
  $('#run-count').textContent = servers.length ? `${running}/${servers.length} running` : '';
  $('#projects').innerHTML = state.status.projects
    .map(
      (p) => `
      <section class="project">
        <div class="project-head">
          <span class="mark" style="background:${esc(p.color)}">${esc(p.name[0]?.toUpperCase())}</span>
          <span class="pname" title="${esc(p.root)}">${esc(p.name)}</span>
          <button class="icon-btn" type="button" data-add-server="${esc(p.id)}" title="Add server" aria-label="Add server to ${esc(p.name)}">
            <svg viewBox="0 0 16 16"><path d="M8 3v10M3 8h10"/></svg>
          </button>
          <button class="icon-btn" type="button" data-edit-project="${esc(p.id)}" title="Edit project" aria-label="Edit ${esc(p.name)}">
            <svg viewBox="0 0 16 16"><circle cx="3.5" cy="8" r=".6"/><circle cx="8" cy="8" r=".6"/><circle cx="12.5" cy="8" r=".6"/></svg>
          </button>
        </div>
        ${
          p.servers.length
            ? p.servers
                .map(
                  (s) => `
          <a class="srv${state.route.id === s.id ? ' active' : ''}" href="#/s/${encodeURIComponent(s.id)}" title="${esc(s.command)}">
            <span class="dot ${esc(s.state)}"></span>
            <span class="sname">${esc(s.name)}</span>
            <span class="sup" data-uptime="${esc(ACTIVE.has(s.state) ? s.startedAt || '' : '')}">${ACTIVE.has(s.state) ? uptime(s.startedAt) : ''}</span>
            <span class="surl">${s.port ? `localhost:${s.port}` : 'no port'}</span>
          </a>`,
                )
                .join('')
            : `<div class="no-servers">No servers yet</div>`
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
  $('#srv-crumb').textContent = `${project.name} · ${tildify(project.root)}${s.cwd ? '/' + s.cwd : ''}`;
  document.title = `${s.name} · ${project.name} · Vigie`;

  const toggle = $('#srv-toggle');
  toggle.textContent = s.state === 'stopping' ? 'Stopping…' : active ? 'Stop' : 'Start';
  toggle.disabled = s.state === 'stopping';
  toggle.className = active ? 'btn ghost' : 'btn primary';
  $('#srv-restart').disabled = !active;
  const open = $('#srv-open');
  open.href = s.url || '#';
  open.setAttribute('aria-disabled', String(!(s.url && s.state === 'running')));

  const st = $('#st-state');
  st.className = `pill ${s.state}`;
  st.textContent = s.state;
  $('#st-pid').textContent = s.pid ?? '—';
  $('#st-port').textContent = s.port ?? '—';
  const up = $('#st-uptime');
  up.dataset.uptime = active ? s.startedAt || '' : '';
  up.textContent = active && s.startedAt ? uptime(s.startedAt) : '—';
  $('#st-restarts').textContent = `${s.restartCount} / ${s.maxRestartAttempts}`;
  const kind = s.health.type === 'http' ? `HTTP ${s.health.path}` : s.health.type === 'tcp' ? 'TCP' : 'Off';
  $('#st-health').textContent = s.health.type === 'none' ? 'Off' : s.healthy === true ? `${kind} ✓` : s.healthy === false ? `${kind} ✕` : `${kind} …`;

  const err = $('#srv-error');
  err.hidden = !(s.lastError && ['failed', 'restarting', 'unhealthy'].includes(s.state));
  err.textContent = s.lastError || '';

  $('#srv-command').textContent = s.command;
  $('#term-empty-text').textContent = `Start ${s.name} to see its live terminal output.`;

  const c = state.conflict;
  const showConflict = c && c.serverId === s.id && !active;
  $('#conflict').hidden = !showConflict;
  if (showConflict) {
    const o = c.owners[0];
    $('#conflict-text').textContent = `${o.name} (pid ${o.pid}) is using port ${c.port}.`;
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

function portRow(o) {
  const http = o.kind !== 'system' ? `<a class="btn tiny ghost" href="http://localhost:${o.port}" target="_blank" rel="noreferrer">Open</a>` : '';
  const action =
    o.kind === 'managed'
      ? `<a class="btn tiny ghost" href="#/s/${encodeURIComponent(o.serverId)}">Show</a>`
      : o.kind === 'external'
        ? `<button class="btn tiny danger" type="button" data-kill="${o.pid}" data-name="${esc(o.name)}" data-port="${o.port}">Stop process</button>`
        : '';
  const label = o.kind === 'managed' ? o.serverName.split('/')[1] : o.name;
  const badge = { managed: 'Managed', external: 'External', system: 'Protected' }[o.kind];
  return `
    <div class="prow">
      <span class="pp">:${o.port}</span>
      <div style="min-width:0">
        <div class="pn">${esc(label)} <span class="badge ${o.kind}">${badge}</span></div>
        <div class="pm" title="${esc(o.command)}">${esc(o.name)} · PID ${o.pid}${o.user ? ' · ' + esc(o.user) : ''}${o.kind === 'external' && o.command ? ' · ' + esc(o.command) : ''}</div>
      </div>
      <div class="pa">${http}${action}</div>
    </div>`;
}

function group(mark, title, sub, count, rows) {
  return `
    <div class="pgroup">
      <div class="pgroup-head">${mark}<div style="min-width:0"><div class="t">${esc(title)}</div><div class="s">${esc(sub)}</div></div><span class="n">${count}</span></div>
      ${rows.join('')}
    </div>`;
}

function renderPorts() {
  const r = state.ports;
  if (!r) return;
  const q = $('#ports-search').value.trim().toLowerCase();
  const match = (o) => !q || [o.port, o.name, o.command, o.serverName, o.pid].some((v) => String(v ?? '').toLowerCase().includes(q));
  const ports = r.ports.filter(match);
  const s = r.summary;
  $('#ports-summary').textContent = `${s.listening} listening · ${s.managed} managed · ${s.external} external · ${s.system} system`;

  const html = [];
  for (const p of state.status.projects) {
    const list = ports.filter((o) => o.projectId === p.id);
    if (!list.length) continue;
    const mark = `<span class="mark" style="background:${esc(p.color)}">${esc(p.name[0]?.toUpperCase())}</span>`;
    html.push(group(mark, p.name, tildify(p.root), `${list.length} port${list.length > 1 ? 's' : ''}`, list.map(portRow)));
  }
  const external = ports.filter((o) => o.kind === 'external');
  if (external.length) {
    const mark = `<span class="mark" style="background:var(--orange)">!</span>`;
    html.push(group(mark, 'Started outside Vigie', 'Processes Vigie did not launch. Nothing is stopped unless you ask.', `${external.length} external`, external.map(portRow)));
  }
  const system = ports.filter((o) => o.kind === 'system');
  if (system.length) {
    const mark = `<span class="mark" style="background:var(--faint)">S</span>`;
    const names = new Set(system.map((o) => o.name)).size;
    html.push(group(mark, 'System', 'Protected background services · Read only', `${names} service${names > 1 ? 's' : ''} · ${system.length} ports`, system.map(portRow)));
  }
  $('#ports-groups').innerHTML = html.join('') || `<div class="ports-empty">${q ? 'No port matches your search.' : 'No listening ports.'}</div>`;
  $('#ports-foot').textContent = `${s.registeredProjects} project${s.registeredProjects === 1 ? '' : 's'} registered. Vigie stops a process only when you ask it to.`;
}

async function killProcess(pid, name, port) {
  const ok = await confirmDialog(`Stop ${name}?`, `This ends pid ${pid}${port ? ` (listening on :${port})` : ''} and its child processes. Vigie did not start it.`, 'Stop process');
  if (!ok) return false;
  try {
    await api('POST', `/processes/${pid}/kill`);
    toast(`Stopped ${name} (pid ${pid})`);
    return true;
  } catch (err) {
    toast(err.message, 'error');
    return false;
  }
}

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

$('#btn-ports').addEventListener('click', () => (location.hash = '#/ports'));
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

// Theme: System → Light → Dark. Stored per viewer; "System" follows the OS.
const THEMES = ['system', 'light', 'dark'];
function applyTheme(theme) {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  $('#theme-label').textContent = `Theme: ${theme[0].toUpperCase()}${theme.slice(1)}`;
}
let theme = 'system';
try {
  theme = localStorage.getItem('vigie-theme') || 'system';
} catch {}
applyTheme(theme);
$('#btn-theme').addEventListener('click', () => {
  theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  try {
    localStorage.setItem('vigie-theme', theme);
  } catch {}
  applyTheme(theme);
});
$('#empty-add').addEventListener('click', () => openProjectDialog());

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
      formError(form, err.message);
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  });
}

let projectEdit = null;
let projectColor = COLORS[0];
let nameTouched = false;
let detectTimer = null;

function renderSwatches() {
  $('#swatches').innerHTML = COLORS.map(
    (c) => `<button type="button" class="swatch" role="radio" aria-label="${c}" aria-checked="${c === projectColor}" data-color="${c}" style="background:${c}"></button>`,
  ).join('');
}
$('#swatches').addEventListener('click', (e) => {
  const b = e.target.closest('[data-color]');
  if (!b) return;
  projectColor = b.dataset.color;
  renderSwatches();
});

function openProjectDialog(id = null) {
  const form = $('#form-project');
  form.reset();
  formError(form, '');
  projectEdit = id ? state.status.projects.find((p) => p.id === id) : null;
  nameTouched = Boolean(projectEdit);
  projectColor = projectEdit?.color || COLORS[state.status.projects.length % COLORS.length];
  renderSwatches();
  $('#dlg-project-title').textContent = projectEdit ? 'Edit project' : 'Add project';
  $('#project-submit').textContent = projectEdit ? 'Save' : 'Add project';
  $('#project-delete').hidden = !projectEdit;
  $('#first-server').hidden = Boolean(projectEdit);
  $('#detect-hint').textContent = 'Paste the project path. Vigie reads package.json to fill the rest.';
  if (projectEdit) {
    form.root.value = projectEdit.root;
    form.name.value = projectEdit.name;
  }
  $('#dlg-project').showModal();
}

$('#form-project').name.addEventListener('input', () => (nameTouched = true));
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
    $('#detect-hint').textContent = 'Folder not found.';
    return;
  }
  if (!nameTouched) form.name.value = info.name;
  const g = info.suggestion;
  if (!projectEdit && g) {
    form.serverName.value = g.name;
    form.command.value = g.command;
    form.port.value = g.port ?? '';
  }
  $('#detect-hint').textContent = g
    ? `Detected ${[g.framework, g.packageManager].filter(Boolean).join(' · ') || 'a dev script'}. Check the command and port.`
    : 'No dev script found. Enter the command yourself.';
}

handleSubmit($('#form-project'), async () => {
  const form = $('#form-project');
  const body = { name: form.name.value.trim(), root: form.root.value.trim().replace(/^"|"$/g, ''), color: projectColor };
  if (projectEdit) {
    await api('PATCH', `/projects/${encodeURIComponent(projectEdit.id)}`, body);
    toast(`Saved ${body.name}`);
    return;
  }
  if (form.command.value.trim()) {
    body.servers = [{ name: form.serverName.value.trim() || 'dev', command: form.command.value.trim(), port: form.port.value || null }];
  }
  const project = await api('POST', '/projects', body);
  toast(`Added ${project.name}`);
  if (project.servers[0]) location.hash = `#/s/${encodeURIComponent(project.servers[0].id)}`;
});

$('#project-delete').addEventListener('click', async () => {
  const p = projectEdit;
  $('#dlg-project').close();
  const ok = await confirmDialog(`Remove ${p.name}?`, 'Its servers are stopped and removed from Vigie. Your files are not touched.', 'Remove project');
  if (!ok) return;
  await api('DELETE', `/projects/${encodeURIComponent(p.id)}`).catch((err) => toast(err.message, 'error'));
});

let serverEdit = null;
let serverProject = null;

function openServerDialog(id, projectId = null) {
  const form = $('#form-server');
  form.reset();
  formError(form, '');
  const found = id ? findServer(id) : null;
  serverEdit = found?.server || null;
  serverProject = found?.project || state.status.projects.find((p) => p.id === projectId);
  $('#dlg-server-title').textContent = serverEdit ? `Edit ${serverEdit.name}` : `Add server to ${serverProject.name}`;
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
  $('#dlg-server').showModal();
}

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
  };
  if (serverEdit) {
    await api('PATCH', `/servers/${encodeURIComponent(serverEdit.id)}`, body);
    toast(ACTIVE.has(serverEdit.state) ? 'Saved. Restart the server to apply command changes.' : 'Saved');
  } else {
    const view = await api('POST', `/projects/${encodeURIComponent(serverProject.id)}/servers`, body);
    location.hash = `#/s/${encodeURIComponent(view.id)}`;
  }
});

$('#server-delete').addEventListener('click', async () => {
  const s = serverEdit;
  $('#dlg-server').close();
  const ok = await confirmDialog(`Remove ${s.name}?`, 'The server is stopped and removed from Vigie. Its log file is kept.', 'Remove server');
  if (!ok) return;
  await api('DELETE', `/servers/${encodeURIComponent(s.id)}`).catch((err) => toast(err.message, 'error'));
});

// ------------------------------------------------------------- live updates

function connect() {
  const es = new EventSource('/api/events');
  es.addEventListener('status', (e) => {
    state.status = JSON.parse(e.data);
    $('#offline').hidden = true;
    if (state.offline) {
      state.offline = false;
      state.logsFor = null; // reload output we may have missed
    }
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

window.addEventListener('hashchange', applyRoute);
connect();
