// Rasterize the Vigie icon (same geometry as ui/icon.svg) into PNGs for Electron and the installer.
// Pure Node: shapes are drawn as signed-distance fields with 4x4 supersampling, then PNG-encoded.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'desktop', 'icons');

// Geometry in the 64x64 design space.
const segments = [
  [14, 46, 50, 46],
  [20, 46, 20, 42],
  [32, 46, 32, 35],
  [44, 46, 44, 42],
];

function roundedRect(x, y, r = 15) {
  const dx = Math.max(Math.abs(x - 32) - (32 - r), 0);
  const dy = Math.max(Math.abs(y - 32) - (32 - r), 0);
  return Math.hypot(dx, dy) <= r;
}

function segDist(x, y, [x1, y1, x2, y2]) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((x - x1) * vx + (y - y1) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(x - (x1 + t * vx), y - (y1 + t * vy));
}

function glyph(x, y) {
  const d = Math.hypot(x - 32, y - 26);
  if (d >= 7 && d <= 11) return true; // lookout ring
  if (d <= 3) return true; // pupil
  return segments.some((s) => segDist(x, y, s) <= 2); // the three ports
}

/** mode: 'color' = full app icon; 'template' = black glyph only (macOS menu bar). */
function render(size, mode) {
  const px = Buffer.alloc(size * size * 4);
  const ss = 4;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let bg = 0;
      let fg = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = ((i + (sx + 0.5) / ss) / size) * 64;
          const y = ((j + (sy + 0.5) / ss) / size) * 64;
          if (mode === 'template') {
            if (glyph(x * 0.82 + 5.8, y * 0.82 + 3)) fg++;
          } else if (roundedRect(x, y)) {
            bg++;
            if (glyph(x, y)) fg++;
          }
        }
      }
      const n = ss * ss;
      const o = (j * size + i) * 4;
      if (mode === 'template') {
        px[o + 3] = Math.round((fg / n) * 255);
        continue;
      }
      // Diagonal gradient #3B9BFF -> #0A60E0, glyph in white.
      const t = (i + j) / (2 * size);
      const base = [0x3b + (0x0a - 0x3b) * t, 0x9b + (0x60 - 0x9b) * t, 0xff + (0xe0 - 0xff) * t];
      const k = bg ? fg / bg : 0;
      for (let c = 0; c < 3; c++) px[o + c] = Math.round(base[c] * (1 - k) + 255 * k);
      px[o + 3] = Math.round((bg / n) * 255);
    }
  }
  return encodePng(size, px);
}

function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(OUT, { recursive: true });
const files = {
  'icon.png': render(512, 'color'),
  'icon-256.png': render(256, 'color'),
  'tray.png': render(32, 'color'),
  'trayTemplate.png': render(22, 'template'),
  'trayTemplate@2x.png': render(44, 'template'),
};
for (const [name, buf] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log(`wrote desktop/icons/${name} (${buf.length} bytes)`);
}
