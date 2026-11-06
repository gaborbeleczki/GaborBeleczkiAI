import { cases } from '../../../../content/profile.ts';
import { caseFigure, type Figure } from '../../../shared/figures.ts';
import { drawFigure } from '../figure-canvas.ts';
import { C, MONO, card, easeOut, eyebrow, font, para, pill, rr, segmented, setTracking, title, type Rect } from '../kit.ts';
import type { ModuleContext } from '../types.ts';
import { BaseModule } from './base.ts';

type View = 'figure' | 'details';

/**
 * Seven case files. Each sheet opens on its motion figure (ported from the original portfolio:
 * the governed route, the use-case funnel, adoption week by week, hub and spoke; plus three
 * drawn for this studio in the same style), with the details one tap away.
 */
export class Work extends BaseModule {
  readonly id = 'work' as const;
  readonly title = 'Work';
  private sel = 0;
  private swap = 1;
  private view: View = 'figure';
  private figT = 0;
  private readonly figures = new Map<number, Figure>();

  protected onMount(): void {
    this.swap = 1;
    this.figT = 0;
  }

  protected tick(dt: number): boolean {
    this.figT += dt;
    let busy = this.animating && this.age < 1.5;
    if (this.swap < 1) {
      this.swap = Math.min(1, this.swap + dt / 0.35);
      busy = true;
    }
    // the figure loops for as long as it is on screen
    return busy || (this.view === 'figure' && !this.ctx.reduceMotion);
  }

