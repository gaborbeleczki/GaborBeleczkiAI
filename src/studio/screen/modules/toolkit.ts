import { toolGroups, tools } from '../../../../content/profile.ts';
import { C, MONO, easeOut, eyebrow, font, rr, setTracking, title, type Rect } from '../kit.ts';
import type { ModuleContext } from '../types.ts';
import { BaseModule } from './base.ts';

const STYLE: Record<string, { fill: string; ink: string; sub: string; stroke?: string }> = {
  a: { fill: '#1D2D3D', ink: '#F5F5F7', sub: '#A9BED3' },
  k: { fill: '#D6EBFF', ink: '#1D2D3D', sub: '#416180' },
  d: { fill: '#FFFFFF', ink: '#1D1D1F', sub: '#6E6E73', stroke: 'rgba(29,29,31,0.14)' },
};

export class Toolkit extends BaseModule {
  readonly id = 'toolkit' as const;
  readonly title = 'Toolkit';

  protected tick(): boolean {
    return this.animating && this.age < 2;
  }

  draw(g: CanvasRenderingContext2D, a: Rect, ctx: ModuleContext): void {
    const e = easeOut(this.enter(0, 0.6));
    g.save();
    g.globalAlpha = e;
    eyebrow(g, '05', 'Toolkit', a.x, a.y + 10);
    title(g, 'Hands-on with', a.x, a.y + 66, 64);
    g.font = font(20, 500, MONO);
    g.fillStyle = C.faint;
    g.textAlign = 'right';
    g.fillText('Fig. 07 · Periodic table of tools', a.x + a.w, a.y + 92);
    g.textAlign = 'left';
    g.restore();

    const size = 150;
    const gap = 14;
    let y = a.y + 176;
    let idx = 0;
    for (const grp of toolGroups) {
      const items = tools.filter((t) => t.group === grp.id);
      const ge = easeOut(this.enter(0.1 + idx * 0.05, 0.5));
      g.save();
      g.globalAlpha = ge;
      g.font = font(20, 600);
      g.fillStyle = C.muted;
      g.fillText(grp.name, a.x, y);
      g.restore();
      y += 34;
      items.forEach((t, i) => {
        const te = easeOut(this.enter(0.15 + (idx + i) * 0.035, 0.45));
        const st = STYLE[t.group];
        const hov = ctx.hover === `el:${t.sym}`;
        const x = a.x + i * (size + gap);
        const yy = y + (1 - te) * 20 - (hov ? 8 : 0);
        g.save();
        g.globalAlpha = te;
        g.shadowColor = 'rgba(29,45,61,0.14)';
        g.shadowBlur = hov ? 26 : 14;
        g.shadowOffsetY = hov ? 10 : 4;
        rr(g, x, yy, size, size, 22);
        g.fillStyle = st.fill;
        g.fill();
        g.restore();
        if (st.stroke) {
          rr(g, x, yy, size, size, 22);
          g.strokeStyle = st.stroke;
          g.lineWidth = 1.5;
          g.stroke();
        }
        g.save();
        g.globalAlpha = te;
        g.font = font(17, 500, MONO);
        g.fillStyle = st.sub;
        g.fillText(String(idx + i + 1).padStart(2, '0'), x + 16, yy + 14);
        g.font = font(54, 700);
        setTracking(g, -2);
        g.fillStyle = st.ink;
        g.fillText(t.sym, x + 16, yy + 40);
        setTracking(g, 0);
        g.font = font(17, 500);
        g.fillStyle = st.sub;
        const words = t.name.split(' ');
        const line1 = words.length > 2 ? words.slice(0, 2).join(' ') : t.name;
        g.fillText(line1, x + 16, yy + size - 40);
        if (words.length > 2) g.fillText(words.slice(2).join(' '), x + 16, yy + size - 20);
        g.restore();
        ctx.regions.add({ id: `el:${t.sym}`, rect: { x, y, w: size, h: size }, label: t.name, cursor: 'default' });
      });
      y += size + 36;
      idx += items.length;
    }
  }

  describe(): string {
    return toolGroups.map((grp) => `${grp.name}: ${tools.filter((t) => t.group === grp.id).map((t) => t.name).join(', ')}.`).join(' ');
  }
}
