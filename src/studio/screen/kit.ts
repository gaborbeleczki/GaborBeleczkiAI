// A tiny immediate-mode UI kit for the 1600×1000 display canvas.

export const W = 1600;
export const H = 1000;

export const C = {
  bg: '#F6F4EF',
  card: '#FFFFFF',
  ink: '#1D1D1F',
  ink2: '#3D3D41',
  muted: '#6E6E73',
  faint: '#9A9AA0',
  line: 'rgba(29,29,31,0.10)',
  navy: '#1D2D3D',
  fjord: '#416180',
  sky: '#94BCE3',
  ice: '#D6EBFF',
  oak: '#C9A27C',
  sage: '#A9B8A4',
  lingon: '#C8432B',
  sand: '#E9E4DA',
  link: '#2A5D8F',
  bubble: '#2F6FB0',
  bubbleGray: '#E9E6E0',
};

export const SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter Variable", Inter, "Segoe UI", Roboto, sans-serif';
export const MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace';

export const font = (size: number, weight = 400, family = SANS) => `${weight} ${size}px ${family}`;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Region {
  id: string;
  rect: Rect;
  cursor?: string;
  label?: string;
  onClick?: () => void;
}

export class Regions {
  list: Region[] = [];
  clear(): void {
    this.list.length = 0;
  }
  add(r: Region): void {
    this.list.push(r);
  }
  hit(x: number, y: number): Region | null {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const r = this.list[i];
      if (x >= r.rect.x && x <= r.rect.x + r.rect.w && y >= r.rect.y && y <= r.rect.y + r.rect.h) return r;
    }
    return null;
  }
}

export function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rad, y);
  g.arcTo(x + w, y, x + w, y + h, rad);
  g.arcTo(x + w, y + h, x, y + h, rad);
  g.arcTo(x, y + h, x, y, rad);
  g.arcTo(x, y, x + w, y, rad);
  g.closePath();
}

export function card(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 28, fill = C.card, shadow = true): void {
  g.save();
  if (shadow) {
    g.shadowColor = 'rgba(29,45,61,0.10)';
    g.shadowBlur = 30;
    g.shadowOffsetY = 8;
  }
  rr(g, x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
  g.restore();
}

const wrapCache = new Map<string, string[]>();

export function wrap(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const key = g.font + '|' + maxW + '|' + text;
  const hit = wrapCache.get(key);
  if (hit) return hit;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (g.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  if (wrapCache.size > 600) wrapCache.clear();
  wrapCache.set(key, lines);
  return lines;
}

/** Draws wrapped text and returns the height used. */
export function para(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  opts: { size?: number; weight?: number; color?: string; lineH?: number; maxLines?: number; family?: string; tracking?: number } = {},
): number {
  const size = opts.size ?? 30;
  g.font = font(size, opts.weight ?? 400, opts.family ?? SANS);
  setTracking(g, opts.tracking ?? 0);
  g.fillStyle = opts.color ?? C.ink2;
  g.textBaseline = 'top';
  const lh = opts.lineH ?? size * 1.38;
  let lines = wrap(g, text, maxW);
  if (opts.maxLines && lines.length > opts.maxLines) {
    lines = lines.slice(0, opts.maxLines);
    lines[lines.length - 1] = lines[lines.length - 1].replace(/\s*\S*$/, '…');
  }
  lines.forEach((l, i) => g.fillText(l, x, y + i * lh));
  setTracking(g, 0);
  return lines.length * lh;
}

export function title(g: CanvasRenderingContext2D, text: string, x: number, y: number, size = 76, color = C.ink, maxW = 1300): number {
  return para(g, text, x, y, maxW, { size, weight: 700, color, lineH: size * 1.05, tracking: -size * 0.035 });
}

export function eyebrow(g: CanvasRenderingContext2D, n: string, label: string, x: number, y: number, color = C.muted): void {
  g.font = font(20, 500, MONO);
  g.textBaseline = 'middle';
  const nw = g.measureText(n).width + 24;
  rr(g, x, y, nw, 34, 17);
  g.fillStyle = 'rgba(29,29,31,0.06)';
  g.fill();
  g.fillStyle = C.ink2;
  g.fillText(n, x + 12, y + 18);
  g.font = font(22, 600);
  g.fillStyle = color;
  g.fillText(label, x + nw + 14, y + 18);
  g.textBaseline = 'top';
}

export function pill(g: CanvasRenderingContext2D, text: string, x: number, y: number, opts: { fill?: string; color?: string; size?: number; stroke?: string; padX?: number; h?: number } = {}): Rect {
  const size = opts.size ?? 22;
  g.font = font(size, 500);
  const padX = opts.padX ?? 18;
  const h = opts.h ?? size + 22;
  const w = g.measureText(text).width + padX * 2;
  rr(g, x, y, w, h, h / 2);
  if (opts.fill) {
    g.fillStyle = opts.fill;
    g.fill();
  }
  if (opts.stroke) {
    g.strokeStyle = opts.stroke;
    g.lineWidth = 2;
    g.stroke();
  }
  g.fillStyle = opts.color ?? C.ink2;
  g.textBaseline = 'middle';
  g.fillText(text, x + padX, y + h / 2 + 1);
  g.textBaseline = 'top';
  return { x, y, w, h };
}

export function button(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  hovered: boolean,
  kind: 'primary' | 'ghost' = 'primary',
): Rect {
  const r = pill(g, text, x, y, {
    fill: kind === 'primary' ? (hovered ? '#2A4258' : C.navy) : hovered ? 'rgba(29,29,31,0.08)' : undefined,
    stroke: kind === 'ghost' ? 'rgba(29,29,31,0.22)' : undefined,
    color: kind === 'primary' ? '#F5F5F7' : C.ink,
    size: 26,
    padX: 28,
    h: 64,
  });
  return r;
}

export function setTracking(g: CanvasRenderingContext2D, px: number): void {
  const anyG = g as CanvasRenderingContext2D & { letterSpacing?: string };
  if ('letterSpacing' in anyG) anyG.letterSpacing = `${px}px`;
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const inRect = (x: number, y: number, r: Rect) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
