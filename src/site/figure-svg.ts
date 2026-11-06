// Motion figures (src/shared/figures.ts) as animated SVG for the static page, the way the
// original portfolio drew them: tokens ride SMIL animateMotion paths, one-off entrances are CSS
// animations, colours come from CSS variables so the figures follow light and dark mode.

import { caseFigure, type Anim, type Figure, type Note, type Paint, type Shape, type Theme } from '../shared/figures.ts';

/** The figure palette as CSS variables (defined in site.css for light and dark). */
export const CSS_THEME: Theme = {
  ink: 'var(--fig-ink)',
  tok: 'var(--fig-tok)',
  soft: 'var(--fig-soft)',
  node: 'var(--fig-node)',
  ann: 'var(--fig-ann)',
  red: 'var(--fig-red)',
  axis: 'var(--fig-axis)',
  axis2: 'var(--fig-axis2)',
  fill: 'var(--fig-fill)',
  div: 'var(--fig-div)',
};

const n = (v: number) => String(Math.round(v * 10) / 10);
const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function style(p: Paint, fillOverride?: string): string {
  const parts: string[] = [];
  parts.push(`fill:${fillOverride ?? p.fill ?? 'none'}`);
  if (p.stroke) {
    parts.push(`stroke:${p.stroke}`, `stroke-width:${p.width ?? 1}`);
    if (p.dash) parts.push(`stroke-dasharray:${p.dash.join(' ')}`);
    if (p.strokeOpacity !== undefined) parts.push(`stroke-opacity:${p.strokeOpacity}`);
    if (p.cap) parts.push(`stroke-linecap:${p.cap}`);
  }
  if (p.opacity !== undefined) parts.push(`opacity:${p.opacity}`);
  return parts.join(';');
}

function geometry(s: Exclude<Shape, { k: 'group' }>, fill?: string, extra = ''): string {
  const st = style(s.p, fill);
  switch (s.k) {
    case 'path':
      return `<path d="${s.d}" style="${st}"${extra}/>`;
    case 'circle':
      return `<circle cx="${n(s.x)}" cy="${n(s.y)}" r="${n(s.r)}" style="${st}"${extra}/>`;
    case 'ellipse':
      return `<ellipse cx="${n(s.x)}" cy="${n(s.y)}" rx="${n(s.rx)}" ry="${n(s.ry)}" style="${st}"${extra}/>`;
    case 'rect': {
      const rot = s.rot ? ` transform="rotate(${s.rot} ${n(s.x + s.w / 2)} ${n(s.y + s.h / 2)})"` : '';
      return `<rect x="${n(s.x)}" y="${n(s.y)}" width="${n(s.w)}" height="${n(s.h)}" style="${st}"${rot}${extra}/>`;
    }
  }
}

const loop = (dur: number, begin: number) => `dur="${dur}s" begin="${begin}s" repeatCount="indefinite"`;

