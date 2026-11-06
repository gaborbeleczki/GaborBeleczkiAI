import { duties, kpis, profile } from '../../../../content/profile.ts';
import { mount as mountGame, type GameApi, type GameDuty } from '../game/roleGame.js';
import { C, MONO, button, card, easeOut, eyebrow, font, inRect, para, rr, segmented, setTracking, title, type Rect } from '../kit.ts';
import type { ModuleContext } from '../types.ts';
import { BaseModule } from './base.ts';

function parseCount(v: string): { n: number; fmt: (x: number) => string } | null {
  const m = /^([\d,]+)(.*)$/.exec(v);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  const suffix = m[2];
  return { n, fmt: (x) => Math.round(x).toLocaleString('en-US') + suffix };
}

// the duties as the original game knows them: a glyph each, placed on the role map
const SHAPES: GameDuty['s'][] = ['circle', 'diamond', 'hex', 'square', 'tri'];
const SPOTS: [number, number][] = [[175, 199], [500, 66], [825, 199], [701, 413], [299, 413]];
const GAME_DUTIES: GameDuty[] = duties.map((d, i) => ({ n: d.n, t: d.title, d: d.text, s: SHAPES[i % 5], x: SPOTS[i % 5][0], y: SPOTS[i % 5][1] }));

const GAME_W = 1440;
const GAME_H = 560;

export class Role extends BaseModule {
  readonly id = 'role' as const;
  readonly title = 'Role';
  private duty = 0;
  private view: 'role' | 'play' = 'role';
  private game: GameApi | null = null;
  private gameCanvas: HTMLCanvasElement | null = null;
  private held = new Set<'left' | 'right' | 'jump'>();
  private pads: { k: 'left' | 'right' | 'jump'; r: Rect }[] = [];
  private viewport: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private attended = false;

  get fps(): number {
    return this.view === 'play' ? 60 : 30;
  }

  protected tick(dt: number): boolean {
    if (this.view === 'play' && this.game) {
      this.game.tick(dt);
      return true;
    }
    return this.animating && this.age < 2.2;
  }

  protected onUnmount(): void {
    this.game?.destroy();
    this.game = null;
    this.view = 'role';
  }

  attention(on: boolean): void {
    this.attended = on;
    if (!on) this.game?.pause();
  }

  private setView(v: 'role' | 'play'): void {
    if (v === this.view) return;
    this.view = v;
    if (v === 'play') {
      if (!this.game) {
        this.gameCanvas = document.createElement('canvas');
        this.game = mountGame(null, {
          duties: GAME_DUTIES,
          reduce: this.ctx.reduceMotion,
          canvas: this.gameCanvas,
          size: { w: GAME_W, h: GAME_H },
          manual: true,
          onCollect: (i) => this.ctx.announce(`Deliverable ${duties[i].n}: ${duties[i].title}.`),
          onPhase: (ph, st) => {
            if (ph === 'won') this.ctx.announce(`Strategy delivered. ${st.got} of 5 deliverables, ${st.coins} use cases, ${st.stomps} blockers cleared, in ${st.time}.`);
            if (ph === 'over') this.ctx.announce('Out of lives. Press Enter to try again.');
          },
        });
      }
      this.ctx.announce('A day in the role: a platformer. Arrow keys to move, Space to jump, Shift to run, Enter to start.');
    } else this.game?.pause();
  }

  /** QA hook: the game's phase and the player's position. */
  debug(): { phase: string; x: number } | null {
    return this.game ? { phase: this.game.phase, x: this.game.player().x } : null;
  }

  keyUp(e: KeyboardEvent): boolean {
    if (this.view !== 'play' || !this.game) return false;
    return this.game.key(e, false);
  }

  pointer(x: number, y: number, type: 'move' | 'down' | 'up' | 'leave'): boolean {
    if (this.view !== 'play' || !this.game) return false;
    if (type === 'down') {
      const pad = this.pads.find((p) => inRect(x, y, p.r));
      if (pad) {
        if (this.game.phase !== 'playing') this.game.start();
        this.held.add(pad.k);
        this.game.press(pad.k, true);
        return true;
      }
      // a tap on the game itself starts or resumes it
      if (inRect(x, y, this.viewport) && this.game.phase !== 'playing') {
        if (this.game.phase === 'paused') this.game.resume();
        else this.game.start();
        return true;
      }
    }
    if (type === 'up' || type === 'leave') {
      for (const k of this.held) this.game.press(k, false);
      const had = this.held.size > 0;
      this.held.clear();
      return had;
    }
    return false;
  }

