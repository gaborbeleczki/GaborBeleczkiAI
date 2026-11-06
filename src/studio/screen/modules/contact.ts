import { profile } from '../../../../content/profile.ts';
import { C, MONO, button, card, easeOut, eyebrow, font, para, setTracking, title, type Rect } from '../kit.ts';
import type { ModuleContext } from '../types.ts';
import { BaseModule } from './base.ts';

export class Contact extends BaseModule {
  readonly id = 'contact' as const;
  readonly title = 'Contact';
  private copied = 0;

  protected tick(dt: number): boolean {
    if (this.copied > 0) {
      this.copied = Math.max(0, this.copied - dt);
      return true;
    }
    return this.animating && this.age < 1.5;
  }

  draw(g: CanvasRenderingContext2D, a: Rect, ctx: ModuleContext): void {
    const e = easeOut(this.enter(0, 0.7));
    g.save();
    g.globalAlpha = e;
    g.translate(0, (1 - e) * 20);
    card(g, a.x, a.y + 10, a.w, a.h - 10, 38);
    const px = a.x + 70;
    let y = a.y + 70;
    eyebrow(g, '07', 'Contact', px, y);
    y += 70;
    y += title(g, profile.openTo.title, px, y, 72, C.ink, 1200) + 22;
    y += para(g, profile.openTo.text, px, y, 1000, { size: 30, color: C.muted, lineH: 42 }) + 46;
    let x = px;
    const r1 = button(g, profile.email, x, y, ctx.hover === 'mail');
    ctx.regions.add({ id: 'mail', rect: r1, label: 'Email', onClick: () => ctx.link(`mailto:${profile.email}`, false) });
    x += r1.w + 16;
    const r2 = button(g, this.copied > 0 ? 'Copied ✓' : 'Copy email', x, y, ctx.hover === 'copy', 'ghost');
    ctx.regions.add({
      id: 'copy',
      rect: r2,
      onClick: () => {
        ctx.copy(profile.email);
        this.copied = 2;
      },
    });
    x += r2.w + 16;
    const r3 = button(g, 'LinkedIn ↗', x, y, ctx.hover === 'li', 'ghost');
    ctx.regions.add({ id: 'li', rect: r3, onClick: () => ctx.link(profile.linkedin, true) });
    y += 92;
    x = px;
    const r4 = button(g, 'Download CV', x, y, ctx.hover === 'cv', 'ghost');
    ctx.regions.add({ id: 'cv', rect: r4, onClick: () => ctx.link('/cv/', true) });
    x += r4.w + 16;
    const r5 = button(g, 'Read it as a page', x, y, ctx.hover === 'page', 'ghost');
    ctx.regions.add({ id: 'page', rect: r5, onClick: () => ctx.pageView() });

    // drawing title block, like the corner of an architectural sheet
    const tby = a.y + a.h - 130;
    g.fillStyle = 'rgba(29,29,31,0.16)';
    g.fillRect(px, tby, a.w - 140, 2);
    const cols: [string, string][] = [
      ['DRAWN BY', 'G. Béleczki'],
      ['ROLE', profile.role],
      ['LOCATION', profile.location],
      ['SHEET', '07 / 07 · © 2026'],
    ];
    const cw = (a.w - 140) / cols.length;
    cols.forEach(([k, v], i) => {
      g.font = font(17, 650);
      setTracking(g, 1.4);
      g.fillStyle = C.faint;
      g.fillText(k, px + i * cw, tby + 24);
      setTracking(g, 0);
      g.font = font(24, 500);
      g.fillStyle = C.ink2;
      g.fillText(v, px + i * cw, tby + 54);
    });
    g.font = font(17, 500, MONO);
    g.fillStyle = C.faint;
    g.restore();
  }

  describe(): string {
    return `${profile.openTo.title}. ${profile.openTo.text} Email ${profile.email}. LinkedIn, CV and the page version are linked here.`;
  }
}
