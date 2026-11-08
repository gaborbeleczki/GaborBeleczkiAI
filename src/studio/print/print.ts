// A small print layout engine: chapters are lists of blocks, typeset onto A4 pages (canvas).
// The dossiers and the notebook in the studio show these pages; links on a page are regions
// the 3D view can hit-test through the page's UV coordinates.

import { drawFigure } from '../screen/figure-canvas.ts';
import { MONO, SANS, rr, setTracking } from '../screen/kit.ts';
import type { Figure } from '../../shared/figures.ts';

/** The words of a chapter, in order, for screen readers (the pages themselves are pictures). */
export function blocksToHtml(blocks: Block[]): string {
  const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!).replace(/\*\*/g, '');
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.t) {
      case 'title':
        if (b.text) out.push(`<h2>${esc(b.text)}</h2>`);
        break;
      case 'h2':
        out.push(`<h3>${esc(b.text)}</h3>`);
        break;
      case 'eyebrow':
      case 'lead':
      case 'p':
        out.push(`<p>${esc(b.text)}</p>`);
        break;
      case 'kpis':
        out.push(`<ul>${b.items.map((i) => `<li>${esc(i.value)}: ${esc(i.label)}</li>`).join('')}</ul>`);
        break;
      case 'steps':
        out.push(`<ol>${b.items.map((i) => `<li>${esc(i.title)}. ${esc(i.text)}</li>`).join('')}</ol>`);
        break;
      case 'bullets':
      case 'tags':
        out.push(`<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`);
        break;
      case 'figure':
        out.push(`<p>${esc(b.caption)}</p>`);
        break;
      case 'portrait':
        out.push(`<p>${esc(b.name)}. ${b.lines.map(esc).join('. ')}</p>`);
        break;
      case 'links':
        out.push(`<ul>${b.items.map((i) => `<li><a href="${esc(i.href)}">${esc(i.label)}: ${esc(i.value)}</a></li>`).join('')}</ul>`);
        break;
      case 'qa':
        out.push(`<h3>${esc(b.q)}</h3><p>${esc(b.a)}</p>`);
        break;
      case 'entry':
        out.push(`<h3>${esc(b.years)} · ${esc(b.title)}, ${esc(b.org)}</h3><p>${esc(b.text)}</p>${b.notes.map((n) => `<p>${esc(n.h)}. ${esc(n.t)}</p>`).join('')}`);
        break;
    }
  }
  return out.join('');
}

/** Page size in canvas pixels (A4 proportions). */
export const PW = 1100;
export const PH = 1556;

export interface Link {
  x: number;
  y: number;
  w: number;
  h: number;
  href: string;
  label: string;
}

export interface Theme {
  paper: string;
  ink: string;
  ink2: string;
  muted: string;
  rule: string;
  accent: string;
  /** dotted grid (notebook) instead of plain paper */
  dots?: boolean;
  /** running head, left and right */
  head: [string, string];
  font: string;
}

export type Block =
  | { t: 'eyebrow'; text: string; toc?: string; breakBefore?: boolean }
  | { t: 'title'; text: string; size?: number; toc?: string; breakBefore?: boolean }
  | { t: 'h2'; text: string; toc?: string; breakBefore?: boolean }
  | { t: 'lead'; text: string }
  | { t: 'p'; text: string; muted?: boolean }
  | { t: 'kpis'; items: { value: string; label: string }[] }
  | { t: 'steps'; items: { n: string; title: string; text: string }[] }
  | { t: 'bullets'; items: string[] }
  | { t: 'tags'; items: string[] }
  | { t: 'figure'; fig: Figure; caption: string }
  | { t: 'portrait'; img: HTMLImageElement | null; name: string; lines: string[] }
  | { t: 'links'; items: { label: string; value: string; href: string }[] }
  | { t: 'qa'; q: string; a: string }
  | { t: 'entry'; years: string; title: string; org: string; text: string; notes: { h: string; t: string }[] }
  | { t: 'rule' }
  | { t: 'space'; h: number };

interface Atom {
  h: number;
  gap: number;
  keep?: boolean;
  breakBefore?: boolean;
  toc?: string;
  draw(g: CanvasRenderingContext2D, x: number, y: number, w: number, links: Link[]): void;
}

export interface Page {
  atoms: { atom: Atom; y: number }[];
  links: Link[];
}

export interface Layout {
  pages: Page[];
  toc: { label: string; page: number }[];
  scale: number;
}

const measureCanvas = document.createElement('canvas').getContext('2d')!;

