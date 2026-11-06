import { cases } from '../../../../content/profile.ts';
import { C, MONO, card, easeOut, eyebrow, font, para, pill, rr, setTracking, title, type Rect } from '../kit.ts';
import type { ModuleContext } from '../types.ts';
import { BaseModule } from './base.ts';

export class Work extends BaseModule {
  readonly id = 'work' as const;
  readonly title = 'Work';
  private sel = 0;
  private swap = 1;

  protected onMount(): void {
    this.swap = 1;
  }

  protected tick(dt: number): boolean {
    let busy = this.animating && this.age < 1.5;
    if (this.swap < 1) {
      this.swap = Math.min(1, this.swap + dt / 0.35);
      busy = true;
    }
    return busy;
  }

  key(e: KeyboardEvent): boolean {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') this.select((this.sel + 1) % cases.length);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') this.select((this.sel + cases.length - 1) % cases.length);
    else return false;
    return true;
  }

  private select(i: number): void {
    if (i === this.sel) return;
    this.sel = i;
    this.swap = this.ctx.reduceMotion ? 1 : 0;
    const c = cases[i];
    this.ctx.announce(`Case ${c.n}: ${c.title}. ${c.summary}`);
  }

  draw(g: CanvasRenderingContext2D, a: Rect, ctx: ModuleContext): void {
    const e = easeOut(this.enter(0, 0.6));
    const listW = 470;
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
      g.font = font(23, on ? 650 : 500);
      const fits = g.measureText(c.title).width <= listW - 52;
      para(g, c.title, a.x + 48, y + 26, listW - 52, { size: fits ? 23 : 21, weight: on ? 650 : 500, color: on ? C.ink : C.ink2, lineH: 28, maxLines: 1 });
      ctx.regions.add({ id: `case:${i}`, rect: { x: a.x - 14, y: y - 8, w: listW + 28, h }, label: c.title, onClick: () => this.select(i) });
      y += h + 4;
    });
    g.restore();

    // detail sheet
    const c = cases[this.sel];
    const k = easeOut(this.swap);
    const dx = a.x + listW + 64;
    const dw = a.x + a.w - dx;
    g.save();
    g.globalAlpha = e * (0.35 + 0.65 * k);
    card(g, dx, a.y + 10, dw, a.h - 10, 32);
    const px = dx + 52;
    let py = a.y + 52 + (1 - k) * 14;
    g.font = font(19, 500, MONO);
    g.fillStyle = C.faint;
    g.fillText(`Case file · Sheet ${c.n} / 07`, px, py);
    g.font = font(18, 650);
    g.fillStyle = C.lingon;
    setTracking(g, 1.2);
    g.textAlign = 'right';
    g.fillText(c.kicker.toUpperCase(), dx + dw - 52, py);
    g.textAlign = 'left';
    setTracking(g, 0);
    py += 44;
    py += title(g, c.title, px, py, 50, C.ink, dw - 104) + 14;
    py += para(g, c.summary, px, py, dw - 104, { size: 25, color: C.muted, lineH: 34 }) + 22;
    if (c.outcomes.length) {
      let ox = px;
      c.outcomes.forEach((o) => {
        g.font = font(40, 700);
        setTracking(g, -1.2);
        const vw = g.measureText(o.v).width;
        setTracking(g, 0);
        g.font = font(18, 400);
        const lw = Math.min(260, g.measureText(o.l).width);
        const w = Math.max(vw, lw) + 44;
        rr(g, ox, py, w, 116, 18);
        g.fillStyle = '#F1EEE7';
        g.fill();
        g.font = font(40, 700);
        setTracking(g, -1.2);
        g.fillStyle = C.ink;
        g.fillText(o.v, ox + 22, py + 18);
        setTracking(g, 0);
        para(g, o.l, ox + 22, py + 70, w - 40, { size: 18, color: C.muted, lineH: 22, maxLines: 2 });
        ox += w + 14;
      });
      py += 140;
    }
    g.font = font(19, 650);
    g.fillStyle = C.muted;
    g.fillText('What I did', px, py);
    py += 36;
    c.did.forEach((d) => {
      g.beginPath();
      g.arc(px + 6, py + 14, 4, 0, Math.PI * 2);
      g.fillStyle = C.oak;
      g.fill();
      py += para(g, d, px + 26, py, dw - 130, { size: 22, color: C.ink2, lineH: 30, maxLines: 2 }) + 8;
    });
    py += 10;
    let tx = px;
    c.tags.forEach((t) => {
      g.font = font(18, 500);
      const w = g.measureText(t).width + 32;
      if (tx + w > dx + dw - 260) return;
      pill(g, t, tx, py, { stroke: 'rgba(29,29,31,0.18)', color: C.ink2, size: 18, padX: 16, h: 38 });
      tx += w + 10;
    });
    // next sheet
    const nx = dx + dw - 210;
    const ny = a.y + a.h - 74;
    const hov = ctx.hover === 'next';
    g.font = font(22, 600);
    g.fillStyle = hov ? C.link : C.ink2;
    g.fillText('Next sheet  →', nx, ny);
    ctx.regions.add({ id: 'next', rect: { x: nx - 10, y: ny - 12, w: 190, h: 48 }, onClick: () => this.select((this.sel + 1) % cases.length) });
    g.restore();
  }

  describe(): string {
    const c = cases[this.sel];
    return `Seven case studies. Showing ${c.n}: ${c.title}. ${c.summary} Use the arrow keys for the next case.`;
  }
}
