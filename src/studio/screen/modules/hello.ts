import { profile } from '../../../../content/profile.ts';
import { C, MONO, button, card, easeOut, eyebrow, font, para, rr, title, type Rect } from '../kit.ts';
import type { ModuleContext } from '../types.ts';
import { BaseModule } from './base.ts';

export class Hello extends BaseModule {
  readonly id = 'hello' as const;
  readonly title = 'Hello';
  private word = 0;
  private typed = 0;
  private hold = 0;
  private deleting = false;

  protected onMount(): void {
    this.word = 0;
    this.typed = profile.workingWith[0].length;
    this.hold = 1.6;
  }

  protected tick(dt: number): boolean {
    if (this.ctx.reduceMotion) return false;
    const target = profile.workingWith[this.word];
    if (this.hold > 0) {
      this.hold -= dt;
      return this.age < 2.5 || Math.floor(this.age * 2) !== Math.floor((this.age - dt) * 2);
    }
    if (!this.deleting) {
      this.typed = Math.min(target.length, this.typed + dt * 14);
      if (this.typed >= target.length) {
        this.deleting = true;
        this.hold = 2.2;
      }
    } else {
      this.typed = Math.max(0, this.typed - dt * 24);
      if (this.typed <= 0) {
        this.deleting = false;
        this.word = (this.word + 1) % profile.workingWith.length;
      }
    }
    return true;
  }

  draw(g: CanvasRenderingContext2D, a: Rect, ctx: ModuleContext): void {
    const e1 = easeOut(this.enter(0, 0.7));
    const e2 = easeOut(this.enter(0.15, 0.8));
    const leftW = 820;
    g.save();
    g.globalAlpha = e1;
    g.translate(0, (1 - e1) * 24);
    eyebrow(g, '00', 'Hello', a.x, a.y + 10, C.lingon);
    let y = a.y + 72;
    y += title(g, 'Gábor', a.x, y, 120, C.ink) - 6;
    y += title(g, 'Béleczki', a.x, y, 120, C.ink) + 18;
    g.font = font(28, 500);
    g.fillStyle = C.muted;
    g.fillText(`${profile.role} · ${profile.org} · Budapest`, a.x, y);
    y += 62;
    y += para(g, profile.intro, a.x, y, leftW, { size: 31, color: C.ink2, lineH: 44 });
    y += 30;
    // terminal line
    g.font = font(26, 500, MONO);
    g.fillStyle = C.muted;
    const prompt = '~$ working-with ';
    g.fillText(prompt, a.x, y);
    const pw = g.measureText(prompt).width;
    const word = profile.workingWith[this.word].slice(0, Math.round(this.typed));
    g.fillStyle = C.ink;
    g.fillText(word, a.x + pw, y);
    const ww = g.measureText(word).width;
    if (ctx.reduceMotion || Math.floor(this.age * 1.9) % 2 === 0) {
      g.fillStyle = C.sky;
      g.fillRect(a.x + pw + ww + 4, y - 2, 15, 32);
    }
    y += 76;
    const r1 = button(g, 'See the work  →', a.x, y, ctx.hover === 'work');
    ctx.regions.add({ id: 'work', rect: r1, onClick: () => ctx.open('work') });
    const r2 = button(g, 'Get in touch', a.x + r1.w + 18, y, ctx.hover === 'contact', 'ghost');
    ctx.regions.add({ id: 'contact', rect: r2, onClick: () => ctx.open('contact') });
    g.restore();

    // photo card
    g.save();
    g.globalAlpha = e2;
    const px = a.x + a.w - 540;
    const py = a.y + 40 + (1 - e2) * 30;
    card(g, px, py, 540, 410, 34);
    g.save();
    rr(g, px + 14, py + 14, 512, 382, 24);
    g.clip();
    if (ctx.photo) {
      const img = ctx.photo;
      const s = Math.max(512 / img.width, 382 / img.height);
      const w = img.width * s;
      const h = img.height * s;
      g.drawImage(img, px + 14 + (512 - w) / 2, py + 14 + (382 - h) / 2, w, h);
    } else {
      g.fillStyle = C.sand;
      g.fillRect(px + 14, py + 14, 512, 382);
    }
    g.restore();
    g.font = font(22, 500);
    g.fillStyle = C.muted;
    g.fillText('Budapest, by the Danube', px + 8, py + 432);
    // hint
    g.font = font(23, 400);
    g.fillStyle = C.faint;
    para(g, 'Pick a folio from the shelf, or use the dock below. Each one opens a chapter.', px + 8, py + 480, 520, { size: 23, color: C.faint, lineH: 32 });
    g.restore();
  }

  describe(): string {
    return `${profile.name}, ${profile.role} at ${profile.org}, Budapest. ${profile.intro} Use the folios or the dock to open a chapter.`;
  }
}
