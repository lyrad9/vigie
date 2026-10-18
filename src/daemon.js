import fs from 'node:fs';
import { createApi } from './api.js';
import { loadConfig, normalizeConfig } from './config.js';
import { CONFIG_FILE, DAEMON_LOG, DEFAULT_API_PORT, HOME, VERSION } from './paths.js';
import { Supervisor } from './supervisor.js';

function log(message) {
  const line = `${new Date().toISOString()} ${message}\n`;
  if (process.stdout.isTTY) process.stdout.write(line);
  try {
    fs.appendFileSync(DAEMON_LOG, line);
  } catch {
    /* ignore */
  }
}

/**
 * Run the supervisor and its API in this process.
 * The desktop app passes `onExit` so a shutdown quits the app instead of calling process.exit,
 * and `handleSignals: false` because Electron manages its own lifecycle.
 */
export async function runDaemon({ onExit = () => process.exit(0), handleSignals = true } = {}) {
  fs.mkdirSync(HOME, { recursive: true });
  const loaded = loadConfig();
  const port = Number(process.env.VIGIE_PORT) || loaded.config.apiPort || DEFAULT_API_PORT;
  const sup = new Supervisor(loaded, { apiPort: port });

  let stopping = null;
  const shutdown = (reason) => {
    if (!stopping) {
      log(`shutting down (${reason}); stopping managed servers`);
      stopping = sup.shutdown().then(() => server.close());
    }
    return stopping;
  };

  const server = createApi(sup, { port, onShutdown: () => shutdown('api').then(onExit) });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    // Loopback only: the API can spawn processes, so it never binds to the network.
    server.listen(port, '127.0.0.1', resolve);
  }).catch((err) => {
    if (err.code === 'EADDRINUSE') {
      throw new Error(`port ${port} is already in use; is another Vigie daemon running? (vigie status)`);
    }
    throw err;
  });

  watchConfig(sup);
  if (handleSignals) for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => shutdown(sig).then(onExit));

  log(`vigie ${VERSION} listening on http://127.0.0.1:${port} (pid ${process.pid})`);
  const failures = await sup.boot();
  for (const f of failures) log(`autostart: ${f}`);
  return { port, supervisor: sup, shutdown: () => shutdown('app') };
}

function watchConfig(sup) {
  let timer = null;
  const reload = () => {
    let text;
    try {
      text = fs.readFileSync(CONFIG_FILE, 'utf8');
    } catch {
      return;
    }
    if (text === sup.configText) return;
    try {
      const config = normalizeConfig(JSON.parse(text));
      sup.reconcile(config, text);
      log('config.json changed; reloaded');
    } catch (err) {
      log(`config.json ignored: ${err.message}`);
    }
  };
  try {
    fs.watch(HOME, (_event, filename) => {
      if (filename && filename !== 'config.json') return;
      clearTimeout(timer);
      timer = setTimeout(reload, 250);
    });
  } catch (err) {
    log(`config watching unavailable: ${err.message}`);
  }
}
