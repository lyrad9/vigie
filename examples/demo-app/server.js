// A tiny dev server to try Vigie: colored output, a request log, and an optional crash.
const http = require('node:http');

const port = Number(process.env.PORT) || 4100;
const crash = process.argv.includes('--crash');

console.log('\x1b[36m▲ demo-app\x1b[0m booting…');
setTimeout(() => {
  http.createServer((req, res) => res.end('hello from demo-app\n')).listen(port, () => {
    console.log(`\x1b[32m✓\x1b[0m ready on \x1b[1mhttp://localhost:${port}/\x1b[0m`);
    console.log(`  \x1b[2msupervised: VIGIE=${process.env.VIGIE} server=${process.env.VIGIE_SERVER}\x1b[0m`);
  });
}, 800);
setInterval(() => console.log(`\x1b[90m${new Date().toLocaleTimeString()}\x1b[0m GET / \x1b[32m200\x1b[0m`), 3000);
if (crash) {
  setTimeout(() => {
    console.error('\x1b[31mboom: simulated crash\x1b[0m');
    process.exit(3);
  }, 2500);
}
