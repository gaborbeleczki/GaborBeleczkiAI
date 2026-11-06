import { bands, positions } from '../../../../content/profile.ts';

import { C, MONO, card, easeOut, eyebrow, font, para, pill, rr, setTracking, title, type Rect } from '../kit.ts';
import type { ModuleContext } from '../types.ts';
import { BaseModule } from './base.ts';

const BAND_FILL = ['#CFD0D3', '#94BCE3', '#416180'];
const BAND_TEXT = ['#1D1F20', '#1D2D3D', '#F5F5F8'];

// The skill mix over time, from the original portfolio's career chart: how much of the work was
// finance and markets, product and delivery, and AI. Keys are eased with a cosine.
const SKILL: [number, [number, number, number]][] = [
  [2009, [0.55, 0, 0]],
  [2013, [1, 0.05, 0]],
  [2015, [1, 0.12, 0]],
  [2018, [0.85, 0.35, 0]],
  [2020, [0.55, 0.85, 0]],
  [2022.83, [0.42, 0.88, 0]],
  [2024, [0.32, 0.62, 0.62]],
  [2025, [0.26, 0.45, 0.92]],
  [2026, [0.22, 0.38, 1.05]],
];

function skillAt(t: number): [number, number, number] {
  let i = 0;
  while (i < SKILL.length - 2 && t > SKILL[i + 1][0]) i++;
  const [a, va] = SKILL[i];
  const [b, vb] = SKILL[i + 1];
  const f = (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, (t - a) / (b - a))))) / 2;
  return [0, 1, 2].map((j) => va[j] + (vb[j] - va[j]) * f) as [number, number, number];
}

export class Career extends BaseModule {
  readonly id = 'career' as const;
  readonly title = 'Career';
  private sel = positions.length - 1;
  private swap = 1;
  private scrub: number | null = null;
  private chart: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private span: [number, number] = [2009, 2026];

  pointer(x: number, y: number, type: 'move' | 'down' | 'up' | 'leave'): boolean {
    const c = this.chart;
    const inside = type !== 'leave' && x >= c.x && x <= c.x + c.w && y >= c.y - 20 && y <= c.y + c.h + 40;
    const t = inside ? this.span[0] + ((x - c.x) / c.w) * (this.span[1] - this.span[0]) : null;
    const snapped = t === null ? null : Math.round(t * 4) / 4;
    if (type === 'up' && snapped !== null) {
      const i = Math.max(0, positions.map((p) => snapped >= p.start).lastIndexOf(true));
      this.select(i);
    }
    if (snapped !== this.scrub) {
      this.scrub = snapped;
      return true;
    }
    return false;
  }

  protected tick(dt: number): boolean {
    let busy = this.animating && this.age < 1.6;
    if (this.swap < 1) {
      this.swap = Math.min(1, this.swap + dt / 0.3);
      busy = true;
    }
    return busy;
  }

  key(e: KeyboardEvent): boolean {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') this.select(Math.min(positions.length - 1, this.sel + 1));
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') this.select(Math.max(0, this.sel - 1));
    else return false;
    return true;
  }

  private select(i: number): void {
    if (i === this.sel) return;
    this.sel = i;
    this.swap = this.ctx.reduceMotion ? 1 : 0;
    const p = positions[i];
    this.ctx.announce(`${p.years}: ${p.title}, ${p.org}. ${p.summary}`);
  }

