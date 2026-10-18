// The `vigie` shim: what it runs, and which copy of the app may (re)point it at boot.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { APPIMAGE_LOADER, CLI_DIR, isInstalledCopy, shims, shimTarget, shouldRefreshShim } from '../desktop/cli-tool.js';
import { appImageFile, supervisorCommand } from '../src/paths.js';

const WIN_INSTALLED = 'C:\\Users\\me\\AppData\\Local\\Programs\\Vigie\\Vigie.exe';
const WIN_TEMP_COPY = 'C:\\Users\\me\\AppData\\Local\\Temp\\vigie-pkg-test\\Vigie.exe';
const win = (exe, extra = {}) =>
  isInstalledCopy({ isPackaged: true, exe, platform: 'win32', tmpDir: 'C:\\Users\\me\\AppData\\Local\\Temp', exists: () => true, ...extra });

test('shim target: read back from every shim we write, quotes and percents included', () => {
  const exe = process.platform === 'win32' ? "C:\\Users\\Jo O'Neil\\100% apps\\Vigie\\Vigie.exe" : "/Users/jo o'neil/100% apps/Vigie.app/Contents/MacOS/Vigie";
  const files = Object.entries(shims('/somewhere/app.asar/bin/vigie.js', exe));
  assert.ok(files.length > 0);
  for (const [file, content] of files) {
    // On Windows the sh copy for Git Bash spells the path with forward slashes.
    const expected = process.platform === 'win32' && !file.endsWith('.cmd') ? exe.replace(/\\/g, '/') : exe;
    assert.equal(shimTarget(content), expected, file);
  }
  assert.equal(shimTarget('@echo off\r\nnode C:\\elsewhere\\vigie.js %*\r\n'), null);
});

test('installed copy, Windows: the NSIS folder (any location) has the uninstaller', () => {
  const seen = [];
  assert.equal(win(WIN_INSTALLED, { exists: (f) => (seen.push(f), true) }), true);
  assert.deepEqual(seen, ['C:\\Users\\me\\AppData\\Local\\Programs\\Vigie\\Uninstall Vigie.exe']);
  assert.equal(win('D:\\Tools\\Vigie\\Vigie.exe'), true);
  // dist\win-unpacked, or any copy of it: no uninstaller.
  assert.equal(win('D:\\Code\\vigie\\dist\\win-unpacked\\Vigie.exe', { exists: () => false }), false);
});

test('installed copy, Windows: never a copy in the temp folder, even with an uninstaller next to it', () => {
  assert.equal(win(WIN_TEMP_COPY), false);
  assert.equal(win(WIN_TEMP_COPY.toLowerCase()), false);
});

test('installed copy: never a dev run', () => {
  for (const platform of ['win32', 'darwin', 'linux']) {
    assert.equal(isInstalledCopy({ isPackaged: false, exe: WIN_INSTALLED, platform, appImage: '/opt/Vigie.AppImage', tmpDir: '/tmp', exists: () => true }), false, platform);
  }
});

test('installed copy, macOS: only from an Applications folder', () => {
  const mac = (exe) => isInstalledCopy({ isPackaged: true, exe, platform: 'darwin', home: '/Users/me', tmpDir: '/private/var/folders/xy/abc/T' });
  assert.equal(mac('/Applications/Vigie.app/Contents/MacOS/Vigie'), true);
  assert.equal(mac('/Users/me/Applications/Vigie.app/Contents/MacOS/Vigie'), true);
  assert.equal(mac('/Volumes/Vigie 0.1.0/Vigie.app/Contents/MacOS/Vigie'), false);
  assert.equal(mac('/private/var/folders/xy/abc/T/AppTranslocation/1F2E/d/Vigie.app/Contents/MacOS/Vigie'), false);
  assert.equal(mac('/Users/me/Code/vigie/dist/mac/Vigie.app/Contents/MacOS/Vigie'), false);
});

test('installed copy, Linux: an AppImage outside the temp folder', () => {
  const linux = (appImage) => isInstalledCopy({ isPackaged: true, exe: '/tmp/.mount_VigieX1/vigie', platform: 'linux', appImage, tmpDir: '/tmp' });
  assert.equal(linux('/home/me/Applications/Vigie-0.1.0.AppImage'), true);
  assert.equal(linux('/tmp/Vigie-0.1.0.AppImage'), false);
  assert.equal(linux(undefined), false); // linux-unpacked
});

test('refresh: a temp or unpacked copy never repoints the shim, working or not (the vigie-pkg-test bug)', () => {
  const base = { installed: false, exe: WIN_TEMP_COPY, target: WIN_INSTALLED, platform: 'win32' };
  assert.equal(shouldRefreshShim({ ...base, targetExists: true }), false);
  assert.equal(shouldRefreshShim({ ...base, targetExists: false }), false);
});

