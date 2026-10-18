import net from 'node:net';

const HOSTS = ['127.0.0.1', '::1'];

export function tcpProbe(port, host, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

async function httpProbe(port, health, timeoutMs) {
  for (const host of HOSTS) {
    const url = `http://${host.includes(':') ? `[${host}]` : host}:${port}${health.path}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'manual' });
      await res.body?.cancel();
      return health.expectedStatus ? res.status === health.expectedStatus : res.status < 500;
    } catch {
      // Dev servers often bind only one of IPv4/IPv6; try the other.
    }
  }
  return false;
}

/** Returns true/false, or null when the server has no health check. */
export async function checkHealth(server) {
  const { health, port } = server;
  if (!port || health.type === 'none') return null;
  const timeoutMs = health.timeoutSeconds * 1000;
  if (health.type === 'http') return httpProbe(port, health, timeoutMs);
  for (const host of HOSTS) if (await tcpProbe(port, host, timeoutMs)) return true;
  return false;
}