  key(e: KeyboardEvent): boolean {
    if (this.view === 'play' && this.game) {
      if (this.game.key(e, true)) return true;
      if (e.key === 'Tab') return false;
    }
    if (e.key === 'g' || e.key === 'G') {
      this.setView(this.view === 'play' ? 'role' : 'play');
      return true;
    }
    if (this.view === 'play') return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') this.duty = (this.duty + 1) % duties.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') this.duty = (this.duty + duties.length - 1) % duties.length;
    else return false;
    this.ctx.announce(`${duties[this.duty].title}. ${duties[this.duty].text}`);
    return true;
  }

  draw(g: CanvasRenderingContext2D, a: Rect, ctx: ModuleContext): void {
    // Role | A day in the role
    const hov = ctx.hover === 'tab:role' ? 0 : ctx.hover === 'tab:play' ? 1 : -1;
    g.save();
    g.globalAlpha = easeOut(this.enter(0, 0.7));
    const tabs = segmented(g, ['The role', 'A day in the role ▸'], this.view === 'role' ? 0 : 1, a.x + a.w - 404, a.y + 4, hov, 18);
    g.restore();
    ctx.regions.add({ id: 'tab:role', rect: tabs[0], label: 'The role', onClick: () => this.setView('role') });
    ctx.regions.add({ id: 'tab:play', rect: tabs[1], label: 'Play: a day in the role', onClick: () => this.setView('play') });
    if (this.view === 'play') this.drawPlay(g, a, ctx);
    else this.drawRole(g, a, ctx);
  }

  private drawPlay(g: CanvasRenderingContext2D, a: Rect, ctx: ModuleContext): void {
    const game = this.game;
    if (!game || !this.gameCanvas) return;
    eyebrow(g, '02', 'A day in the role', a.x, a.y + 10);
    const st = game.stats();
    // HUD: deliverables, use cases, time
    let hx = a.x + 330;
    const hy = a.y + 14;
    g.font = font(18, 600);
    g.fillStyle = C.muted;
    g.fillText('Deliverables', hx, hy);
    hx += 122;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.arc(hx + i * 26, hy + 11, 8, 0, Math.PI * 2);
      g.fillStyle = i < st.got ? C.lingon : 'rgba(29,29,31,0.12)';
      g.fill();
    }
    hx += 150;
    g.fillStyle = C.muted;
    g.fillText(`Use cases ${String(st.coins).padStart(3, '0')}`, hx, hy);
    g.fillText(`Blockers cleared ${st.stomps}`, hx + 170, hy);
    g.font = font(18, 600, MONO);
    g.fillText(st.time, hx + 380, hy);
    // the game
    const v: Rect = { x: a.x, y: a.y + 62, w: a.w, h: (a.w * GAME_H) / GAME_W };
    this.viewport = v;
    g.save();
    rr(g, v.x, v.y, v.w, v.h, 22);
    g.clip();
    g.drawImage(this.gameCanvas, v.x, v.y, v.w, v.h);
    // phase overlays
    const ph = game.phase;
    if (ph === 'ready' || ph === 'paused' || ph === 'over' || ph === 'won') {
      g.fillStyle = 'rgba(246,244,239,0.82)';
      g.fillRect(v.x, v.y, v.w, v.h);
      const cx = v.x + v.w / 2;
      g.textAlign = 'center';
      const head = ph === 'ready' ? 'A day in the role' : ph === 'paused' ? 'Paused' : ph === 'over' ? 'Out of lives' : 'Strategy delivered';
      title(g, head, cx, v.y + v.h / 2 - 120, 60, C.ink, 1000);
      g.textAlign = 'center';
      const sub =
        ph === 'ready'
          ? 'Collect the five deliverables, stomp the blockers, reach End User AI Strategy HQ.'
          : ph === 'paused'
            ? 'Take your time.'
            : ph === 'over'
              ? `${st.got} of 5 deliverables, ${st.coins} use cases. The pilots will wait.`
              : `${st.got} of 5 deliverables · ${st.coins} use cases · ${st.stomps} blockers cleared · ${st.time}`;
      g.font = font(24, 500);
      g.fillStyle = C.muted;
      g.fillText(sub, cx, v.y + v.h / 2 - 34);
      g.textAlign = 'left';
      const label = ph === 'ready' ? 'Start' : ph === 'paused' ? 'Resume' : 'Play again';
      g.font = font(26, 500);
      const bw = g.measureText(label).width + 56;
      const b = button(g, label, cx - bw / 2, v.y + v.h / 2 + 18, ctx.hover === 'game:go');
      ctx.regions.add({ id: 'game:go', rect: b, label, onClick: () => (ph === 'paused' ? game.resume() : game.start()) });
      g.font = font(18, 500, MONO);
      g.fillStyle = C.faint;
      g.textAlign = 'center';
      g.fillText('← →  move    Space  jump    Shift  run    Enter  start    Esc  leave', cx, v.y + v.h - 46);
      g.textAlign = 'left';
    }
    g.restore();
    // touch pads under the game
    const py = v.y + v.h + 16;
    const size = 64;
    this.pads = [
      { k: 'left', r: { x: a.x, y: py, w: size * 1.4, h: size } },
      { k: 'right', r: { x: a.x + size * 1.4 + 14, y: py, w: size * 1.4, h: size } },
      { k: 'jump', r: { x: a.x + a.w - size * 2.2, y: py, w: size * 2.2, h: size } },
    ];
    for (const p of this.pads) {
      rr(g, p.r.x, p.r.y, p.r.w, p.r.h, p.r.h / 2);
      g.fillStyle = this.held.has(p.k) ? 'rgba(29,45,61,0.16)' : 'rgba(29,29,31,0.06)';
      g.fill();
      g.font = font(24, 650);
      g.fillStyle = C.ink2;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(p.k === 'left' ? '◀' : p.k === 'right' ? '▶' : 'Jump', p.r.x + p.r.w / 2, p.r.y + p.r.h / 2 + 1);
      g.textAlign = 'left';
      g.textBaseline = 'top';
    }
    g.font = font(17, 500);
    g.fillStyle = C.faint;
    g.fillText('From the original portfolio: the platformer, now on the studio display.', a.x + size * 2.8 + 50, py + 22);
    if (!this.attended && game.phase === 'playing') game.pause();
  }

  private drawRole(g: CanvasRenderingContext2D, a: Rect, ctx: ModuleContext): void {
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

    // KPI bento on the right (below the tabs)
    const bx = a.x + leftW + 70;
    const bw = a.x + a.w - bx;
    const colW = (bw - 18) / 2;
    const rowH = 172;
    const top = a.y + 74;
    const rowH2 = 150;
    const cells: Rect[] = [
      { x: bx, y: top, w: bw, h: rowH2 + 20 },
      { x: bx, y: top + rowH2 + 38, w: colW, h: rowH2 },
      { x: bx + colW + 18, y: top + rowH2 + 38, w: colW, h: rowH2 },
      { x: bx, y: top + 2 * rowH2 + 56, w: colW, h: rowH2 },
      { x: bx + colW + 18, y: top + 2 * rowH2 + 56, w: colW, h: rowH2 },
    ];
    void rowH;
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
      const numSize = ink ? 76 : 54;
      const lift = (1 - ce) * 20;
      g.font = font(numSize, 700);
      setTracking(g, ink ? -3 : -2);
      g.fillStyle = ink ? '#FFFFFF' : C.ink;
      g.fillText(shown, r.x + 28, r.y + 20 + lift);
      setTracking(g, 0);
      para(g, k.label, r.x + 28, r.y + 30 + numSize + lift, r.w - 48, { size: ink ? 22 : 17, color: ink ? '#B9C9D9' : C.muted, lineH: ink ? 27 : 21, maxLines: 2 });
      g.restore();
    });
    g.font = font(18, 500, MONO);
    g.fillStyle = C.faint;
    g.fillText('Morgan Stanley Finance · AI programmes', bx, a.y + a.h - 6);
  }

  describe(): string {
    if (this.view === 'play') return 'A day in the role: a platformer from the original portfolio. Collect the five deliverables, stomp the blockers and reach the HQ. Arrow keys to move, Space to jump, Shift to run, Enter to start, G to go back to the role.';
    return `${profile.role}, ${profile.org} ${profile.orgUnit}, ${profile.roleSince}. ${profile.roleSummary} Numbers: ${kpis.map((k) => `${k.value} ${k.label}`).join('; ')}.`;
  }
}