test('refresh: the installed copy keeps its own shim current', () => {
  assert.equal(shouldRefreshShim({ installed: true, exe: WIN_INSTALLED, target: WIN_INSTALLED.toUpperCase(), targetExists: true, platform: 'win32' }), true);
  const exe = '/Applications/Vigie.app/Contents/MacOS/Vigie';
  assert.equal(shouldRefreshShim({ installed: true, exe, target: exe, targetExists: true, platform: 'darwin' }), true);
});

test('refresh: the installed copy takes over a shim whose app is gone, not one that works', () => {
  const base = { installed: true, exe: 'D:\\Tools\\Vigie\\Vigie.exe', target: WIN_INSTALLED, platform: 'win32' };
  assert.equal(shouldRefreshShim({ ...base, targetExists: false }), true);
  assert.equal(shouldRefreshShim({ ...base, targetExists: true }), false);
});

test('refresh: a shim we cannot read is left alone', () => {
  assert.equal(shouldRefreshShim({ installed: true, exe: WIN_INSTALLED, target: null, targetExists: false, platform: 'win32' }), false);
});

// ------------------------------------------------------------------ AppImage

// What a Linux AppImage run sees: its binary and app.asar sit in a mount that is new on every launch.
const MOUNT = '/tmp/.mount_VigieX1';
const APPIMAGE = "/home/jo o'neil/Applications/Vigie-0.1.0.AppImage";
const appImageShims = () => shims(`${MOUNT}/resources/app.asar/bin/vigie.js`, `${MOUNT}/vigie`, APPIMAGE);
const sq = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
const tmp = (t, prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const writeExe = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, { mode: 0o755 });
};

test('AppImage: the binary counts as one only from the APPDIR its runtime set', () => {
  const env = { APPIMAGE, APPDIR: MOUNT };
  assert.equal(appImageFile({ env, exe: `${MOUNT}/vigie`, platform: 'linux' }), APPIMAGE);
  // APPIMAGE and APPDIR leak to every child of an AppImage: a binary elsewhere did not come from it.
  assert.equal(appImageFile({ env, exe: '/opt/Vigie/vigie', platform: 'linux' }), null);
  assert.equal(appImageFile({ env, exe: `${MOUNT}-other/vigie`, platform: 'linux' }), null);
  assert.equal(appImageFile({ env: { APPIMAGE }, exe: `${MOUNT}/vigie`, platform: 'linux' }), null);
  assert.equal(appImageFile({ env, exe: `${MOUNT}/vigie`, platform: 'darwin' }), null);
});

test('AppImage shim: runs the AppImage file on the loader, nothing from this run’s mount', () => {
  const files = appImageShims();
  const shimFile = path.join(CLI_DIR, 'vigie');
  assert.deepEqual(Object.keys(files).sort(), [shimFile, APPIMAGE_LOADER].sort());
  const shim = files[shimFile];
  assert.ok(!shim.includes(MOUNT), shim);
  assert.equal(shim.split('\n').at(-2), `ELECTRON_RUN_AS_NODE=1 exec ${sq(APPIMAGE)} ${sq(APPIMAGE_LOADER)} --no-sandbox "$@"`);
  // The missing-app check and the boot refresh both look at the AppImage file.
  assert.ok(shim.includes(`\n[ -e ${sq(APPIMAGE)} ] || {`), shim);
  assert.equal(shimTarget(shim), APPIMAGE);
  assert.ok(!files[APPIMAGE_LOADER].includes(MOUNT));
});

test('AppImage shim: the loader drops the --no-sandbox guard and runs the CLI in the current mount', (t) => {
  const dir = tmp(t, 'vigie-loader-');
  const resources = path.join(dir, 'resources');
  // Stands in for bin/vigie.js: shows what the CLI would get.
  writeExe(path.join(resources, 'app.asar', 'bin', 'vigie.js'), 'console.log(JSON.stringify(process.argv.slice(2)));\n');
  // Electron sets process.resourcesPath in node mode too; plain node needs a hand.
  writeExe(path.join(dir, 'electron.cjs'), `process.resourcesPath = ${JSON.stringify(resources)};\n`);
  writeExe(path.join(dir, 'loader.mjs'), appImageShims()[APPIMAGE_LOADER]);
  const run = (...args) => JSON.parse(execFileSync(process.execPath, ['--require', path.join(dir, 'electron.cjs'), path.join(dir, 'loader.mjs'), ...args], { encoding: 'utf8' }));
  assert.deepEqual(run('--no-sandbox', 'status', '--json'), ['status', '--json']);
  assert.deepEqual(run('--no-sandbox', 'start', '--no-sandbox'), ['start', '--no-sandbox']);
});