  key(e: KeyboardEvent): boolean {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') this.select((this.sel + 1) % cases.length);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') this.select((this.sel + cases.length - 1) % cases.length);
    else if (e.key === 'f' || e.key === 'F') this.setView(this.view === 'figure' ? 'details' : 'figure');
    else return false;
    return true;
  }

  private figure(i: number): Figure {
    let f = this.figures.get(i);
    if (!f) {
      f = caseFigure(i);
      this.figures.set(i, f);
    }
    return f;
  }

  private select(i: number): void {
    if (i === this.sel) return;
    this.sel = i;
    this.swap = this.ctx.reduceMotion ? 1 : 0;
    this.figT = 0;
    const c = cases[i];
    this.ctx.announce(`Case ${c.n}: ${c.title}. ${c.summary}`);
  }

  private setView(v: View): void {
    if (v === this.view) return;
    this.view = v;
    this.figT = 0;
    this.ctx.announce(v === 'figure' ? `Figure: ${this.figure(this.sel).caption}` : 'Details');
  }

  draw(g: CanvasRenderingContext2D, a: Rect, ctx: ModuleContext): void {
    const e = easeOut(this.enter(0, 0.6));
    const listW = 430;
    g.save();
    g.globalAlpha = e;
    eyebrow(g, '03', 'Selected work', a.x, a.y + 10);
    title(g, 'Case studies', a.x, a.y + 66, 58);
    let y = a.y + 150;
    cases.forEach((c, i) => {
      const on = i === this.sel;
      const hov = ctx.hover === `case:${i}`;
      const h = 74;
      if (on) card(g, a.x - 14, y - 8, listW + 28, h, 18);
      else if (hov) {
        rr(g, a.x - 14, y - 8, listW + 28, h, 18);
        g.fillStyle = 'rgba(29,29,31,0.04)';
        g.fill();
      }
      g.font = font(18, 500, MONO);
      g.fillStyle = C.faint;
      g.fillText(c.n, a.x, y + 6);
      g.font = font(16, 650);
      g.fillStyle = C.fjord;
      setTracking(g, 1);
      g.fillText(c.kicker.toUpperCase(), a.x + 48, y + 2);
      setTracking(g, 0);
      g.font = font(22, on ? 650 : 500);
      const fits = g.measureText(c.title).width <= listW - 52;
      para(g, c.title, a.x + 48, y + 26, listW - 52, { size: fits ? 22 : 20, weight: on ? 650 : 500, color: on ? C.ink : C.ink2, lineH: 28, maxLines: 1 });
      ctx.regions.add({ id: `case:${i}`, rect: { x: a.x - 14, y: y - 8, w: listW + 28, h }, label: c.title, onClick: () => this.select(i) });
      y += h + 4;
    });
    g.restore();

    // the case sheet
    const c = cases[this.sel];
    const k = easeOut(this.swap);
    const dx = a.x + listW + 56;
    const dw = a.x + a.w - dx;
    g.save();
    g.globalAlpha = e * (0.35 + 0.65 * k);
    card(g, dx, a.y + 10, dw, a.h - 10, 32);
    const px = dx + 48;
    const pw = dw - 96;
    let py = a.y + 46 + (1 - k) * 14;
    g.font = font(18, 500, MONO);
    g.fillStyle = C.faint;
    g.fillText(`Case file · Sheet ${c.n} / 07`, px, py);
    g.font = font(17, 650);
    g.fillStyle = C.lingon;
    setTracking(g, 1.2);
    g.textAlign = 'right';
    g.fillText(c.kicker.toUpperCase(), dx + dw - 48, py);
    g.textAlign = 'left';
    setTracking(g, 0);
    py += 38;
    py += title(g, c.title, px, py, 44, C.ink, pw) + 10;
    py += para(g, c.summary, px, py, pw, { size: 22, color: C.muted, lineH: 30, maxLines: 2 }) + 18;

    // Figure | Details
    const hoverSeg = ctx.hover === 'view:figure' ? 0 : ctx.hover === 'view:details' ? 1 : -1;
    const segs = segmented(g, ['Figure', 'Details'], this.view === 'figure' ? 0 : 1, px, py, hoverSeg);
    ctx.regions.add({ id: 'view:figure', rect: segs[0], label: 'Show the figure', onClick: () => this.setView('figure') });
    ctx.regions.add({ id: 'view:details', rect: segs[1], label: 'Show the details', onClick: () => this.setView('details') });
    py += 72;
    const bottom = a.y + a.h - 90;
    if (this.view === 'figure') this.drawFigureView(g, px, py, pw, bottom - py);
    else this.drawDetails(g, c, px, py, pw);

    // next sheet
    const nx = dx + dw - 210;
    const ny = a.y + a.h - 66;
    const hov = ctx.hover === 'next';
    g.font = font(21, 600);
    g.fillStyle = hov ? C.link : C.ink2;
    g.fillText('Next sheet  →', nx, ny);
    ctx.regions.add({ id: 'next', rect: { x: nx - 10, y: ny - 12, w: 190, h: 48 }, onClick: () => this.select((this.sel + 1) % cases.length) });
    g.restore();
  }

  private drawFigureView(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    const fig = this.figure(this.sel);
    g.font = font(16, 500, MONO);
    g.fillStyle = C.faint;
    g.fillText(fig.caption, x, y);
    const labelsH = fig.labels.some((l) => l.t) ? 92 : 0;
    const area = { x, y: y + 34, w, h: h - 34 - labelsH - 8 };
    const used = drawFigure(g, fig, area, this.figT, this.ctx.reduceMotion);
    // stage labels, in columns under the figure (weights as in the original)
    if (!labelsH) return;
    const total = fig.cols.reduce((s, v) => s + v, 0);
    let lx = used.x;
    const ly = used.y + used.h + 18;
    g.strokeStyle = 'rgba(29,29,31,0.12)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(used.x, ly - 8);
    g.lineTo(used.x + used.w, ly - 8);
    g.stroke();
    fig.labels.forEach((l, i) => {
      const cw = (fig.cols[i] / total) * used.w;
      if (l.t) {
        g.font = font(19, 650);
        g.fillStyle = C.ink;
        g.fillText(l.t, lx, ly);
        para(g, l.d, lx, ly + 28, cw - 14, { size: 16, color: C.muted, lineH: 21, maxLines: 2 });
      }
      lx += cw;
    });
  }

  private drawDetails(g: CanvasRenderingContext2D, c: (typeof cases)[number], px: number, y: number, pw: number): void {
    let py = y;
    if (c.outcomes.length) {
      let ox = px;
      c.outcomes.forEach((o) => {
        g.font = font(38, 700);
        setTracking(g, -1.2);
        const vw = g.measureText(o.v).width;
        setTracking(g, 0);
        g.font = font(17, 400);
        const lw = Math.min(250, g.measureText(o.l).width);
        const w = Math.max(vw, lw) + 44;
        rr(g, ox, py, w, 110, 18);
        g.fillStyle = '#F1EEE7';
        g.fill();
        g.font = font(38, 700);
        setTracking(g, -1.2);
        g.fillStyle = C.ink;
        g.fillText(o.v, ox + 22, py + 18);
        setTracking(g, 0);
        para(g, o.l, ox + 22, py + 66, w - 40, { size: 17, color: C.muted, lineH: 21, maxLines: 2 });
        ox += w + 14;
      });
      py += 132;
    }
    g.font = font(19, 650);
    g.fillStyle = C.muted;
    g.fillText('What I did', px, py);
    py += 34;
    c.did.forEach((d) => {
      g.beginPath();
      g.arc(px + 6, py + 13, 4, 0, Math.PI * 2);
      g.fillStyle = C.oak;
      g.fill();
      py += para(g, d, px + 26, py, pw - 30, { size: 21, color: C.ink2, lineH: 28, maxLines: 2 }) + 8;
    });
    py += 10;
    let tx = px;
    c.tags.forEach((t) => {
      g.font = font(17, 500);
      const w = g.measureText(t).width + 30;
      if (tx + w > px + pw - 220) return;
      pill(g, t, tx, py, { stroke: 'rgba(29,29,31,0.18)', color: C.ink2, size: 17, padX: 15, h: 36 });
      tx += w + 10;
    });
  }

  describe(): string {
    const c = cases[this.sel];
    const f = this.figure(this.sel);
    return `Seven case studies. Showing ${c.n}: ${c.title}. ${c.summary} Figure: ${f.caption}, ${f.labels
      .filter((l) => l.t)
      .map((l) => `${l.t}: ${l.d}`)
      .join('; ')}. Use the arrow keys for the next case, F to switch between the figure and the details.`;
  }
}