  draw(g: CanvasRenderingContext2D, a: Rect, ctx: ModuleContext): void {
    const e = easeOut(this.enter(0, 0.6));
    g.save();
    g.globalAlpha = e;
    eyebrow(g, '04', 'Career', a.x, a.y + 10);
    title(g, 'Thirteen years across markets, product and AI', a.x, a.y + 66, 54, C.ink, 1300);

    // the skill mix, as a stream over the years (from the original portfolio's career chart)
    const [t0, t1] = this.span;
    const cx0 = a.x;
    const cw = a.w;
    const top = a.y + 180;
    const ch = 172;
    this.chart = { x: cx0, y: top, w: cw, h: ch };
    const X = (yr: number) => cx0 + ((yr - t0) / (t1 - t0)) * cw;
    const grow = easeOut(this.enter(0.1, 1.1));
    const m = top + ch / 2;
    const ks = (ch / 2.25) * grow;
    const edges = (t: number) => {
      const v = skillAt(t);
      const e = [m + ((v[0] + v[1] + v[2]) * ks) / 2];
      v.forEach((x) => e.push(e[e.length - 1] - x * ks));
      return e;
    };
    const ts: number[] = [];
    for (let t = t0; t <= t1 + 1e-6; t += 0.125) ts.push(t);
    const E = ts.map(edges);
    for (let j = 0; j < 3; j++) {
      g.beginPath();
      ts.forEach((t, i) => (i ? g.lineTo(X(t), E[i][j + 1]) : g.moveTo(X(t), E[i][j + 1])));
      for (let i = ts.length - 1; i >= 0; i--) g.lineTo(X(ts[i]), E[i][j]);
      g.closePath();
      g.fillStyle = BAND_FILL[j];
      g.fill();
    }
    g.globalAlpha = e;
    // band names inside the stream
    ([[2014.6, 0, 'Finance & markets'], [2020.8, 1, 'Product & delivery'], [2025.1, 2, 'AI']] as [number, number, string][]).forEach(([t, j, txt]) => {
      const ed = edges(t);
      g.font = font(19, 650);
      setTracking(g, 1.4);
      g.fillStyle = BAND_TEXT[j];
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(txt.toUpperCase(), X(t), (ed[j] + ed[j + 1]) / 2);
      g.textAlign = 'left';
      g.textBaseline = 'top';
      setTracking(g, 0);
    });
    // year ticks and the positions as segments under the stream
    const axisY = top + ch + 18;
    g.fillStyle = 'rgba(29,29,31,0.35)';
    g.fillRect(cx0, axisY, cw, 1);
    [2009, 2013, 2015, 2020, 2022].forEach((yr) => {
      g.fillStyle = 'rgba(29,29,31,0.12)';
      g.fillRect(X(yr), top - 6, 1, ch + 24);
      g.font = font(17, 500, MONO);
      g.fillStyle = C.faint;
      g.fillText(String(yr), X(yr) + 6, axisY + 26);
    });
    g.font = font(17, 600, MONO);
    g.fillStyle = C.lingon;
    g.textAlign = 'right';
    g.fillText('Now', cx0 + cw, axisY + 26);
    g.textAlign = 'left';
    positions.forEach((p, i) => {
      const on = i === this.sel;
      const hov = ctx.hover === `pos:${i}`;
      const x = X(p.start) + 2;
      const w = X(Math.min(p.end, t1)) - X(p.start) - 4;
      rr(g, x, axisY + 6, Math.max(6, w), on ? 10 : 6, 4);
      g.fillStyle = on ? C.ink : hov ? C.fjord : BAND_FILL[p.band];
      g.fill();
      ctx.regions.add({ id: `pos:${i}`, rect: { x, y: axisY - 4, w: Math.max(20, w), h: 30 }, label: p.title, onClick: () => this.select(i) });
    });
    // the scrub line: hovered year, or the middle of the selected position
    const sp = positions[this.sel];
    const yr = this.scrub ?? Math.min(t1 - 0.2, (sp.start + Math.min(sp.end, t1)) / 2);
    const sx = X(yr);
    g.fillStyle = C.lingon;
    g.fillRect(sx - 1, top - 10, 2, ch + 22);
    const ri = Math.max(0, positions.map((q) => yr >= q.start).lastIndexOf(true));
    const chip = `${Math.floor(yr)} · ${positions[ri].short}`;
    g.font = font(17, 650);
    const cwid = g.measureText(chip).width + 22;
    const chx = Math.min(cx0 + cw - cwid, Math.max(cx0, sx - cwid / 2));
    rr(g, chx, top - 46, cwid, 32, 8);
    g.fillStyle = C.lingon;
    g.fill();
    g.fillStyle = '#FFFFFF';
    g.textBaseline = 'middle';
    g.fillText(chip, chx + 11, top - 29);
    g.textBaseline = 'top';
    g.restore();

    // detail
    const p = positions[this.sel];
    const k = easeOut(this.swap);
    const dy = a.y + 420;
    const dh = a.y + a.h - dy;
    g.save();
    g.globalAlpha = e * (0.3 + 0.7 * k);
    card(g, a.x, dy, a.w, dh, 30);
    const px = a.x + 48;
    let py = dy + 40 + (1 - k) * 12;
    g.font = font(20, 500, MONO);
    g.fillStyle = C.faint;
    g.fillText(`Position ${p.k} / 06 · ${p.years}`, px, py);
    g.beginPath();
    g.arc(px + 380, py + 11, 8, 0, Math.PI * 2);
    g.fillStyle = BAND_FILL[p.band];
    g.fill();
    g.font = font(20, 500);
    g.fillStyle = C.muted;
    g.fillText(bands[p.band], px + 396, py);
    py += 40;
    py += title(g, p.title, px, py, 40, C.ink, 640) + 8;
    g.font = font(24, 500);
    g.fillStyle = C.fjord;
    g.fillText(p.org, px, py);
    py += 44;
    para(g, p.summary, px, py, 620, { size: 22, color: C.ink2, lineH: 31, maxLines: 4 });
    // highlights column
    const hx = a.x + 760;
    let hy = dy + 40;
    g.font = font(18, 650);
    g.fillStyle = C.muted;
    setTracking(g, 1);
    g.fillText('HIGHLIGHTS', hx, hy);
    setTracking(g, 0);
    hy += 36;
    const bottom = dy + dh - (p.tools.length ? 84 : 30);
    for (const h of p.highlights) {
      if (hy + 30 + 48 > bottom) break;
      g.font = font(21, 650);
      g.fillStyle = C.ink;
      g.fillText(h.h, hx, hy);
      hy += 30;
      hy += para(g, h.t, hx, hy, a.x + a.w - hx - 48, { size: 18, color: C.muted, lineH: 24, maxLines: 2 }) + 14;
    }
    if (p.tools.length) {
      let tx2 = hx;
      const ty2 = dy + dh - 62;
      for (const t of p.tools) {
        g.font = font(17, 500);
        const w = g.measureText(t).width + 30;
        if (tx2 + w > a.x + a.w - 40) break;
        pill(g, t, tx2, ty2, { stroke: 'rgba(29,29,31,0.16)', size: 17, padX: 15, h: 36 });
        tx2 += w + 8;
      }
    }
    g.restore();
  }

  describe(): string {
    const p = positions[this.sel];
    return `Career timeline, 2009 to now. Showing ${p.years}: ${p.title} at ${p.org}. ${p.summary}`;
  }
}
