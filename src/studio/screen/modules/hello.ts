import { profile } from '../../../../content/profile.ts';
import { C, MONO, button, card, easeOut, eyebrow, font, para, rr, title, type Rect } from '../kit.ts';
import type { ModuleContext } from '../types.ts';
import { BaseModule } from './base.ts';

export class Hello extends BaseModule {
  readonly id = 'hello' as const;
  readonly title = 'Hello';
  // the terminal line holds still: it used to type, delete and blink, which read as flicker
  protected tick(): boolean {
    return this.age < 2.5; // the entrance, then nothing to redraw
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
    // as many of the tools as fit on the line, still
    let words = '';
    for (const w of profile.workingWith) {
      const next = words ? `${words} · ${w}` : w;
      if (g.measureText(next).width > leftW - pw) break;
      words = next;
    }
    g.fillStyle = C.ink;
    g.fillText(words, a.x + pw, y);
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
    g.fillText('The AI Program Manager, as the legend tells it', px + 8, py + 432);
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
