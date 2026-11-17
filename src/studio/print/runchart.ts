// The training log's chart: weekly kilometres as bars, the long run inside each bar, the
// start of the plan, and a few notes in the margin. Drawn for print (a page canvas).

import { run } from '../../../content/running.ts';
import { MONO } from '../screen/kit.ts';
import { HAND, type Theme } from './print.ts';

export function drawRunWeeks(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, theme: Theme, k: number): void {
  const s = (n: number) => Math.round(n * Math.min(k, 1.5));
  const weeks = run.weeks;
  const padL = s(64);
  const padR = s(26);
  const padT = s(68);
  const padB = s(62);
  const px = x + padL;
  const py = y + padT;
  const pw = w - padL - padR;
  const ph = h - padT - padB;
  const max = 80;
  const Y = (km: number) => py + ph - (km / max) * ph;
  g.textBaseline = 'middle';
  // grid
  g.font = `500 ${s(17)}px ${MONO}`;
  for (let km = 0; km <= max; km += 20) {
    g.fillStyle = km === 0 ? theme.ink2 : theme.rule;
    g.fillRect(px, Math.round(Y(km)), pw, km === 0 ? 2 : 1.5);
    g.fillStyle = theme.muted;
    g.textAlign = 'right';
    g.fillText(`${km}`, px - s(12), Y(km));
  }
  g.textAlign = 'left';
  g.fillText('km / week', x + s(18), y + s(30));
  // legend
  const lx = x + w - padR - s(330);
  g.fillStyle = theme.accent;
  g.fillRect(lx, y + s(22), s(18), s(16));
  g.fillStyle = theme.muted;
  g.fillText('the week', lx + s(26), y + s(30));
  g.fillStyle = '#1D2D3D';
  g.fillRect(lx + s(138), y + s(22), s(18), s(16));
  g.fillStyle = theme.muted;
  g.fillText('its long run', lx + s(164), y + s(30));
  // the plan's span
  const step = pw / weeks.length;
  const x0 = px + step * run.planFrom;
  g.fillStyle = 'rgba(210,80,42,0.07)';
  g.fillRect(x0, py - s(8), px + pw - x0, ph + s(8));
  g.fillStyle = theme.accent;
  g.fillRect(x0, py - s(8), 2, ph + s(8));
  g.font = `600 ${s(16)}px ${MONO}`;
  g.fillText('THE PLAN STARTS', x0 + s(10), py + s(4));
  // bars
  const bw = step * 0.66;
  weeks.forEach((wk, i) => {
    const bx = px + step * i + (step - bw) / 2;
    g.fillStyle = theme.accent;
    g.globalAlpha = i >= run.planFrom ? 1 : 0.55;
    g.fillRect(bx, Y(wk.km), bw, Y(0) - Y(wk.km));
    g.fillStyle = '#1D2D3D';
    g.fillRect(bx + bw * 0.2, Y(wk.long), bw * 0.6, Y(0) - Y(wk.long));
    g.globalAlpha = 1;
    if (i % 3 === 0 || i === weeks.length - 1) {
      g.fillStyle = theme.muted;
      g.font = `500 ${s(15)}px ${MONO}`;
      g.textAlign = 'center';
      g.fillText(wk.label, bx + bw / 2, Y(0) + s(22));
    }
  });
  g.textAlign = 'left';
  // notes in the margin, by hand
  const note = (i: number, text: string, dx: number, dy: number, align: CanvasTextAlign = 'left') => {
    const wk = weeks[i];
    const bx = px + step * i + step / 2;
    const by = Y(wk.km) - s(6);
    const tx = bx + s(dx);
    const ty = by + s(dy);
    g.strokeStyle = '#2A4058';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(bx, by);
    g.quadraticCurveTo((bx + tx) / 2 + s(6), by - s(8), tx, ty + s(12));
    g.stroke();
    g.fillStyle = '#2A4058';
    g.font = `600 ${s(26)}px ${HAND}`;
    g.textAlign = align;
    g.textBaseline = 'alphabetic';
    text.split('\n').forEach((line, li) => g.fillText(line, tx, ty + li * s(24)));
    g.textBaseline = 'middle';
    g.textAlign = 'left';
  };
  note(5, 'the week the dashboard\ndoes not mention', -6, -92, 'center');
  note(12, 'relay: 22.7 km\nat 4:24/km', -78, -70, 'center');
  note(17, '30 km. At night.\nOn purpose.', -150, -34, 'center');
  // the target, as a line nobody has reached yet
  g.setLineDash([s(8), s(7)]);
  g.strokeStyle = theme.muted;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(px, Y(76));
  g.lineTo(px + step * 9.4, Y(76));
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = theme.muted;
  g.font = `500 ${s(15)}px ${MONO}`;
  g.fillText('PEAK WEEKS STILL TO COME', px + s(6), Y(76) - s(14));
}
