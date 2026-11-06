import { bands, positions } from '../../../../content/profile.ts';
import { C, MONO, card, easeOut, eyebrow, font, para, pill, rr, setTracking, title, type Rect } from '../kit.ts';
import type { ModuleContext } from '../types.ts';
import { BaseModule } from './base.ts';

const BAND_FILL = ['#CFD0D3', '#94BCE3', '#416180'];
const BAND_TEXT = ['#1D1F20', '#1D2D3D', '#F5F5F8'];

export class Career extends BaseModule {
  readonly id = 'career' as const;
  readonly title = 'Career';
  private sel = positions.length - 1;
  private swap = 1;

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

    // timeline
    const tx = a.x;
    const tw = a.w;
    const ty = a.y + 200;
    const first = positions[0].start;
    const last = positions[positions.length - 1].end;
    const X = (yr: number) => tx + ((yr - first) / (last - first)) * tw;
    g.fillStyle = C.line;
    g.fillRect(tx, ty + 120, tw, 2);
    [2009, 2013, 2015.5, 2020.4, 2022, 2025.67].forEach((yr) => {
      g.fillRect(X(yr), ty + 112, 2, 16);
      g.font = font(18, 500, MONO);
      g.fillStyle = C.faint;
      g.fillText(String(Math.floor(yr)), X(yr) + 6, ty + 132);
      g.fillStyle = C.line;
    });
    g.font = font(18, 500, MONO);
    g.fillStyle = C.faint;
    g.textAlign = 'right';
    g.fillText('Now', tx + tw, ty + 132);
    g.textAlign = 'left';
    positions.forEach((p, i) => {
      const grow = easeOut(this.enter(0.1 + i * 0.07, 0.5));
      const on = i === this.sel;
      const hov = ctx.hover === `pos:${i}`;
      const x = X(p.start) + 3;
      const w = (X(p.end) - X(p.start) - 6) * grow;
      const h = on ? 104 : hov ? 92 : 84;
      const y = ty + 104 - h;
      g.save();
      if (on) {
        g.shadowColor = 'rgba(29,45,61,0.22)';
        g.shadowBlur = 20;
        g.shadowOffsetY = 6;
      }
      rr(g, x, y, Math.max(8, w), h, 16);
      g.fillStyle = BAND_FILL[p.band];
      g.fill();
      g.restore();
      if (on) {
        rr(g, x, y, Math.max(8, w), h, 16);
        g.lineWidth = 3;
        g.strokeStyle = C.ink;
        g.stroke();
      }
      if (w > 60) {
        g.save();
        rr(g, x, y, w, h, 16);
        g.clip();
        g.font = font(17, 500, MONO);
        g.fillStyle = BAND_TEXT[p.band];
        g.globalAlpha = 0.8;
        g.fillText(p.years, x + 14, y + 14);
        g.globalAlpha = 1;
        g.font = font(21, 600);
        if (g.measureText(p.short).width <= w - 24) g.fillText(p.short, x + 14, y + 42);
        g.restore();
      }
      ctx.regions.add({ id: `pos:${i}`, rect: { x, y: ty, w: Math.max(30, w), h: 110 }, label: p.title, onClick: () => this.select(i) });
    });
    // legend
    let lx = tx;
    bands.forEach((b, i) => {
      g.beginPath();
      g.arc(lx + 8, ty + 186, 8, 0, Math.PI * 2);
      g.fillStyle = BAND_FILL[i];
      g.fill();
      g.font = font(19, 500);
      g.fillStyle = C.muted;
      g.fillText(b, lx + 24, ty + 175);
      lx += g.measureText(b).width + 70;
    });
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
