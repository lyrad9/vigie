import fs from 'node:fs';
import path from 'node:path';

/**
 * In-memory scrollback plus a rotating file per server, so logs outlive the
 * daemon and the terminal that started the server.
 */
export class LogBuffer {
  constructor(file, { maxMemory = 512 * 1024, maxFile = 5 * 1024 * 1024 } = {}) {
    this.file = file;
    this.maxMemory = maxMemory;
    this.maxFile = maxFile;
    this.chunks = [];
    this.size = 0;
    this.fd = null;
    this.fileSize = 0;
  }

  append(text) {
    if (!text) return;
    this.chunks.push(text);
    this.size += text.length;
    while (this.size > this.maxMemory && this.chunks.length > 1) this.size -= this.chunks.shift().length;
    if (this.size > this.maxMemory) {
      this.chunks[0] = this.chunks[0].slice(-this.maxMemory);
      this.size = this.chunks[0].length;
    }
    this.writeFile(text);
  }

  writeFile(text) {
    try {
      if (this.fd === null) {
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        this.fd = fs.openSync(this.file, 'a');
        this.fileSize = fs.fstatSync(this.fd).size;
      }
      const buf = Buffer.from(text, 'utf8');
      fs.writeSync(this.fd, buf);
      this.fileSize += buf.length;
      if (this.fileSize > this.maxFile) this.rotate();
    } catch {
      // Disk logging is best effort; memory scrollback still works.
    }
  }

  rotate() {
    this.close();
    fs.rmSync(`${this.file}.1`, { force: true });
    fs.renameSync(this.file, `${this.file}.1`);
  }

  /** Last `maxChars` of output; falls back to the log file when memory is empty (e.g. after a daemon restart). */
  tail(maxChars = 200_000) {
    if (this.chunks.length) return this.chunks.join('').slice(-maxChars);
    try {
      const stat = fs.statSync(this.file);
      const len = Math.min(stat.size, maxChars * 2);
      const fd = fs.openSync(this.file, 'r');
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, stat.size - len);
      fs.closeSync(fd);
      return buf.toString('utf8').slice(-maxChars);
    } catch {
      return '';
    }
  }

  clear() {
    this.chunks = [];
    this.size = 0;
  }

  close() {
    if (this.fd !== null) {
      try {
        fs.closeSync(this.fd);
      } catch {
        /* ignore */
      }
      this.fd = null;
    }
  }
}

export function lastLines(text, n) {
  if (!n) return text;
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines.slice(-n).join('\n') + '\n';
}
