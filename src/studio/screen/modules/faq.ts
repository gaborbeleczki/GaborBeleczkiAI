import { faqs } from '../../../../content/profile.ts';
import { C, MONO, card, easeOut, eyebrow, font, para, rr, title, wrap, type Rect } from '../kit.ts';
import type { ModuleContext } from '../types.ts';
import { BaseModule } from './base.ts';

interface Turn {
  q: number;
  typed: number;
  wait: number;
}

// "ask-gabor": pick a question, it lands as a blue bubble, a typing indicator appears,
// and the answer types itself out in a grey bubble, Messages-style.
export class Faq extends BaseModule {
  readonly id = 'faq' as const;
  readonly title = 'Questions';
  private turns: Turn[] = [];
  private asked = new Set<number>();

  protected onMount(): void {
    if (!this.turns.length) this.ask(0, true);
  }

  private ask(i: number, silent = false): void {
    const instant = this.ctx.reduceMotion;
    this.turns.push({ q: i, typed: instant ? faqs[i].a.length : 0, wait: instant ? 0 : 0.75 });
    if (this.turns.length > 3) this.turns.shift();
    this.asked.add(i);
    if (!silent) this.ctx.announce(`${faqs[i].q} ${faqs[i].a}`);
  }

  protected tick(dt: number): boolean {
    const last = this.turns[this.turns.length - 1];
    let busy = this.animating && this.age < 1;
    if (last) {
      if (last.wait > 0) {
        last.wait -= dt;
        busy = true;
      } else if (last.typed < faqs[last.q].a.length) {
        last.typed = Math.min(faqs[last.q].a.length, last.typed + dt * 95);
        busy = true;
      }
    }
    return busy;
  }

  key(e: KeyboardEvent): boolean {
    const next = [...Array(faqs.length).keys()].find((i) => !this.asked.has(i));
    if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      this.ask(next ?? (this.turns[this.turns.length - 1].q + 1) % faqs.length);
      return true;
    }
    return false;
  }

  draw(g: CanvasRenderingContext2D, a: Rect, ctx: ModuleContext): void {
    const e = easeOut(this.enter(0, 0.6));
    const listW = 560;
    g.save();
    g.globalAlpha = e;
    eyebrow(g, '06', 'Recruiter FAQ', a.x, a.y + 10);
    title(g, 'Questions AI teams ask', a.x, a.y + 66, 44, C.ink, listW);
    let y = a.y + 136;
    faqs.forEach((f, i) => {
      const hov = ctx.hover === `q:${i}`;
      const done = this.asked.has(i);
      g.font = font(20, done ? 500 : 550);
      const lines = wrap(g, f.q, listW - 70);
      const h = 18 + lines.length * 25;
      if (y + h > a.y + a.h) return;
      rr(g, a.x, y, listW, h, 16);
      g.fillStyle = hov ? 'rgba(42,93,143,0.10)' : done ? 'rgba(29,29,31,0.03)' : '#FFFFFF';
      g.fill();
      if (!done) {
        g.strokeStyle = 'rgba(29,29,31,0.10)';
        g.lineWidth = 1.5;
        g.stroke();
      }
      g.fillStyle = done ? C.faint : C.link;
      g.font = font(18, 600, MONO);
      g.fillText(done ? '✓' : '?', a.x + 18, y + 10);
      g.font = font(20, done ? 500 : 550);
      g.fillStyle = done ? C.muted : C.ink;
      lines.forEach((l, k) => g.fillText(l, a.x + 50, y + 9 + k * 25));
      ctx.regions.add({ id: `q:${i}`, rect: { x: a.x, y, w: listW, h }, label: f.q, onClick: () => this.ask(i) });
      y += h + 7;
    });
    g.restore();

    // Messages panel
    const px = a.x + listW + 50;
    const pw = a.x + a.w - px;
    g.save();
    g.globalAlpha = e;
    card(g, px, a.y + 10, pw, a.h - 10, 30);
    g.font = font(19, 500, MONO);
    g.fillStyle = C.faint;
    g.fillText(`ask-gabor · ${this.asked.size}/${faqs.length} answered`, px + 32, a.y + 36);
    g.fillStyle = C.line;
    g.fillRect(px, a.y + 76, pw, 1.5);
    // lay out bubbles bottom-up so the newest is always visible
    const maxBubble = pw * 0.72;
    const blocks: { side: 'me' | 'him'; lines: string[]; typing?: boolean }[] = [];
    for (const t of this.turns) {
      g.font = font(23, 500);
      blocks.push({ side: 'me', lines: wrap(g, faqs[t.q].q, maxBubble - 44) });
      if (t.wait > 0) blocks.push({ side: 'him', lines: [''], typing: true });
      else {
        g.font = font(23, 400);
        const full = wrap(g, faqs[t.q].a, maxBubble - 44);
        let remaining = Math.floor(t.typed);
        const shown: string[] = [];
        for (const l of full) {
          if (remaining <= 0) break;
          shown.push(l.slice(0, remaining));
          remaining -= l.length + 1;
        }
        blocks.push({ side: 'him', lines: shown.length ? shown : [''] });
      }
    }
    let by = a.y + a.h - 34;
    g.save();
    rr(g, px, a.y + 78, pw, a.h - 88, 0);
    g.clip();
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      const lh = 31;
      g.font = font(23, b.side === 'me' ? 500 : 400);
      const textW = b.typing ? 70 : Math.max(...b.lines.map((l) => g.measureText(l).width));
      const bw = textW + 44;
      const bh = b.lines.length * lh + 26;
      by -= bh;
      const bx = b.side === 'me' ? px + pw - 32 - bw : px + 32;
      rr(g, bx, by, bw, bh, 24);
      g.fillStyle = b.side === 'me' ? C.bubble : C.bubbleGray;
      g.fill();
      if (b.typing) {
        for (let k = 0; k < 3; k++) {
          const p = ctx.reduceMotion ? 0.5 : (Math.sin(this.age * 6 - k * 0.8) + 1) / 2;
          g.beginPath();
          g.arc(bx + 22 + k * 16, by + bh / 2, 5, 0, Math.PI * 2);
          g.fillStyle = `rgba(110,110,115,${0.35 + 0.5 * p})`;
          g.fill();
        }
      } else {
        g.fillStyle = b.side === 'me' ? '#FFFFFF' : C.ink;
        b.lines.forEach((l, k) => g.fillText(l, bx + 22, by + 14 + k * lh));
      }
      if (b.side === 'him' && !b.typing) {
        g.font = font(16, 500);
        g.fillStyle = C.faint;
        g.fillText('Gábor', bx + 6, by - 22);
        by -= 22;
      }
      by -= 18;
      if (by < a.y + 90) break;
    }
    g.restore();
    g.restore();
  }

  describe(): string {
    const t = this.turns[this.turns.length - 1];
    return `Recruiter questions. ${t ? `${faqs[t.q].q} ${faqs[t.q].a}` : ''} Press Enter for the next question.`;
  }
}