function wrapLines(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (g.measureText(test).width > maxW && line) {
        out.push(line);
        line = w;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

/** Inline **bold** spans: drawn word by word so emphasis survives wrapping. */
function richLines(g: CanvasRenderingContext2D, text: string, maxW: number, size: number, family: string, weight: number): { w: string; b: boolean }[][] {
  const tokens: { w: string; b: boolean }[] = [];
  let bold = false;
  for (const part of text.split(/(\*\*)/)) {
    if (part === '**') {
      bold = !bold;
      continue;
    }
    for (const w of part.split(/\s+/).filter(Boolean)) tokens.push({ w, b: bold });
  }
  const lines: { w: string; b: boolean }[][] = [];
  let line: { w: string; b: boolean }[] = [];
  let width = 0;
  const space = (() => {
    g.font = `${weight} ${size}px ${family}`;
    return g.measureText(' ').width;
  })();
  for (const tk of tokens) {
    g.font = `${tk.b ? 650 : weight} ${size}px ${family}`;
    const tw = g.measureText(tk.w).width;
    if (line.length && width + space + tw > maxW) {
      lines.push(line);
      line = [];
      width = 0;
    }
    width += (line.length ? space : 0) + tw;
    line.push(tk);
  }
  if (line.length) lines.push(line);
  return lines;
}

function drawRich(g: CanvasRenderingContext2D, line: { w: string; b: boolean }[], x: number, y: number, size: number, family: string, weight: number, color: string, boldColor: string): void {
  g.font = `${weight} ${size}px ${family}`;
  const space = g.measureText(' ').width;
  let cx = x;
  for (const tk of line) {
    g.font = `${tk.b ? 650 : weight} ${size}px ${family}`;
    g.fillStyle = tk.b ? boldColor : color;
    g.fillText(tk.w, cx, y);
    cx += g.measureText(tk.w).width + space;
  }
}

/** Typeset blocks into pages. `k` scales the type (1 on desktops, larger on phones). */
export function layout(blocks: Block[], theme: Theme, k = 1): Layout {
  const g = measureCanvas;
  const F = theme.font;
  const mx = Math.round(92 * Math.min(k, 1.2));
  const width = PW - mx * 2;
  const top = 132;
  const bottom = PH - 104;
  const s = (n: number) => Math.round(n * k);
  const atoms: Atom[] = [];

  const textAtoms = (text: string, size: number, weight: number, color: string, lh: number, gap: number, opts: { family?: string; keepFirst?: boolean } = {}) => {
    const family = opts.family ?? F;
    const lines = richLines(g, text, width, size, family, weight);
    lines.forEach((line, i) =>
      atoms.push({
        h: lh,
        gap: i === 0 ? gap : 0,
        draw: (c, x, y) => {
          c.textBaseline = 'top';
          drawRich(c, line, x, y, size, family, weight, color, theme.ink);
        },
      }),
    );
  };

  for (const b of blocks) {
    switch (b.t) {
      case 'eyebrow': {
        const size = s(21);
        atoms.push({
          h: size * 1.5,
          gap: s(10),
          keep: true,
          toc: b.toc,
          breakBefore: b.breakBefore,
          draw: (c, x, y) => {
            c.font = `600 ${size}px ${MONO}`;
            setTracking(c, size * 0.08);
            c.fillStyle = theme.accent;
            c.textBaseline = 'top';
            c.fillText(b.text.toUpperCase(), x, y);
            setTracking(c, 0);
          },
        });
        break;
      }
      case 'title':
      case 'h2': {
        const size = b.t === 'title' ? s(b.size ?? 64) : s(40);
        g.font = `700 ${size}px ${F}`;
        setTracking(g, -size * 0.03);
        const lines = wrapLines(g, b.text, width);
        setTracking(g, 0);
        const lh = size * 1.08;
        atoms.push({
          h: lines.length * lh,
          gap: b.t === 'title' ? s(18) : s(34),
          keep: true,
          breakBefore: b.breakBefore,
          toc: b.toc,
          draw: (c, x, y) => {
            c.font = `700 ${size}px ${F}`;
            setTracking(c, -size * 0.03);
            c.fillStyle = theme.ink;
            c.textBaseline = 'top';
            lines.forEach((l, i) => c.fillText(l, x, y + i * lh));
            setTracking(c, 0);
          },
        });
        break;
      }
      case 'lead':
        textAtoms(b.text, s(33), 400, theme.ink2, s(33) * 1.36, s(22));
        break;
      case 'p':
        textAtoms(b.text, s(27), 400, b.muted ? theme.muted : theme.ink2, s(27) * 1.5, s(18));
        break;
      case 'kpis': {
        const cols = k > 1.25 ? 1 : 2;
        const colW = (width - (cols - 1) * s(36)) / cols;
        const rows: (typeof b.items)[] = [];
        for (let i = 0; i < b.items.length; i += cols) rows.push(b.items.slice(i, i + cols));
        rows.forEach((row, ri) => {
          g.font = `400 ${s(24)}px ${F}`;
          const labelLines = row.map((it) => wrapLines(g, it.label, colW));
          const h = s(66) + Math.max(...labelLines.map((l) => l.length)) * s(24) * 1.4 + s(18);
          atoms.push({
            h,
            gap: ri === 0 ? s(26) : 0,
            draw: (c, x, y) => {
              row.forEach((it, i) => {
                const cx = x + i * (colW + s(36));
                c.fillStyle = theme.rule;
                c.fillRect(cx, y, colW, 2);
                c.font = `700 ${s(54)}px ${F}`;
                setTracking(c, -s(54) * 0.03);
                c.fillStyle = theme.ink;
                c.textBaseline = 'top';
                c.fillText(it.value, cx, y + s(12));
                setTracking(c, 0);
                c.font = `400 ${s(24)}px ${F}`;
                c.fillStyle = theme.muted;
                labelLines[i].forEach((l, li) => c.fillText(l, cx, y + s(74) + li * s(24) * 1.4));
              });
            },
          });
        });
        break;
      }
      case 'steps': {
        b.items.forEach((it, i) => {
          const numW = s(70);
          g.font = `400 ${s(26)}px ${F}`;
          const lines = wrapLines(g, it.text, width - numW);
          const h = s(34) + lines.length * s(26) * 1.42 + s(10);
          atoms.push({
            h,
            gap: i === 0 ? s(22) : s(6),
            draw: (c, x, y) => {
              c.fillStyle = theme.rule;
              c.fillRect(x, y, width, 2);
              c.font = `600 ${s(22)}px ${MONO}`;
              c.fillStyle = theme.accent;
              c.textBaseline = 'top';
              c.fillText(it.n, x, y + s(16));
              c.font = `650 ${s(30)}px ${F}`;
              c.fillStyle = theme.ink;
              c.fillText(it.title, x + numW, y + s(12));
              c.font = `400 ${s(26)}px ${F}`;
              c.fillStyle = theme.ink2;
              lines.forEach((l, li) => c.fillText(l, x + numW, y + s(50) + li * s(26) * 1.42));
            },
          });
        });
        break;
      }
      case 'bullets': {
        b.items.forEach((it, i) => {
          const lines = richLines(g, it, width - s(34), s(26), F, 400);
          const lh = s(26) * 1.48;
          atoms.push({
            h: lines.length * lh + s(6),
            gap: i === 0 ? s(16) : s(4),
            draw: (c, x, y) => {
              c.fillStyle = theme.accent;
              c.beginPath();
              c.arc(x + s(8), y + s(17), s(4.5), 0, Math.PI * 2);
              c.fill();
              c.textBaseline = 'top';
              lines.forEach((l, li) => drawRich(c, l, x + s(34), y + li * lh, s(26), F, 400, theme.ink2, theme.ink));
            },
          });
        });
        break;
      }
      case 'tags': {
        const size = s(22);
        g.font = `500 ${size}px ${F}`;
        const padX = s(16);
        const hh = size + s(18);
        const rows: { text: string; w: number; x: number }[][] = [[]];
        let cx = 0;
        for (const tg of b.items) {
          const w = g.measureText(tg).width + padX * 2;
          if (cx + w > width && rows[rows.length - 1].length) {
            rows.push([]);
            cx = 0;
          }
          rows[rows.length - 1].push({ text: tg, w, x: cx });
          cx += w + s(12);
        }
        atoms.push({
          h: rows.length * (hh + s(12)),
          gap: s(20),
          draw: (c, x, y) => {
            c.font = `500 ${size}px ${F}`;
            c.textBaseline = 'middle';
            rows.forEach((row, ri) =>
              row.forEach((tg) => {
                const ty = y + ri * (hh + s(12));
                rr(c, x + tg.x, ty, tg.w, hh, hh / 2);
                c.strokeStyle = theme.rule;
                c.lineWidth = 2;
                c.stroke();
                c.fillStyle = theme.ink2;
                c.fillText(tg.text, x + tg.x + padX, ty + hh / 2 + 1);
              }),
            );
            c.textBaseline = 'top';
          },
        });
        break;
      }
      case 'figure': {
        const fh = Math.round(width * (b.fig.h / b.fig.w));
        const capSize = s(21);
        atoms.push({
          h: fh + s(26) + capSize * 1.4,
          gap: s(28),
          draw: (c, x, y) => {
            c.save();
            rr(c, x, y, width, fh, 18);
            c.fillStyle = 'rgba(65,97,128,0.045)';
            c.fill();
            c.restore();
            // the figure's final state, as printed
            drawFigure(c, b.fig, { x: x + 16, y: y + 10, w: width - 32, h: fh - 20 }, 1.0, true, 1.25);
            c.font = `500 ${capSize}px ${F}`;
            c.fillStyle = theme.muted;
            c.textBaseline = 'top';
            c.fillText(b.caption, x, y + fh + s(18));
          },
        });
        break;
      }
      case 'portrait': {
        const ph = s(300);
        atoms.push({
          h: ph,
          gap: s(30),
          draw: (c, x, y) => {
            const pw = Math.round(ph * 0.8);
            c.save();
            rr(c, x, y, pw, ph, 22);
            c.clip();
            if (b.img && b.img.complete && b.img.naturalWidth) {
              const iw = b.img.naturalWidth;
              const ih = b.img.naturalHeight;
              const sc = Math.max(pw / iw, ph / ih);
              c.drawImage(b.img, x + (pw - iw * sc) / 2, y + (ph - ih * sc) / 2, iw * sc, ih * sc);
            } else {
              c.fillStyle = '#D9D3C7';
              c.fillRect(x, y, pw, ph);
            }
            c.restore();
            const tx = x + pw + s(40);
            c.textBaseline = 'top';
            c.font = `700 ${s(52)}px ${F}`;
            setTracking(c, -s(52) * 0.03);
            c.fillStyle = theme.ink;
            const nameLines = wrapLines(c, b.name, width - pw - s(40));
            nameLines.forEach((l, i) => c.fillText(l, tx, y + s(20) + i * s(56)));
            setTracking(c, 0);
            c.font = `400 ${s(25)}px ${F}`;
            c.fillStyle = theme.muted;
            const ty = y + s(30) + nameLines.length * s(56);
            b.lines.forEach((l, i) => c.fillText(l, tx, ty + i * s(36)));
          },
        });
        break;
      }
      case 'links': {
        b.items.forEach((it, i) => {
          const h = s(78);
          atoms.push({
            h,
            gap: i === 0 ? s(22) : 0,
            draw: (c, x, y, w, links) => {
              c.fillStyle = theme.rule;
              c.fillRect(x, y, w, 2);
              c.textBaseline = 'middle';
              c.font = `500 ${s(22)}px ${MONO}`;
              c.fillStyle = theme.muted;
              c.fillText(it.label.toUpperCase(), x, y + h / 2);
              c.font = `600 ${s(28)}px ${F}`;
              c.fillStyle = theme.accent;
              const vx = x + s(200);
              const text = `${it.value}  ↗`;
              c.fillText(text, vx, y + h / 2);
              const tw = c.measureText(text).width;
              c.fillRect(vx, y + h / 2 + s(18), tw - s(30), 2);
              c.textBaseline = 'top';
              links.push({ x: vx - 10, y: y + 6, w: tw + 20, h: h - 12, href: it.href, label: it.value });
            },
          });
        });
        break;
      }
      case 'qa': {
        g.font = `650 ${s(29)}px ${F}`;
        const ql = wrapLines(g, b.q, width);
        const qlh = s(29) * 1.3;
        atoms.push({
          h: s(22) + ql.length * qlh,
          gap: s(22),
          keep: true,
          draw: (c, x, y) => {
            c.fillStyle = theme.rule;
            c.fillRect(x, y, width, 2);
            c.textBaseline = 'top';
            c.font = `650 ${s(29)}px ${F}`;
            c.fillStyle = theme.ink;
            ql.forEach((l, i) => c.fillText(l, x, y + s(22) + i * qlh));
          },
        });
        textAtoms(b.a, s(25), 400, theme.ink2, s(25) * 1.5, s(12));
        break;
      }
      case 'entry': {
        const yearsW = s(150);
        const tw = width - yearsW;
        g.font = `650 ${s(29)}px ${F}`;
        const tl = wrapLines(g, b.title, tw);
        g.font = `400 ${s(24)}px ${F}`;
        const sl = wrapLines(g, b.text, tw);
        const head = s(20) + tl.length * s(29) * 1.25 + s(34) + sl.length * s(24) * 1.45 + s(8);
        atoms.push({
          h: head,
          gap: s(20),
          keep: b.notes.length > 0,
          draw: (c, x, y) => {
            c.fillStyle = theme.rule;
            c.fillRect(x, y, width, 2);
            c.textBaseline = 'top';
            c.font = `600 ${s(22)}px ${MONO}`;
            c.fillStyle = theme.accent;
            c.fillText(b.years, x, y + s(24));
            c.font = `650 ${s(29)}px ${F}`;
            c.fillStyle = theme.ink;
            tl.forEach((l, i) => c.fillText(l, x + yearsW, y + s(20) + i * s(29) * 1.25));
            const oy = y + s(20) + tl.length * s(29) * 1.25 + s(4);
            c.font = `500 ${s(23)}px ${F}`;
            c.fillStyle = theme.muted;
            c.fillText(b.org, x + yearsW, oy);
            c.font = `400 ${s(24)}px ${F}`;
            c.fillStyle = theme.ink2;
            sl.forEach((l, i) => c.fillText(l, x + yearsW, oy + s(32) + i * s(24) * 1.45));
          },
        });
        b.notes.forEach((n) => {
          const lines = richLines(g, `**${n.h}.** ${n.t}`, tw - s(26), s(23), F, 400);
          const lh = s(23) * 1.45;
          atoms.push({
            h: lines.length * lh + s(6),
            gap: s(4),
            draw: (c, x, y) => {
              c.fillStyle = theme.accent;
              c.fillRect(x + yearsW, y + s(8), s(3), lines.length * lh - s(8));
              c.textBaseline = 'top';
              lines.forEach((l, li) => drawRich(c, l, x + yearsW + s(22), y + li * lh, s(23), F, 400, theme.ink2, theme.ink));
            },
          });
        });
        break;
      }
      case 'rule':
        atoms.push({ h: 2, gap: s(30), draw: (c, x, y) => ((c.fillStyle = theme.rule), c.fillRect(x, y, width, 2)) });
        break;
      case 'space':
        atoms.push({ h: s(b.h), gap: 0, draw: () => {} });
        break;
    }
  }

  // greedy pagination: headings keep with what follows, long text flows line by line
  const pages: Page[] = [{ atoms: [], links: [] }];
  const toc: { label: string; page: number }[] = [];
  let y = top;
  const fits = (i: number, from: number) => {
    let yy = from;
    let j = i;
    do {
      const a = atoms[j];
      yy += (yy === top ? 0 : a.gap) + a.h;
      if (yy > bottom) return false;
      j++;
    } while (atoms[j - 1]?.keep && j < atoms.length);
    return true;
  };
  atoms.forEach((a, i) => {
    const page = pages[pages.length - 1];
    const fresh = page.atoms.length === 0;
    if ((a.breakBefore && !fresh) || (!fresh && !fits(i, y))) {
      pages.push({ atoms: [], links: [] });
      y = top;
    }
    const cur = pages[pages.length - 1];
    if (cur.atoms.length) y += a.gap;
    cur.atoms.push({ atom: a, y });
    if (a.toc) toc.push({ label: a.toc, page: pages.length });
    y += a.h;
  });
  return { pages, toc, scale: k };
}

let grain: HTMLCanvasElement | null = null;
function paperGrain(): HTMLCanvasElement {
  if (grain) return grain;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const img = g.createImageData(256, 256);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (rnd() - 0.5) * 60;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grain = c;
  return c;
}

function paper(g: CanvasRenderingContext2D, theme: Theme): void {
  g.fillStyle = theme.paper;
  g.fillRect(0, 0, PW, PH);
  g.save();
  g.globalAlpha = 0.035;
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = g.createPattern(paperGrain(), 'repeat')!;
  g.fillRect(0, 0, PW, PH);
  g.restore();
  if (theme.dots) {
    g.fillStyle = 'rgba(42,63,102,0.16)';
    for (let y = 70; y < PH - 40; y += 44) for (let x = 60; x < PW - 40; x += 44) g.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
}

/** Draw page `index` (0-based) of a layout onto a canvas. */
export function renderPage(canvas: HTMLCanvasElement, lay: Layout, index: number, theme: Theme): Link[] {
  canvas.width = PW;
  canvas.height = PH;
  const g = canvas.getContext('2d')!;
  paper(g, theme);
  const k = lay.scale;
  const mx = Math.round(92 * Math.min(k, 1.2));
  const page = lay.pages[index];
  const links: Link[] = [];
  // running head and folio
  g.textBaseline = 'alphabetic';
  g.font = `500 ${Math.round(19 * Math.min(k, 1.3))}px ${MONO}`;
  setTracking(g, 1.5);
  g.fillStyle = theme.muted;
  g.fillText(theme.head[0].toUpperCase(), mx, 78);
  g.textAlign = 'right';
  g.fillText(theme.head[1].toUpperCase(), PW - mx, 78);
  g.fillText(`${index + 1} / ${lay.pages.length}`, PW - mx, PH - 56);
  g.textAlign = 'left';
  g.fillText('GÁBOR BÉLECZKI', mx, PH - 56);
  setTracking(g, 0);
  g.fillStyle = theme.rule;
  g.fillRect(mx, 96, PW - mx * 2, 2);
  if (page) for (const { atom, y } of page.atoms) atom.draw(g, mx, y, PW - mx * 2, links);
  page && (page.links = links);
  return links;
}

/** The inside of a cover: the folio's colour, its number and the contents. */
export function renderEndpaper(canvas: HTMLCanvasElement, opts: { color: string; dark: boolean; n: string; kicker?: string; title: string; toc: { label: string; page: number }[]; back?: boolean }): void {
  canvas.width = PW;
  canvas.height = PH;
  const g = canvas.getContext('2d')!;
  g.fillStyle = opts.color;
  g.fillRect(0, 0, PW, PH);
  g.save();
  g.globalAlpha = 0.06;
  g.globalCompositeOperation = opts.dark ? 'screen' : 'multiply';
  g.fillStyle = g.createPattern(paperGrain(), 'repeat')!;
  g.fillRect(0, 0, PW, PH);
  g.restore();
  const ink = opts.dark ? '#F5F2EC' : '#1D1D1F';
  const soft = opts.dark ? 'rgba(245,242,236,0.66)' : 'rgba(29,29,31,0.6)';
  g.textBaseline = 'top';
  if (opts.back) {
    g.font = `700 120px ${SANS}`;
    setTracking(g, -4);
    g.fillStyle = soft;
    g.textAlign = 'center';
    g.fillText('GB', PW / 2, PH / 2 - 110);
    setTracking(g, 2);
    g.font = `500 22px ${MONO}`;
    g.fillText('GÁBOR BÉLECZKI · BUDAPEST', PW / 2, PH / 2 + 40);
    g.textAlign = 'left';
    setTracking(g, 0);
    return;
  }
  // a pasted label card
  const x = 110;
  const y = 150;
  const w = PW - 220;
  const h = 260 + opts.toc.length * 62;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.12)';
  g.shadowBlur = 18;
  g.shadowOffsetY = 4;
  rr(g, x, y, w, h, 10);
  g.fillStyle = '#FBFAF6';
  g.fill();
  g.restore();
  g.font = `600 24px ${MONO}`;
  setTracking(g, 2);
  g.fillStyle = '#6E6E73';
  g.fillText((opts.kicker ?? `Folio ${opts.n}`).toUpperCase(), x + 56, y + 56);
  setTracking(g, -2);
  g.font = `700 76px ${SANS}`;
  g.fillStyle = '#1D1D1F';
  g.fillText(opts.title, x + 56, y + 96);
  setTracking(g, 0);
  g.fillStyle = 'rgba(29,29,31,0.12)';
  g.fillRect(x + 56, y + 210, w - 112, 2);
  g.font = `400 28px ${SANS}`;
  opts.toc.forEach((t, i) => {
    const ty = y + 236 + i * 62;
    g.fillStyle = '#3D3D41';
    let label = t.label;
    while (g.measureText(label).width > w - 220 && label.length > 4) label = label.slice(0, -2) + '…';
    g.fillText(label, x + 56, ty);
    g.textAlign = 'right';
    g.fillStyle = '#6E6E73';
    g.font = `500 24px ${MONO}`;
    g.fillText(String(t.page), x + w - 56, ty + 4);
    g.font = `400 28px ${SANS}`;
    g.textAlign = 'left';
  });
  g.font = `500 22px ${MONO}`;
  setTracking(g, 1.5);
  g.fillStyle = soft;
  g.fillText('TURN THE PAGE ›', x, PH - 150);
  setTracking(g, 0);
  void ink;
}
