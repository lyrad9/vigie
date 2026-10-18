// The `vigie` shim's boot refresh: which copy of the app may (re)point it.
import assert from 'node:assert/strict';
import test from 'node:test';
import { isInstalledCopy, shims, shimTarget, shouldRefreshShim } from '../desktop/cli-tool.js';

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
