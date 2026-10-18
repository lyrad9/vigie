// Run a throwaway daemon for UI work: its own config folder and port, so it never
// touches the real ~/.config/vigie or an installed Vigie app on 7744.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.VIGIE_HOME ??= path.join(root, '.dev-home');
process.env.VIGIE_PORT ??= '7755';
process.argv = [process.argv[0], path.join(root, 'bin', 'vigie.js'), 'daemon'];
await import('../bin/vigie.js');
