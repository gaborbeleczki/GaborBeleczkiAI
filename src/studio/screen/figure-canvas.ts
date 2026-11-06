// Draws a motion figure (src/shared/figures.ts) on the display canvas at time t.

import { along, tokenOpacity, type Anim, type Figure, type Paint, type Shape } from '../../shared/figures.ts';
import { SANS, setTracking, type Rect } from './kit.ts';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const paths = new Map<string, Path2D>();
const pathOf = (d: string) => {
  let p = paths.get(d);
  if (!p) {
    p = new Path2D(d);
    paths.set(d, p);
  }
  return p;
};

function mixHex(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function paint(g: CanvasRenderingContext2D, p: Paint, fillOverride?: string): void {
  if (p.fill || fillOverride) {
    g.fillStyle = fillOverride ?? p.fill!;
    g.fill();
  }
  if (p.stroke) {
    g.save();
    g.strokeStyle = p.stroke;
    g.lineWidth = p.width ?? 1;
    if (p.dash) g.setLineDash(p.dash);
    if (p.strokeOpacity !== undefined) g.globalAlpha *= p.strokeOpacity;
    g.lineCap = p.cap ?? 'butt';
    g.stroke();
    g.restore();
  }
}

function shapePath(g: CanvasRenderingContext2D, s: Shape): Path2D | null {
  switch (s.k) {
    case 'path':
      return pathOf(s.d);
    case 'circle':
      g.beginPath();
      g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      return null;
    case 'ellipse':
      g.beginPath();
      g.ellipse(s.x, s.y, s.rx, s.ry, 0, 0, Math.PI * 2);
      return null;
    case 'rect':
      g.beginPath();
      g.rect(s.x, s.y, s.w, s.h);
      return null;
    default:
      return null;
  }
}

function drawShape(g: CanvasRenderingContext2D, s: Shape, t: number, still: boolean): void {
  const a: Anim | undefined = s.a;
  g.save();
  let fill: string | undefined;
  if (a?.motion) {
    const m = a.motion;
    let f: number;
    if (still) f = m.begin > 0 ? 0.5 : (((-m.begin / m.dur) % 1) + 1) % 1;
    else {
      if (t < m.begin) {
        g.restore();
        return;
      }
      f = (((t - m.begin) / m.dur) % 1 + 1) % 1;
    }
    const [x, y] = along(m.path, f);
    g.translate(x, y);
    g.globalAlpha *= still ? 1 : tokenOpacity(f, m.fadeIn, m.fadeOut);
    if (m.recolor && s.k !== 'group' && s.p.fill) fill = mixHex(s.p.fill, m.recolor.to, clamp01((f - m.recolor.a) / (m.recolor.b - m.recolor.a)));
  }
  if (a?.fade && !still) g.globalAlpha *= clamp01((t - a.fade.delay) / a.fade.dur);
  if (a?.pop && !still) {
    const k = clamp01((t - a.pop.delay) / a.pop.dur);
    if (k <= 0) {
      g.restore();
      return;
    }
    const sc = easeOutBack(k);
    const [ox, oy] = a.pop.origin;
    g.translate(ox, oy);
    g.scale(sc, sc);
    g.translate(-ox, -oy);
    g.globalAlpha *= clamp01(k * 3);
  }
  if (a?.bob && !still && t > a.bob.delay) {
    const ph = ((t - a.bob.delay) / a.bob.dur) * Math.PI * 2;
    g.translate(0, -a.bob.amp * (0.5 - 0.5 * Math.cos(ph)));
  }
  if (a?.spark && !still) {
    const k = clamp01((t - a.spark.delay) / a.spark.dur);
    g.globalAlpha *= clamp01(k * 2.5);
    g.translate(0, 4 * (1 - k) * (1 - k));
  }
  if (a?.spin && !still) {
    const [cx, cy] = a.spin.centre;
    g.translate(cx, cy);
    g.rotate(((t / a.spin.dur) % 1) * Math.PI * 2);
    g.translate(-cx, -cy);
  }
  if (a?.pulse) {
    if (still || t < a.pulse.begin || s.k !== 'ellipse') {
      g.restore();
      return;
    }
    const k = (((t - a.pulse.begin) / a.pulse.dur) % 1 + 1) % 1;
    g.beginPath();
    g.ellipse(s.x, s.y, s.rx + (a.pulse.to[0] - s.rx) * k, s.ry + (a.pulse.to[1] - s.ry) * k, 0, 0, Math.PI * 2);
    g.globalAlpha *= a.pulse.opacity * (1 - k);
    paint(g, { ...s.p, strokeOpacity: 1 });
    g.restore();
    return;
  }
  if (s.k === 'group') {
    for (const kid of s.kids) drawShape(g, kid, t, still);
  } else {
    if (s.k === 'rect' && s.rot) {
      const cx = s.x + s.w / 2;
      const cy = s.y + s.h / 2;
      g.translate(cx, cy);
      g.rotate((s.rot * Math.PI) / 180);
      g.translate(-cx, -cy);
    }
    const p = shapePath(g, s);
    if (p) {
      if (s.p.fill || fill) {
        g.fillStyle = fill ?? s.p.fill!;
        g.fill(p);
      }
      if (s.p.stroke) {
        g.save();
        g.strokeStyle = s.p.stroke;
        g.lineWidth = s.p.width ?? 1;
        if (s.p.dash) g.setLineDash(s.p.dash);
        if (s.p.strokeOpacity !== undefined) g.globalAlpha *= s.p.strokeOpacity;
        g.stroke(p);
        g.restore();
      }
    } else paint(g, s.p, fill);
  }
  g.restore();
}

/** Draw the figure into `r` (fit inside, centred). Returns the rectangle it used. */
export function drawFigure(g: CanvasRenderingContext2D, fig: Figure, r: Rect, t: number, still: boolean, noteScale = 1.3): Rect {
  const sc = Math.min(r.w / fig.w, r.h / fig.h);
  const w = fig.w * sc;
  const h = fig.h * sc;
  const x = r.x + (r.w - w) / 2;
  const y = r.y + (r.h - h) / 2;
  g.save();
  g.translate(x, y);
  g.scale(sc, sc);
  for (const s of fig.shapes) drawShape(g, s, t, still);
  // annotations: small caps, with a chip that cuts the lines behind them
  for (const n of fig.notes) {
    const size = (n.size ?? 12) * noteScale;
    g.font = `600 ${size}px ${SANS}`;
    setTracking(g, size * 0.12);
    const text = n.text.toUpperCase();
    const tw = g.measureText(text).width;
    const ax = n.ax ?? 0.5;
    const ay = n.ay ?? 0.5;
    const lx = n.x - tw * ax;
    const ly = n.y + (n.dy ?? 0) - size * ay;
    if (n.bg) {
      g.fillStyle = n.bg;
      g.fillRect(lx - 8, ly - 2, tw + 16, size + 4);
    }
    g.fillStyle = n.color;
    g.textBaseline = 'top';
    g.fillText(text, lx, ly + 1);
    setTracking(g, 0);
  }
  g.restore();
  return { x, y, w, h };
}
