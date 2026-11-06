import { approach } from '../../../../content/profile.ts';
import { C, MONO, card, easeOut, eyebrow, font, para, title, type Rect } from '../kit.ts';
import type { ModuleContext } from '../types.ts';
import { BaseModule } from './base.ts';

const TINTS = ['#D9C9AE', '#A9B8A4', '#94BCE3', '#416180', '#1D2D3D'];

export class Approach extends BaseModule {
  readonly id = 'approach' as const;
  readonly title = 'Approach';
  private sel = 2;
  private ripple = 0;

  protected onMount(): void {
    this.ripple = 0;
  }

  protected tick(dt: number): boolean {
    this.ripple += dt;
    return !this.ctx.reduceMotion;
  }

  key(e: KeyboardEvent): boolean {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') this.select(Math.min(4, this.sel + 1));
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') this.select(Math.max(0, this.sel - 1));
    else return false;
    return true;
  }

  private select(i: number): void {
    if (i === this.sel) return;
    this.sel = i;
    this.ripple = 0;
    const s = approach.steps[i];
    this.ctx.announce(`${s.n} ${s.title}. ${s.text}`);
  }

  draw(g: CanvasRenderingContext2D, a: Rect, ctx: ModuleContext): void {
    const e = easeOut(this.enter(0, 0.7));
    g.save();
    g.globalAlpha = e;
    eyebrow(g, '01', 'Point of view', a.x, a.y + 10);
    let y = a.y + 70;
    y += title(g, approach.title, a.x, y, 78);
    y += 18;
    para(g, approach.lead, a.x, y, 1240, { size: 29, color: C.ink2, lineH: 42 });
    g.restore();

    // the wave: five steps, each circle larger than the last
    const baseY = a.y + 560;
    const x0 = a.x + 90;
    const x1 = a.x + a.w - 120;
    const t = this.ripple;
    g.save();
    g.globalAlpha = e;
    g.lineWidth = 3;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      for (let x = a.x; x <= a.x + a.w; x += 8) {
        const p = (x - a.x) / a.w;
        const amp = 10 + 26 * p;
        const yy = baseY + 110 + k * 16 + Math.sin(p * 9 - t * (ctx.reduceMotion ? 0 : 1.1) - k * 0.8) * amp * (1 - k * 0.25);
        if (x === a.x) g.moveTo(x, yy);
        else g.lineTo(x, yy);
      }
      g.strokeStyle = `rgba(65,97,128,${0.28 - k * 0.07})`;
      g.stroke();
    }
    approach.steps.forEach((s, i) => {
      const x = x0 + ((x1 - x0) * i) / 4;
      const r = 40 + i * 13;
      const cy = baseY - i * 20;
      const on = i === this.sel;
      const hov = ctx.hover === `step:${i}`;
      if (on && !ctx.reduceMotion) {
        for (let k = 0; k < 3; k++) {
          const p = ((t * 0.55 + k / 3) % 1);
          g.beginPath();
          g.arc(x, cy, r + p * 70, 0, Math.PI * 2);
          g.strokeStyle = `rgba(65,97,128,${0.35 * (1 - p)})`;
          g.lineWidth = 2;
          g.stroke();
        }
      }
      g.beginPath();
      g.arc(x, cy, r * (hov ? 1.06 : 1), 0, Math.PI * 2);
      g.fillStyle = TINTS[i];
      g.fill();
      if (on) {
        g.lineWidth = 4;
        g.strokeStyle = C.ink;
        g.stroke();
      }
      g.fillStyle = i >= 3 ? '#F5F5F7' : C.ink;
      g.font = font(22, 600, MONO);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(s.n, x, cy);
      g.font = font(27, 600);
      g.fillStyle = on ? C.ink : C.ink2;
      g.textBaseline = 'top';
      g.fillText(s.title, x, cy + r + 18);
      g.textAlign = 'left';
      ctx.regions.add({ id: `step:${i}`, rect: { x: x - r - 10, y: cy - r - 10, w: 2 * r + 20, h: 2 * r + 70 }, label: s.title, onClick: () => this.select(i) });
    });
    g.restore();

    // caption card for the selected step
    const s = approach.steps[this.sel];
    const cw = 700;
    const cx = a.x;
    const cyy = a.y + 262;
    g.save();
    g.globalAlpha = e;
    card(g, cx, cyy, cw, 128, 24);
    g.font = font(20, 500, MONO);
    g.fillStyle = C.faint;
    g.fillText(`Step ${s.n} of 05`, cx + 30, cyy + 24);
    g.font = font(32, 650);
    g.fillStyle = C.ink;
    g.fillText(s.title, cx + 30, cyy + 54);
    para(g, s.text, cx + 30 + g.measureText(s.title).width + 20, cyy + 60, cw - 80 - g.measureText(s.title).width, { size: 24, color: C.muted, lineH: 30, maxLines: 2 });
    g.restore();
  }

  describe(): string {
    return `${approach.title}. ${approach.lead} Steps: ${approach.steps.map((s) => `${s.title}: ${s.text}`).join(' ')}`;
  }
}