function shape(s: Shape): string {
  const a: Anim | undefined = s.a;
  let inner: string;
  if (s.k === 'group') inner = s.kids.map(shape).join('');
  else if (a?.pulse && s.k === 'ellipse') {
    const t = loop(a.pulse.dur, a.pulse.begin);
    return `<ellipse cx="${n(s.x)}" cy="${n(s.y)}" rx="${n(s.rx)}" ry="${n(s.ry)}" style="${style({ ...s.p, strokeOpacity: undefined })};stroke-opacity:0"><animate attributeName="rx" values="${n(s.rx)};${n(a.pulse.to[0])}" ${t}/><animate attributeName="ry" values="${n(s.ry)};${n(a.pulse.to[1])}" ${t}/><animate attributeName="stroke-opacity" values="${a.pulse.opacity};0" ${t}/></ellipse>`;
  } else if (a?.spin) {
    const [cx, cy] = a.spin.centre;
    inner = geometry(s).replace(/\/>$/, `><animateTransform attributeName="transform" type="rotate" from="0 ${n(cx)} ${n(cy)}" to="360 ${n(cx)} ${n(cy)}" dur="${a.spin.dur}s" repeatCount="indefinite"/></${s.k}>`);
  } else if (a?.motion?.recolor && s.k !== 'path') {
    // a second copy in the new colour fades in on top (SMIL cannot animate CSS variables)
    const m = a.motion;
    const r = m.recolor!;
    const t = m.travel ? `${loop(m.dur, m.begin)} keyTimes="0;${n(r.a * m.travel)};${n(r.b * m.travel)};1"` : `${loop(m.dur, m.begin)} keyTimes="0;${r.a};${r.b};1"`;
    inner = geometry(s) + geometry(s, r.to, ` opacity="0"`).replace(/\/>$/, `><animate attributeName="opacity" values="0;0;1;1" ${t}/></${s.k}>`);
  } else inner = geometry(s);

  if (a?.motion) {
    const m = a.motion;
    const path = 'M' + m.path.map((p) => `${n(p[0])},${n(p[1])}`).join(' L');
    const t = loop(m.dur, m.begin);
    if (m.travel) {
      const tr = m.travel;
      return `<g opacity="0"><animateMotion path="${path}" ${t} calcMode="linear" keyPoints="0;1;1" keyTimes="0;${tr};1"/><animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;${(m.fadeIn * tr).toFixed(3)};${(m.fadeOut * tr).toFixed(3)};${tr};1" ${t}/>${inner}</g>`;
    }
    return `<g opacity="0"><animateMotion path="${path}" ${t}/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;${m.fadeIn};${m.fadeOut};1" ${t}/>${inner}</g>`;
  }
  const css: string[] = [];
  if (a?.fade) css.push(`animation:figFade ${a.fade.dur}s ease-out ${a.fade.delay.toFixed(2)}s both`);
  if (a?.pop) css.push(`animation:figPop ${a.pop.dur}s cubic-bezier(.2,.7,.2,1) ${a.pop.delay.toFixed(2)}s both;transform-box:fill-box;transform-origin:center bottom`);
  if (a?.spark) css.push(`animation:figSpark ${a.spark.dur}s ease-out ${a.spark.delay.toFixed(2)}s both`);
  let out = inner;
  if (a?.bob) out = `<g style="animation:figBob ${a.bob.dur}s ease-in-out ${a.bob.delay.toFixed(2)}s infinite">${out}</g>`;
  if (css.length) out = `<g style="${css.join(';')}">${out}</g>`;
  else if (s.k === 'group' && !a?.bob) out = `<g>${out}</g>`;
  return out;
}

function note(t: Note): string {
  const size = t.size ?? 12;
  const anchor = (t.ax ?? 0.5) === 0 ? 'start' : (t.ax ?? 0.5) === 1 ? 'end' : 'middle';
  const ay = t.ay ?? 0.5;
  const baseline = ay === 0 ? 'hanging' : ay === 1 ? 'text-after-edge' : 'central';
  const halo = t.bg ? `;stroke:${t.bg};stroke-width:7px;paint-order:stroke;stroke-linejoin:round` : '';
  return `<text x="${n(t.x)}" y="${n(t.y + (t.dy ?? 0))}" text-anchor="${anchor}" dominant-baseline="${baseline}" class="fig__note" style="font-size:${size}px;fill:${t.color}${halo}">${escAttr(t.text.toUpperCase())}</text>`;
}

export function figureSvg(fig: Figure): string {
  const shapes = fig.shapes.map(shape).join('');
  const notes = fig.notes.map(note).join('');
  return `<svg class="fig__svg" viewBox="0 0 ${fig.w} ${fig.h}" role="img" aria-label="${escAttr(fig.caption)}" overflow="visible">${shapes}${notes}</svg>`;
}

/** The whole figure block for a case: caption, animated drawing, stage labels. */
export function caseFigureHtml(index: number): string {
  const fig = caseFigure(index, CSS_THEME);
  const total = fig.cols.reduce((s, v) => s + v, 0);
  const cols = fig.cols.map((c) => `${((c / total) * 100).toFixed(2)}%`).join(' ');
  const labels = fig.labels
    .map((l) => (l.t ? `<div class="fig__label"><b>${escAttr(l.t)}</b><span>${escAttr(l.d)}</span></div>` : '<div></div>'))
    .join('');
  return `<figure class="fig">
          <figcaption class="fig__caption">${escAttr(fig.caption)}</figcaption>
          ${figureSvg(fig)}
          <div class="fig__labels" style="grid-template-columns:${cols}">${labels}</div>
        </figure>`;
}