test('AppImage shim, end to end through the AppRun that electron-builder writes', { skip: process.platform === 'win32' && 'needs a POSIX sh and bash' }, async (t) => {
  let generateAppRunScript;
  try {
    ({ generateAppRunScript } = await import('app-builder-lib/out/targets/appimage/appImageUtil.js'));
  } catch {
    return t.skip('electron-builder is not installed');
  }
  const dir = tmp(t, 'vigie-appimage-');
  const mount = path.join(dir, 'mount');
  writeExe(path.join(mount, 'AppRun'), generateAppRunScript({ ExecutableName: 'vigie', ProductName: 'Vigie', ProductFilename: 'Vigie', DesktopFileName: 'vigie.desktop', ResourceName: 'appimagekit-vigie' }));
  // AppRun puts its folder first on the PATH: this unshare is the restricted user namespaces case (Ubuntu 24.04),
  // where AppRun adds --no-sandbox in front of the arguments.
  writeExe(path.join(mount, 'unshare'), '#!/bin/sh\nexit 1\n');
  // Electron in node mode: options before the script go to node, which rejects the ones it does not know.
  const preload = path.join(dir, 'electron.cjs');
  writeExe(preload, `process.resourcesPath = ${JSON.stringify(path.join(mount, 'resources'))};\n`);
  writeExe(
    path.join(mount, 'vigie'),
    `#!/bin/sh\n[ "$ELECTRON_RUN_AS_NODE" = 1 ] || { echo "not in node mode" >&2; exit 2; }\ncase "$1" in --*) echo "$0: bad option: $1" >&2; exit 9;; esac\nexec ${sq(process.execPath)} --require ${sq(preload)} "$@"\n`,
  );
  writeExe(path.join(mount, 'resources', 'app.asar', 'bin', 'vigie.js'), 'console.log(JSON.stringify({ argv: process.argv.slice(2), appDir: process.env.APPDIR }));\n');
  // The AppImage file: its runtime mounts the AppDir, sets APPIMAGE and APPDIR, and runs AppRun with the same arguments.
  const appImage = path.join(dir, 'Vigie.AppImage');
  writeExe(appImage, `#!/bin/sh\nexport APPIMAGE=${sq(appImage)} APPDIR=${sq(mount)}\nexec ${sq(path.join(mount, 'AppRun'))} "$@"\n`);

  const files = shims(path.join(mount, 'resources', 'app.asar', 'bin', 'vigie.js'), path.join(mount, 'vigie'), appImage);
  const shim = path.join(dir, 'bin', 'vigie');
  const loader = path.join(dir, 'bin', 'vigie-appimage.mjs');
  writeExe(shim, files[path.join(CLI_DIR, 'vigie')].replace(sq(APPIMAGE_LOADER), sq(loader)));
  writeExe(loader, files[APPIMAGE_LOADER]);
  const out = JSON.parse(execFileSync(shim, ['status', '--json'], { encoding: 'utf8' }));
  assert.deepEqual(out, { argv: ['status', '--json'], appDir: mount });

  // Without the guard, AppRun's --no-sandbox lands before the script and node mode refuses to start.
  const unguarded = (() => {
    try {
      execFileSync(appImage, [loader, 'status'], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: 'pipe' });
      return 'it started';
    } catch (err) {
      return err.stderr.toString();
    }
  })();
  assert.match(unguarded, /bad option: --no-sandbox/);
});

test('AppImage refresh: the shim follows the AppImage file, not a mount', () => {
  const exe = APPIMAGE;
  const target = shimTarget(appImageShims()[path.join(CLI_DIR, 'vigie')]);
  assert.equal(shouldRefreshShim({ installed: true, exe, target, targetExists: true, platform: 'linux' }), true);
  // A shim from before this fix points into a mount that is gone: the installed AppImage takes it over.
  assert.equal(shouldRefreshShim({ installed: true, exe, target: '/tmp/.mount_VigieOld/vigie', targetExists: false, platform: 'linux' }), true);
  assert.equal(shouldRefreshShim({ installed: true, exe, target: '/opt/Other/Vigie.AppImage', targetExists: true, platform: 'linux' }), false);
});

test('CLI starting the app: from an AppImage, the AppImage file, never a binary in the mount', () => {
  const env = { APPIMAGE, APPDIR: MOUNT, ELECTRON_RUN_AS_NODE: '1', PATH: '/usr/bin' };
  const cmd = supervisorCommand({ viaApp: true, exe: `${MOUNT}/vigie`, env, packageRoot: `${MOUNT}/resources/app.asar`, appImage: APPIMAGE });
  assert.deepEqual(cmd, { file: APPIMAGE, args: ['--hidden'], env: { APPIMAGE, APPDIR: MOUNT, PATH: '/usr/bin' }, app: true });
  // Elsewhere (Windows, macOS, linux-unpacked), the binary is where it stays.
  const installed = supervisorCommand({ viaApp: true, exe: '/opt/Vigie/vigie', env: {}, packageRoot: '/opt/Vigie/resources/app.asar', appImage: null });
  assert.deepEqual([installed.file, installed.args], ['/opt/Vigie/vigie', ['--hidden']]);
  const unpacked = supervisorCommand({ viaApp: true, exe: '/repo/node_modules/electron/dist/electron', env: {}, packageRoot: '/repo', appImage: null });
  assert.deepEqual([unpacked.file, unpacked.args], ['/repo/node_modules/electron/dist/electron', ['/repo', '--hidden']]);
});
