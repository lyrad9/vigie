// A stand-in dev server for demos and screenshots: prints output that looks like a real
// framework's dev server, listens on PORT, and logs a request every couple of seconds.
//   node scripts/fake-dev-server.js --kind next|vite|api
import http from 'node:http';

const kind = process.argv[process.argv.indexOf('--kind') + 1] || 'next';
const port = Number(process.env.PORT) || 3000;
const c = (code, s) => `\x1b[${code}m${s}\x1b[0m`;
const ROUTES = {
  next: ['/', '/pricing', '/dashboard', '/api/session', '/blog/launch', '/_next/static/chunks/app.js'],
  vite: ['/', '/src/main.tsx', '/src/App.tsx', '/@vite/client', '/src/styles.css'],
  api: ['/health', '/v1/orders', '/v1/orders/1842', '/v1/customers', '/v1/auth/refresh'],
};
const BANNER = {
  next: [`  ${c(1, '▲ Next.js 16.4.2')} (Turbopack)`, `  - Local:        ${c(36, `http://localhost:${port}`)}`, `  - Environments: .env.local`, '', ` ${c(32, '✓')} Ready in 1184ms`],
  vite: ['', `  ${c('1;32', 'VITE v8.1.3')}  ready in ${c(1, '412')} ms`, '', `  ${c(32, '➜')}  ${c(1, 'Local:')}   ${c(36, `http://localhost:${port}/`)}`, `  ${c(32, '➜')}  ${c(2, 'Network: use --host to expose')}`],
  api: [`${c(36, '[api]')} loading config from .env`, `${c(36, '[api]')} connected to postgres ${c(2, '(pool 10)')}`, `${c(36, '[api]')} listening on ${c(1, `http://localhost:${port}`)}`],
};

for (const line of BANNER[kind] || BANNER.next) console.log(line);

http.createServer((req, res) => res.end('ok\n')).listen(port);

let i = 0;
setInterval(() => {
  const routes = ROUTES[kind] || ROUTES.next;
  const route = routes[i++ % routes.length];
  const ms = 4 + ((i * 37) % 120);
  const method = kind === 'api' && i % 4 === 0 ? 'POST' : 'GET';
  const status = route.includes('refresh') || route.includes('session') ? 401 : 200;
  const time = new Date().toLocaleTimeString('en-GB');
  if (kind === 'vite') console.log(`${c(2, time)} ${c(36, '[vite]')} ${c(32, 'hmr update')} ${c(2, route)}`);
  else console.log(` ${c(1, method)} ${route} ${status === 200 ? c(32, status) : c(33, status)} ${c(2, `in ${ms}ms`)}`);
}, 1800);
