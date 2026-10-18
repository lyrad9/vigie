// Minimal ANSI terminal renderer: SGR colors and styles, \r overwrite, clickable URLs.

const PALETTE = [
  '#5c5c63', '#ff6b63', '#3fd65a', '#f5c542', '#4aa3ff', '#d17cf2', '#5ac8fa', '#dcdce0',
  '#8e8e96', '#ff8a83', '#68e57f', '#ffd966', '#74b9ff', '#e19cf7', '#83dbff', '#ffffff',
];
const MAX_LINES = 5000;
const URL_RE = /(https?:\/\/[^\s"'<>`]+[^\s"'<>`.,;:!?)\]])/g;
const TOKEN_RE = /\x1b\[([0-9;?]*)[ -/]*([@-~])|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-_]|\r\n|\r|\n/g;
const PARTIAL_RE = /\x1b(?:\[[0-9;?]*[ -/]*|\][^\x07\x1b]*)?$/;

function color256(n) {
  if (n < 16) return PALETTE[n];
  if (n < 232) {
    n -= 16;
    const v = (c) => (c ? 55 + c * 40 : 0);
    return `rgb(${v(Math.floor(n / 36))},${v(Math.floor(n / 6) % 6)},${v(n % 6)})`;
  }
  const g = 8 + (n - 232) * 10;
  return `rgb(${g},${g},${g})`;
}

export class AnsiTerminal {
  constructor(pre) {
    this.pre = pre;
    this.queue = [];
    this.frame = 0;
    this.onWrite = null;
    this.reset();
  }

  reset() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.queue = [];
    this.pre.textContent = '';
    this.style = {};
    this.pending = '';
    this.cr = false;
    this.hasText = false;
    this.newLine();
  }

  /** Batch writes into one DOM update per frame. */
  write(text) {
    if (!text) return;
    this.queue.push(text);
    if (!this.frame) this.frame = requestAnimationFrame(() => this.flush());
  }

  flush() {
    this.frame = 0;
    let text = this.pending + this.queue.join('');
    this.queue = [];
    this.pending = '';
    const partial = text.match(PARTIAL_RE);
    if (partial) {
      this.pending = partial[0];
      text = text.slice(0, partial.index);
    }
    TOKEN_RE.lastIndex = 0;
    let last = 0;
    let m;
    while ((m = TOKEN_RE.exec(text))) {
      this.text(text.slice(last, m.index));
      last = TOKEN_RE.lastIndex;
      const t = m[0];
      if (t === '\n' || t === '\r\n') {
        this.cr = false;
        this.newLine();
      } else if (t === '\r') {
        this.cr = true;
      } else if (m[2] === 'm') {
        this.sgr(m[1]);
      }
      // Cursor movement and other control sequences are ignored.
    }
    this.text(text.slice(last));
    while (this.pre.childElementCount > MAX_LINES) this.pre.firstElementChild.remove();
    this.onWrite?.();
  }

  newLine() {
    this.line = document.createElement('div');
    this.line.className = 'ln';
    this.pre.appendChild(this.line);
  }

  text(s) {
    if (!s) return;
    if (this.cr) {
      // A bare \r means the program is redrawing the line (spinners, progress bars).
      this.line.textContent = '';
      this.cr = false;
    }
    this.hasText = true;
    const css = this.css();
    let target = this.line;
    if (css) {
      target = this.line.appendChild(document.createElement('span'));
      target.style.cssText = css;
    }
    let last = 0;
    for (const m of s.matchAll(URL_RE)) {
      if (m.index > last) target.append(s.slice(last, m.index));
      const a = document.createElement('a');
      a.href = m[0];
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.textContent = m[0];
      target.append(a);
      last = m.index + m[0].length;
    }
    if (last < s.length) target.append(s.slice(last));
  }

  css() {
    const s = this.style;
    let out = '';
    let fg = s.fg;
    let bg = s.bg;
    if (s.inverse) [fg, bg] = [bg || '#0e0e10', fg || '#dcdce0'];
    if (fg) out += `color:${fg};`;
    if (bg) out += `background:${bg};`;
    if (s.bold) out += 'font-weight:700;';
    if (s.dim) out += 'opacity:.6;';
    if (s.italic) out += 'font-style:italic;';
    if (s.underline) out += 'text-decoration:underline;';
    return out;
  }

  sgr(params) {
    const codes = params === '' ? [0] : params.split(';').map((x) => Number(x) || 0);
    const s = this.style;
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (c === 0) for (const k of Object.keys(s)) delete s[k];
      else if (c === 1) s.bold = true;
      else if (c === 2) s.dim = true;
      else if (c === 3) s.italic = true;
      else if (c === 4) s.underline = true;
      else if (c === 7) s.inverse = true;
      else if (c === 22) s.bold = s.dim = false;
      else if (c === 23) s.italic = false;
      else if (c === 24) s.underline = false;
      else if (c === 27) s.inverse = false;
      else if (c >= 30 && c <= 37) s.fg = PALETTE[c - 30];
      else if (c === 39) s.fg = null;
      else if (c >= 40 && c <= 47) s.bg = PALETTE[c - 40];
      else if (c === 49) s.bg = null;
      else if (c >= 90 && c <= 97) s.fg = PALETTE[c - 90 + 8];
      else if (c >= 100 && c <= 107) s.bg = PALETTE[c - 100 + 8];
      else if (c === 38 || c === 48) {
        let value = null;
        if (codes[i + 1] === 5) {
          value = color256(codes[i + 2] ?? 0);
          i += 2;
        } else if (codes[i + 1] === 2) {
          value = `rgb(${codes[i + 2] ?? 0},${codes[i + 3] ?? 0},${codes[i + 4] ?? 0})`;
          i += 4;
        }
        if (c === 38) s.fg = value;
        else s.bg = value;
      }
    }
  }
}
