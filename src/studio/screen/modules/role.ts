import { duties, kpis, profile } from '../../../../content/profile.ts';
import { C, MONO, card, easeOut, eyebrow, font, para, rr, setTracking, title, type Rect } from '../kit.ts';
import type { ModuleContext } from '../types.ts';
import { BaseModule } from './base.ts';

function parseCount(v: string): { n: number; fmt: (x: number) => string } | null {
  const m = /^([\d,]+)(.*)$/.exec(v);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  const suffix = m[2];
  return { n, fmt: (x) => Math.round(x).toLocaleString('en-US') + suffix };
}

export class Role extends BaseModule {
  readonly id = 'role' as const;
  readonly title = 'Role';
  private duty = 0;

  protected tick(): boolean {
    return this.animating && this.age < 2.2;
  }

  key(e: KeyboardEvent): boolean {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') this.duty = (this.duty + 1) % duties.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') this.duty = (this.duty + duties.length - 1) % duties.length;
    else return false;
    this.ctx.announce(`${duties[this.duty].title}. ${duties[this.duty].text}`);
    return true;
  }

  draw(g: CanvasRenderingContext2D, a: Rect, ctx: ModuleContext): void {
    const e = easeOut(this.enter(0, 0.7));
    const leftW = 700;
    g.save();
    g.globalAlpha = e;
    eyebrow(g, '02', 'Current role', a.x, a.y + 10);
    let y = a.y + 70;
    y += title(g, profile.role, a.x, y, 70, C.ink, leftW);
    y += 12;
    g.font = font(25, 500);
    g.fillStyle = C.fjord;
    g.fillText(`${profile.org} · ${profile.orgUnit} · ${profile.roleSince}`, a.x, y);
    y += 52;
    y += para(g, profile.roleSummary, a.x, y, leftW, { size: 26, color: C.ink2, lineH: 37 });
    y += 26;
    // duties: numbered rows, the selected one expands
    duties.forEach((d, i) => {
      const on = i === this.duty;
      const hov = ctx.hover === `duty:${i}`;
      const h = on ? 112 : 46;
      if (on) card(g, a.x - 16, y - 8, leftW + 32, h, 18);
      g.font = font(19, 500, MONO);
      g.fillStyle = C.faint;
      g.fillText(d.n, a.x, y + 6);
      g.font = font(25, on || hov ? 650 : 500);
      g.fillStyle = on ? C.ink : C.ink2;
      g.fillText(d.title, a.x + 52, y + 2);
      if (on) para(g, d.text, a.x + 52, y + 38, leftW - 60, { size: 20, color: C.muted, lineH: 26, maxLines: 2 });
      ctx.regions.add({ id: `duty:${i}`, rect: { x: a.x - 16, y: y - 8, w: leftW + 32, h }, label: d.title, onClick: () => (this.duty = i) });
      y += h + 6;
    });
    g.restore();

    // KPI bento on the right
    const bx = a.x + leftW + 70;
    const bw = a.x + a.w - bx;
    const colW = (bw - 18) / 2;
    const rowH = 172;
    const cells: Rect[] = [
      { x: bx, y: a.y + 10, w: bw, h: rowH + 20 },
      { x: bx, y: a.y + rowH + 48, w: colW, h: rowH },
      { x: bx + colW + 18, y: a.y + rowH + 48, w: colW, h: rowH },
      { x: bx, y: a.y + 2 * rowH + 66, w: colW, h: rowH },
      { x: bx + colW + 18, y: a.y + 2 * rowH + 66, w: colW, h: rowH },
    ];
    kpis.forEach((k, i) => {
      const ce = easeOut(this.enter(0.1 + i * 0.08, 0.6));
      const r = cells[i];
      g.save();
      g.globalAlpha = ce;
      const ink = i === 0;
      if (ink) {
        g.save();
        g.shadowColor = 'rgba(29,45,61,0.25)';
        g.shadowBlur = 30;
        g.shadowOffsetY = 10;
        rr(g, r.x, r.y + (1 - ce) * 20, r.w, r.h, 30);
        const grd = g.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
        grd.addColorStop(0, '#22364A');
        grd.addColorStop(1, '#172433');
        g.fillStyle = grd;
        g.fill();
        g.restore();
      } else {
        card(g, r.x, r.y + (1 - ce) * 20, r.w, r.h, 30);
      }
      const count = parseCount(k.value);
      const progress = easeOut(this.enter(0.2 + i * 0.08, 1.4));
      const shown = count && this.animating ? count.fmt(count.n * progress) : k.value;
      g.font = font(ink ? 92 : 64, 700);
      setTracking(g, ink ? -3.5 : -2.5);
      g.fillStyle = ink ? '#FFFFFF' : C.ink;
      g.fillText(shown, r.x + 28, r.y + 24 + (1 - ce) * 20);
      setTracking(g, 0);
      para(g, k.label, r.x + 28, r.y + r.h - (ink ? 66 : 74) + (1 - ce) * 20, r.w - 48, { size: ink ? 24 : 18, color: ink ? '#B9C9D9' : C.muted, lineH: ink ? 30 : 22, maxLines: ink ? 2 : 3 });
      g.restore();
    });
    g.font = font(18, 500, MONO);
    g.fillStyle = C.faint;
    g.fillText('Morgan Stanley Finance · AI programmes', bx, a.y + a.h - 6);
  }

  describe(): string {
    return `${profile.role}, ${profile.org} ${profile.orgUnit}, ${profile.roleSince}. ${profile.roleSummary} Numbers: ${kpis.map((k) => `${k.value} ${k.label}`).join('; ')}.`;
  }
}
