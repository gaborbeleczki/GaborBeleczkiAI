// Motion figures for the case studies, ported from the original portfolio's SVG animations.
// Each figure is a small scene (shapes, moving tokens, annotations) described once and drawn
// two ways: on a canvas for the studio's display (figure-canvas.ts) and as animated SVG for the
// static page (figure-svg.ts). Coordinates are in a 640-unit wide box, like the originals.

export type Pt = [number, number];

export interface Paint {
  fill?: string;
  stroke?: string;
  width?: number;
  dash?: number[];
  opacity?: number;
  strokeOpacity?: number;
  cap?: 'round' | 'butt';
}

/** A token travelling a path, fading in and out at the ends (SMIL animateMotion in the original). */
export interface Motion {
  path: Pt[];
  dur: number;
  begin: number;
  /** opacity key times: in, out (fractions of the loop) */
  fadeIn: number;
  fadeOut: number;
  /** optional colour change along the way: from colour, to colour, between fractions a..b */
  recolor?: { to: string; a: number; b: number };
  /** move during the first `travel` of each loop, then stay hidden until the next one */
  travel?: number;
}

export interface Anim {
  motion?: Motion;
  /** fade in once */
  fade?: { delay: number; dur: number };
  /** pop in once (scale from the bottom centre, with a little overshoot) */
  pop?: { delay: number; dur: number; origin: Pt };
  /** bob up and down forever */
  bob?: { delay: number; dur: number; amp: number };
  /** rise a little and fade in, then out */
  spark?: { delay: number; dur: number };
  /** ellipse growing from (rx, ry) to (rx2, ry2) while fading out, forever */
  pulse?: { dur: number; begin: number; to: [number, number]; opacity: number };
  /** rotate forever about a centre */
  spin?: { dur: number; centre: Pt };
}

export type Shape =
  | { k: 'path'; d: string; p: Paint; a?: Anim }
  | { k: 'circle'; x: number; y: number; r: number; p: Paint; a?: Anim }
  | { k: 'rect'; x: number; y: number; w: number; h: number; p: Paint; rot?: number; a?: Anim }
  | { k: 'ellipse'; x: number; y: number; rx: number; ry: number; p: Paint; a?: Anim }
  | { k: 'group'; kids: Shape[]; a?: Anim };

export interface Note {
  /** position in figure units */
  x: number;
  y: number;
  text: string;
  color: string;
  /** a background chip behind the text (cuts the lines under it) */
  bg?: string;
  /** anchor: 0 = left, 0.5 = centre, 1 = right */
  ax?: number;
  /** vertical anchor: 0 = top, 0.5 = middle, 1 = bottom */
  ay?: number;
  dy?: number;
  size?: number;
}

export interface Figure {
  id: string;
  caption: string;
  w: number;
  h: number;
  shapes: Shape[];
  notes: Note[];
  /** stage labels under the figure, with relative column widths */
  labels: { t: string; d: string }[];
  cols: number[];
}

export interface Theme {
  ink: string;
  tok: string;
  soft: string;
  node: string;
  ann: string;
  red: string;
  axis: string;
  axis2: string;
  fill: string;
  div: string;
}

export const LIGHT: Theme = {
  ink: '#416180',
  tok: '#5980a6',
  soft: '#94bce3',
  node: '#FFFFFF',
  ann: '#5d5d60',
  red: '#c8432b',
  axis: 'rgba(29,31,32,0.25)',
  axis2: 'rgba(29,31,32,0.3)',
  fill: 'rgba(89,128,166,0.07)',
  div: 'rgba(65,97,128,0.35)',
};

// ------------------------------------------------------------------------------ helpers

const f1 = (n: number) => Math.round(n * 10) / 10;

/** Parse the subset of SVG path syntax the figures use (M, L, H, V; absolute). */
export function polyline(d: string): Pt[] {
  const pts: Pt[] = [];
  const tok = d.match(/[MLHV]|-?\d*\.?\d+/g) ?? [];
  let cmd = 'M';
  let x = 0;
  let y = 0;
  for (let i = 0; i < tok.length; ) {
    const t = tok[i];
    if (/[MLHV]/.test(t)) {
      cmd = t;
      i++;
      continue;
    }
    if (cmd === 'H') x = Number(tok[i++]);
    else if (cmd === 'V') y = Number(tok[i++]);
    else {
      x = Number(tok[i++]);
      y = Number(tok[i++]);
    }
    pts.push([x, y]);
  }
  return pts;
}

export const pathOf = (pts: Pt[]) => 'M' + pts.map((p) => `${f1(p[0])},${f1(p[1])}`).join(' L');

/** Point at fraction f of a polyline, by length. */
export function along(pts: Pt[], f: number): Pt {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let d = Math.max(0, Math.min(1, f)) * total;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d <= l || i === pts.length - 1) {
      const t = l > 0 ? Math.min(1, d / l) : 0;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
    }
    d -= l;
  }
  return pts[pts.length - 1];
}

function lcg(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// ------------------------------------------------------------------------------ 01 · governed route

function gov(T: Theme, H = 180): Figure {
  const k = H / 130;
  const y = H / 2;
  const tY = y - 42 * k;
  const bY = y + 44 * k;
  const sc = Math.max(1, Math.min(1.6, 0.55 + 0.45 * k));
  const rN = 20 * sc;
  const dN = 24 * sc;
  const X = [80, 240, 400, 560];
  const q = 4 * sc;
  const tok = (d: string, dur: number, begin: number, c: string): Shape => ({
    k: 'rect',
    x: -q,
    y: -q,
    w: 2 * q,
    h: 2 * q,
    p: { fill: c },
    a: { motion: { path: polyline(d), dur, begin, fadeIn: 0.06, fadeOut: 0.94 } },
  });
  const main = `M${X[0]},${y} H${X[3]}`;
  const rev = `M${X[0]},${y} H${X[1]} V${bY} H${X[0]} V${y}`;
  const reuse = `M${X[3]},${y} V${tY} H${X[0]} V${y}`;
  const node = (x: number, i: number): Shape => {
    const s = (v: number) => v * sc;
    const icon: Shape[] = [
      [{ k: 'path', d: `M${x - s(6)},${y} H${x + s(6)} M${x},${y - s(6)} V${y + s(6)}`, p: { stroke: T.ink, width: 1.5 * sc } } as Shape],
      [{ k: 'circle', x, y, r: s(3.5), p: { fill: T.ink } } as Shape],
      [{ k: 'path', d: `M${x - s(7)},${y} L${x - s(2)},${y + s(5)} L${x + s(7)},${y - s(5)}`, p: { stroke: T.ink, width: 1.8 * sc } } as Shape],
      [
        { k: 'circle', x, y, r: s(8), p: { stroke: T.ink, width: 1.5 * sc } } as Shape,
        { k: 'circle', x, y, r: s(2.5), p: { fill: T.ink } } as Shape,
      ],
    ][i];
    const body: Shape =
      i === 1
        ? { k: 'rect', x: x - s(17), y: y - s(17), w: s(34), h: s(34), rot: 45, p: { fill: T.node, stroke: T.ink, width: 1.5 * sc } }
        : { k: 'circle', x, y, r: s(20), p: { fill: T.node, stroke: T.ink, width: 1.5 * sc } };
    return { k: 'group', kids: [body, ...icon] };
  };
  const arrow = (yTip: number, dir: number, c: string): Shape => ({
    k: 'path',
    d: `M${X[0] - 5 * sc},${yTip - dir * 8 * sc} L${X[0] + 5 * sc},${yTip - dir * 8 * sc} L${X[0]},${yTip} Z`,
    p: { fill: c },
  });
  return {
    id: 'gov',
    caption: 'Fig. 05 · One governed route',
    w: 640,
    h: H,
    shapes: [
      { k: 'path', d: `M${X[3]},${y - rN} V${tY} H${X[0]} V${y - rN - 2}`, p: { stroke: T.soft, width: 1.5, dash: [4, 5] } },
      arrow(y - rN - 1, 1, T.soft),
      { k: 'path', d: `M${X[1]},${y + dN} V${bY} H${X[0]} V${y + rN + 2}`, p: { stroke: T.red, strokeOpacity: 0.7, width: 1.5, dash: [4, 5] } },
      arrow(y + rN + 1, -1, T.red),
      { k: 'path', d: main, p: { stroke: T.ink, width: 1.5 } },
      tok(main, 4.5, 0, T.tok),
      tok(main, 4.5, -1.5, T.tok),
      tok(main, 4.5, -3, T.tok),
      tok(rev, 4, -0.8, T.red),
      tok(reuse, 5, -2.2, T.soft),
      ...X.map(node),
    ],
    notes: [
      { x: 320, y: tY, text: 'Shared for reuse', color: T.ink, bg: T.node },
      { x: 160, y: bY, text: 'Returned for revision', color: T.red, bg: T.node },
    ],
    labels: [
      { t: 'Submit', d: 'One front door for intake' },
      { t: 'Assess', d: 'Risk reviewed against responsible-AI standards' },
      { t: 'Approve', d: 'Cleared, or returned for revision' },
      { t: 'Reuse', d: 'Shared so others build on it' },
    ],
    cols: [1, 1, 1, 1],
  };
}

// ------------------------------------------------------------------------------ 02 · use-case funnel

function funnel(T: Theme, H = 180): Figure {
  const W = 640;
  const m = H / 2;
  const k = (H / 2 - 7) / 68;
  const hh = (x: number) => (14 + 54 * Math.pow(1 - x / W, 1.5)) * k;
  const mult = Math.max(1, Math.round(k * 0.9));
  const rr = Math.min(1.6, 0.7 + 0.3 * k);
  const rnd = lcg(11);
  const xs: number[] = [];
  for (let x = 0; x <= W; x += 16) xs.push(x);
  const top = xs.map((x): Pt => [x, m - hh(x)]);
  const bot = xs.map((x): Pt => [x, m + hh(x)]);
  const shapes: Shape[] = [
    { k: 'path', d: pathOf(top.concat(bot.slice().reverse())) + ' Z', p: { fill: T.fill } },
    { k: 'path', d: pathOf(top), p: { stroke: T.ink, width: 1.2 } },
    { k: 'path', d: pathOf(bot), p: { stroke: T.ink, width: 1.2 } },
    ...[160, 320, 480].map((x): Shape => ({ k: 'path', d: `M${x},${f1(m - hh(x))} V${f1(m + hh(x))}`, p: { stroke: T.div, dash: [3, 4] } })),
  ];
  const ends = ([] as number[]).concat(Array(8 * mult).fill(160), Array(6 * mult).fill(320), Array(5 * mult).fill(480), Array(7 * mult).fill(640));
  ends.forEach((end) => {
    const u = rnd() * 1.7 - 0.85;
    const pass = end === W;
    const dur = 1 + (end / W) * 6.5;
    const begin = -(rnd() * dur);
    const r = (pass ? 3.5 : 2.8) * rr;
    const pts: Pt[] = [];
    for (let x = 0; x <= end; x += 20) pts.push([x, m + u * hh(x)]);
    shapes.push({
      k: 'circle',
      x: 0,
      y: 0,
      r,
      p: { fill: T.tok },
      a: { motion: { path: pts, dur, begin, fadeIn: pass ? 0.08 : 0.12, fadeOut: pass ? 0.92 : 0.75, recolor: pass ? { to: T.red, a: 0.7, b: 0.8 } : undefined } },
    });
  });
  return {
    id: 'funnel',
    caption: 'Fig. 05 · Use-case funnel',
    w: W,
    h: H,
    shapes,
    notes: [],
    labels: [
      { t: 'Pain points', d: 'Gathered across Finance' },
      { t: 'Use cases', d: '1,000+ in the pipeline' },
      { t: 'Prioritised', d: 'Ranked for delivery' },
      { t: 'Agentic', d: 'Scaled as task automation' },
    ],
    cols: [1, 1, 1, 1],
  };
}

// ------------------------------------------------------------------------------ 03 · evaluation (new)

function evaluate(T: Theme, H = 200): Figure {
  // four tools pass three lenses (capability, fit, risk); what clears them is piloted, then decided
  const W = 640;
  const tools = ['ChatGPT', 'Claude', 'M365 Copilot', 'Copilot Studio'];
  const ys = tools.map((_, i) => 44 + i * ((H - 84) / 3));
  const nodeX = 150;
  const gates = [250, 330, 410];
  const pilotX = 496;
  const decX = 594;
  const mid = H / 2 + 2;
  const shapes: Shape[] = [];
  gates.forEach((x) => shapes.push({ k: 'path', d: `M${x},${22} V${H - 14}`, p: { stroke: T.div, dash: [3, 4] } }));
  ys.forEach((y) => shapes.push({ k: 'path', d: `M${nodeX + 10},${f1(y)} H${gates[2] + 26} L${pilotX - 22},${f1(mid)}`, p: { stroke: T.axis, width: 1 } }));
  shapes.push({ k: 'path', d: `M${pilotX},${mid} H${decX}`, p: { stroke: T.ink, width: 1.5 } });
  const rnd = lcg(5);
  ys.forEach((y, i) => {
    for (let j = 0; j < 3; j++) {
      // some stop at a lens, some go through to the pilot and on to the decision
      const stop = [gates[0], gates[1], gates[2], decX][Math.floor(rnd() * 4)];
      const route: Pt[] = stop === decX ? [[nodeX + 10, y], [gates[2] + 26, y], [pilotX - 22, mid], [decX - 18, mid]] : [[nodeX + 10, y], [stop, y]];
      const dur = stop === decX ? 6 : 1.4 + ((stop - nodeX) / 260) * 2.6;
      shapes.push({
        k: 'rect',
        x: -3.5,
        y: -3.5,
        w: 7,
        h: 7,
        p: { fill: T.tok },
        a: { motion: { path: route, dur, begin: -(rnd() * dur) - i * 0.4, fadeIn: 0.1, fadeOut: stop === decX ? 0.9 : 0.72, recolor: stop === decX ? { to: T.red, a: 0.78, b: 0.86 } : undefined } },
      });
    }
  });
  ys.forEach((y) => shapes.push({ k: 'circle', x: nodeX, y, r: 9, p: { fill: T.node, stroke: T.ink, width: 1.5 } }));
  ys.forEach((y) => shapes.push({ k: 'circle', x: nodeX, y, r: 3, p: { fill: T.ink } }));
  shapes.push({ k: 'rect', x: pilotX - 16, y: mid - 16, w: 32, h: 32, rot: 45, p: { fill: T.node, stroke: T.ink, width: 1.5 } });
  shapes.push({ k: 'path', d: `M${pilotX - 7},${mid} L${pilotX - 2},${mid + 5} L${pilotX + 7},${mid - 5}`, p: { stroke: T.ink, width: 1.8 } });
  shapes.push({ k: 'circle', x: decX, y: mid, r: 18, p: { fill: T.node, stroke: T.ink, width: 1.5 } });
  shapes.push({ k: 'circle', x: decX, y: mid, r: 8, p: { stroke: T.ink, width: 1.5 } });
  shapes.push({ k: 'circle', x: decX, y: mid, r: 2.5, p: { fill: T.ink } });
  return {
    id: 'eval',
    caption: 'Fig. 05 · Three lenses, then a pilot (illustrative)',
    w: W,
    h: H,
    shapes,
    notes: [
      ...tools.map((t, i): Note => ({ x: nodeX - 18, y: ys[i], text: t, color: T.ann, ax: 1, size: 10.5 })),
      { x: gates[0], y: 6, text: 'Capability', color: T.ink, ax: 0.5, ay: 0, size: 10.5 },
      { x: gates[1], y: 6, text: 'Fit', color: T.ink, ax: 0.5, ay: 0, size: 10.5 },
      { x: gates[2], y: 6, text: 'Risk', color: T.ink, ax: 0.5, ay: 0, size: 10.5 },
      { x: pilotX, y: mid + 28, text: 'Pilot', color: T.ann, ax: 0.5, ay: 0, size: 10.5 },
    ],
    labels: [
      { t: 'Tools', d: 'Four assistants and agent builders' },
      { t: 'Lenses', d: 'Capability, fit and risk' },
      { t: 'Pilots', d: 'Tested in Finance workflows' },
      { t: 'Decision', d: 'Findings feed enterprise tooling' },
    ],
    cols: [1.3, 1.2, 0.9, 1],
  };
}

// ------------------------------------------------------------------------------ 04 · adoption

function adopt(T: Theme, H = 300): Figure {
  const W = 640;
  const G = 34;
  const NW = 14;
  const v = [4, 4, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 8, 8];
  const top = 34;
  const axisY = H - 34;
  const cw = (W - G) / NW;
  const ch = (axisY - 6 - top) / 8;
  const s = Math.min(cw * 0.66, ch * 0.92);
  const cx = (w: number) => G + (w + 0.5) * cw;
  const by = (r: number) => axisY - 4 - r * ch;
  const yL = (r: number) => by(r) + (ch - 0.91 * s) / 2;
  const body = (x: number, b: number) =>
    `M${f1(x - s * 0.3)},${f1(b)} V${f1(b - s * 0.26)} Q${f1(x - s * 0.3)},${f1(b - s * 0.5)} ${f1(x)},${f1(b - s * 0.5)} Q${f1(x + s * 0.3)},${f1(b - s * 0.5)} ${f1(x + s * 0.3)},${f1(b - s * 0.26)} V${f1(b)} Z`;
  const person = (x: number, b: number, p: Paint): Shape[] => [
    { k: 'circle', x, y: b - s * 0.73, r: s * 0.17, p },
    { k: 'path', d: body(x, b), p },
  ];
  const shapes: Shape[] = [
    { k: 'path', d: `M${G},${axisY} H${W}`, p: { stroke: T.axis } },
    ...v.map((_, w): Shape => ({ k: 'path', d: `M${f1(cx(w))},${axisY} V${axisY + 4}`, p: { stroke: T.axis } })),
    ...[5, 10].map((w): Shape => ({ k: 'path', d: `M${f1(G + w * cw)},${top - 8} V${axisY + 10}`, p: { stroke: T.div, dash: [3, 4] } })),
    { k: 'path', d: `M${G},${f1(yL(4))} H${W}`, p: { stroke: T.axis2, dash: [4, 5] } },
    { k: 'path', d: `M${G},${f1(yL(8))} H${W}`, p: { stroke: T.ink, strokeOpacity: 0.6, dash: [4, 5] } },
  ];
  v.forEach((n, w) => {
    const d0 = 0.15 + w * 0.22;
    for (let r = 0; r < 8; r++) {
      const x = cx(w);
      const b = by(r);
      if (r >= n) {
        shapes.push({ k: 'group', kids: person(x, b, { stroke: T.axis, width: 1 }) });
        continue;
      }
      const grow = r >= 4;
      const dl = d0 + r * 0.05;
      const bob = w >= 10 && grow ? { delay: dl + 1 + ((w * 7 + r * 3) % 10) * 0.13, dur: 2.6, amp: 2 } : undefined;
      shapes.push({ k: 'group', kids: person(x, b, { fill: grow ? T.ink : T.soft }), a: { pop: { delay: dl, dur: 0.45, origin: [x, b] }, bob } });
      if (grow && r === n - 1 && n > (w ? v[w - 1] : 4)) {
        const sy = b - s - 10;
        shapes.push({ k: 'path', d: `M${f1(x)},${f1(sy)} L${f1(x + 4)},${f1(sy + 4)} L${f1(x)},${f1(sy + 8)} L${f1(x - 4)},${f1(sy + 4)} Z`, p: { fill: T.red }, a: { spark: { delay: dl + 0.25, dur: 1.1 } } });
      }
    }
  });
  shapes.push({ k: 'rect', x: G + 13 * cw + 2, y: yL(8) - 2, w: cw - 4, h: axisY - yL(8) + 2, p: { stroke: T.red, width: 1.5, dash: [4, 3] }, a: { fade: { delay: 0.15 + 13 * 0.22 + 0.5, dur: 0.5 } } });
  return {
    id: 'adopt',
    caption: 'Fig. 05 · Weekly active users, week by week (illustrative)',
    w: W,
    h: H,
    shapes,
    notes: [
      { x: 0, y: yL(4), text: '1×', color: T.ann, ax: 0 },
      { x: 0, y: yL(8), text: '2×', color: T.ink, ax: 0 },
      { x: cx(0), y: axisY, text: 'Week 0', color: T.ann, ay: 0, dy: 10 },
      { x: W, y: axisY, text: 'Week 13', color: T.ann, ax: 1, ay: 0, dy: 10 },
      { x: W, y: yL(8), text: '3 months', color: T.red, ax: 1, ay: 1, dy: -6 },
    ],
    labels: [
      { t: '', d: '' },
      { t: 'Pilots', d: 'Tested in Finance workflows' },
      { t: 'Enablement', d: 'Training built for Finance' },
      { t: 'Daily use', d: 'Embedded in operations' },
    ],
    cols: [34, 216, 216, 173],
  };
}

// ------------------------------------------------------------------------------ 05 · hub and spoke

function hub(T: Theme, H = 280): Figure {
  const W = 640;
  const cx = 320;
  const cy = H / 2;
  const N = 80;
  const ry1 = Math.min(150, (H / 2 - 14) / 1.45);
  const rx1 = 205;
  const hr = Math.max(16, Math.min(26, ry1 * 0.26));
  const rnd = lcg(7);
  const P = (a: number, t: number): Pt => [cx + rx1 * t * Math.cos(a), cy + ry1 * t * Math.sin(a)];
  const edge = (p: Pt): Pt => {
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    const l = Math.hypot(dx, dy);
    return [cx + (dx / l) * (hr + 4), cy + (dy / l) * (hr + 4)];
  };
  const inn: { a: number; p: Pt; c: Pt[] }[] = [];
  const ch: { i: number; p: Pt }[] = [];
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
    inn.push({ a, p: P(a, 1), c: [] });
    const c = 1 + Math.floor(rnd() * 3);
    for (let j = 0; j < c; j++) {
      const q = { i, p: P(a + (rnd() - 0.5) * 0.07, 1.16 + rnd() * 0.27) };
      ch.push(q);
      inn[i].c.push(q.p);
    }
  }
  const ln = (a: Pt, b: Pt) => `M${f1(a[0])},${f1(a[1])} L${f1(b[0])},${f1(b[1])}`;
  const shapes: Shape[] = [];
  [0, 2].forEach((b) => shapes.push({ k: 'ellipse', x: cx, y: cy, rx: hr, ry: hr, p: { stroke: T.ink, width: 1 }, a: { pulse: { dur: 4, begin: b + 1.6, to: [rx1 * 1.45, ry1 * 1.45], opacity: 0.5 } } }));
  shapes.push({ k: 'ellipse', x: cx, y: cy, rx: rx1, ry: ry1, p: { stroke: T.div, dash: [2, 5] } });
  shapes.push({ k: 'path', d: inn.map((n) => ln(edge(n.p), n.p)).join(' '), p: { stroke: T.div, width: 0.8 }, a: { fade: { delay: 0.1, dur: 0.8 } } });
  shapes.push({ k: 'path', d: ch.map((c) => ln(inn[c.i].p, c.p)).join(' '), p: { stroke: T.div, width: 0.7 }, a: { fade: { delay: 1.3, dur: 0.8 } } });
  const mesh: string[] = [];
  ch.forEach((c, k) => {
    if (k % 3 === 0 && ch[k + 1] && ch[k + 1].i !== c.i) mesh.push(ln(c.p, ch[k + 1].p));
  });
  shapes.push({ k: 'path', d: mesh.join(' '), p: { stroke: T.soft, strokeOpacity: 0.6, width: 0.8, dash: [1, 3] }, a: { fade: { delay: 1.6, dur: 0.8 } } });
  ch.forEach((c) => shapes.push({ k: 'circle', x: c.p[0], y: c.p[1], r: 2, p: { fill: T.soft }, a: { fade: { delay: 1.3 + c.i * 0.012, dur: 0.5 } } }));
  inn.forEach((n, i) => shapes.push({ k: 'rect', x: n.p[0] - 3, y: n.p[1] - 3, w: 6, h: 6, p: { fill: T.ink }, a: { fade: { delay: 0.3 + i * 0.012, dur: 0.3 } } }));
  for (let j = 0; j < 12; j++) {
    const n = inn[(j * 7 + 3) % N];
    shapes.push({ k: 'circle', x: 0, y: 0, r: 2.6, p: { fill: T.tok }, a: { motion: { path: [edge(n.p), n.p, n.c[0]], dur: 3.4, begin: 1.8 + j * 0.55, fadeIn: 0.08, fadeOut: 0.9 } } });
  }
  for (let j = 0; j < 7; j++) {
    const n = inn[(j * 11 + 41) % N];
    shapes.push({ k: 'circle', x: 0, y: 0, r: 3, p: { fill: T.red }, a: { motion: { path: [n.c[n.c.length - 1], n.p, edge(n.p)], dur: 3.8, begin: 2.4 + j * 0.6, fadeIn: 0.08, fadeOut: 0.9 } } });
  }
  shapes.push({ k: 'circle', x: cx, y: cy, r: hr, p: { fill: T.node, stroke: T.ink, width: 1.5 } });
  shapes.push({ k: 'circle', x: cx, y: cy, r: hr + 7, p: { stroke: T.ink, strokeOpacity: 0.5, dash: [3, 4] }, a: { spin: { dur: 24, centre: [cx, cy] } } });
  shapes.push({ k: 'path', d: `M${cx - 7},${cy} H${cx + 7} M${cx},${cy - 7} V${cy + 7}`, p: { stroke: T.ink, width: 1.5 } });
  return {
    id: 'hub',
    caption: 'Fig. 05 · Hub and spoke, one square per innovator',
    w: W,
    h: H,
    shapes,
    notes: [
      { x: cx, y: cy + hr + 17, text: 'Hub', color: T.ink, bg: T.node },
      { x: cx, y: cy - ry1 * 0.6, text: '80+ innovators & ambassadors', color: T.ink, bg: T.node },
      { x: cx, y: cy + ry1 * 1.3, text: 'AI champions', color: T.ann, bg: T.node },
      { x: 0, y: 0, text: '● Enablement out', color: T.tok, ax: 0, ay: 0, size: 11 },
      { x: 0, y: 18, text: '● Use cases back', color: T.red, ax: 0, ay: 0, size: 11 },
    ],
    labels: [
      { t: 'Hub', d: 'Training, tooling and standards go out' },
      { t: 'Spokes', d: '80+ innovators and ambassadors' },
      { t: 'Champions', d: 'Decentralised, delivering in their teams' },
      { t: 'Return', d: 'Use cases flow back to the hub' },
    ],
    cols: [1, 1, 1, 1],
  };
}

// ------------------------------------------------------------------------------ 06 · executive coaching (new)

function coach(T: Theme, H = 200): Figure {
  // half a year of fortnightly sessions; each one reaches leaders in three regions
  const W = 640;
  const x0 = 40;
  const x1 = 600;
  const axisY = H - 40;
  const n = 13;
  const sx = (i: number) => x0 + (i / (n - 1)) * (x1 - x0);
  const regions = [
    { x: 170, label: 'Americas' },
    { x: 320, label: 'EMEA' },
    { x: 470, label: 'APAC' },
  ];
  const ry = 52;
  const shapes: Shape[] = [{ k: 'path', d: `M${x0 - 10},${axisY} H${x1 + 10}`, p: { stroke: T.axis } }];
  for (let i = 0; i < n; i++) {
    shapes.push({ k: 'path', d: `M${f1(sx(i))},${axisY - 5} V${axisY + 5}`, p: { stroke: T.axis } });
    shapes.push({ k: 'circle', x: sx(i), y: axisY, r: 4.5, p: { fill: T.node, stroke: T.ink, width: 1.5 }, a: { pop: { delay: 0.2 + i * 0.12, dur: 0.4, origin: [sx(i), axisY + 4] } } });
  }
  // leaders: a small cluster of squares per region
  const rnd = lcg(3);
  regions.forEach((r, k) => {
    shapes.push({ k: 'ellipse', x: r.x, y: ry, rx: 54, ry: 26, p: { stroke: T.div, dash: [2, 4] } });
    for (let j = 0; j < 9; j++) {
      const a = (j / 9) * Math.PI * 2 + k;
      const rr = 10 + rnd() * 10;
      const x = r.x + Math.cos(a) * rr * 2;
      const y = ry + Math.sin(a) * rr * 0.9;
      shapes.push({ k: 'rect', x: x - 3, y: y - 3, w: 6, h: 6, p: { fill: j % 3 === 0 ? T.ink : T.soft }, a: { fade: { delay: 0.6 + k * 0.2 + j * 0.04, dur: 0.4 } } });
    }
  });
  // a playhead walks the half-year; at each session a token rises to every region
  const period = 13;
  shapes.push({ k: 'circle', x: 0, y: 0, r: 6, p: { fill: T.red }, a: { motion: { path: [[sx(0), axisY], [sx(n - 1), axisY]], dur: period, begin: 0, fadeIn: 0.02, fadeOut: 0.98 } } });
  for (let i = 0; i < n; i++) {
    regions.forEach((r, k) => {
      shapes.push({
        k: 'rect',
        x: -3,
        y: -3,
        w: 6,
        h: 6,
        p: { fill: k === 1 ? T.red : T.tok },
        a: { motion: { path: [[sx(i), axisY - 8], [sx(i), axisY - 30], [r.x, ry + 30]], dur: period, begin: (i / (n - 1)) * period * 0.98 + k * 0.08, fadeIn: 0.15, fadeOut: 0.85, travel: 0.11 } },
      });
    });
  }
  return {
    id: 'coach',
    caption: 'Fig. 05 · Fortnightly sessions, leaders across regions (illustrative)',
    w: W,
    h: H,
    shapes,
    notes: [
      ...regions.map((r): Note => ({ x: r.x, y: ry - 34, text: r.label, color: T.ink, size: 10.5 })),
      { x: x0 - 10, y: axisY, text: 'Week 0', color: T.ann, ax: 0, ay: 0, dy: 12 },
      { x: x1 + 10, y: axisY, text: 'Week 24', color: T.ann, ax: 1, ay: 0, dy: 12 },
      { x: 320, y: axisY, text: 'Every two weeks', color: T.red, bg: T.node, ay: 0, dy: 12 },
    ],
    labels: [
      { t: 'Cadence', d: 'Bi-weekly sessions' },
      { t: 'Hands-on', d: 'Working with the tools live' },
      { t: 'Senior', d: 'Management across the globe' },
      { t: 'Coaching', d: 'Direct, senior coaching' },
    ],
    cols: [1, 1, 1, 1],
  };
}

// ------------------------------------------------------------------------------ 07 · build loop (new)

function build(T: Theme, H = 220): Figure {
  // environments -> prototypes -> automations -> repository, and round again
  const W = 640;
  const cy = H / 2;
  const X = [90, 250, 410, 560];
  const loopTop = cy - 62;
  const shapes: Shape[] = [];
  const back = `M${X[3]},${cy - 22} V${loopTop} H${X[0]} V${cy - 22}`;
  shapes.push({ k: 'path', d: back, p: { stroke: T.soft, width: 1.5, dash: [4, 5] } });
  shapes.push({ k: 'path', d: `M${X[0] - 5},${cy - 31} L${X[0] + 5},${cy - 31} L${X[0]},${cy - 23} Z`, p: { fill: T.soft } });
  shapes.push({ k: 'path', d: `M${X[0]},${cy} H${X[3]}`, p: { stroke: T.ink, width: 1.5 } });
  const main = polyline(`M${X[0]},${cy} H${X[3]}`);
  [0, -1.3, -2.6].forEach((b) => shapes.push({ k: 'rect', x: -4, y: -4, w: 8, h: 8, p: { fill: T.tok }, a: { motion: { path: main, dur: 3.9, begin: b, fadeIn: 0.06, fadeOut: 0.94 } } }));
  shapes.push({ k: 'rect', x: -4, y: -4, w: 8, h: 8, p: { fill: T.soft }, a: { motion: { path: polyline(back), dur: 5, begin: -1.2, fadeIn: 0.06, fadeOut: 0.94 } } });
  // repository: a stack that grows, one block at a time
  for (let i = 0; i < 6; i++) {
    const y = cy + 66 - i * 8;
    shapes.push({ k: 'rect', x: X[3] - 14, y, w: 28, h: 6, p: { fill: i === 5 ? T.red : i % 2 ? T.soft : T.ink }, a: { pop: { delay: 0.4 + i * 0.35, dur: 0.4, origin: [X[3], y + 6] } } });
  }
  // station nodes
  const icons: ((x: number) => Shape[])[] = [
    // environment: a window
    (x) => [
      { k: 'rect', x: x - 8, y: cy - 7, w: 16, h: 14, p: { stroke: T.ink, width: 1.5 } },
      { k: 'path', d: `M${x - 8},${cy - 3} H${x + 8}`, p: { stroke: T.ink, width: 1.5 } },
    ],
    // prototype: a diamond spark
    (x) => [{ k: 'rect', x: x - 5, y: cy - 5, w: 10, h: 10, rot: 45, p: { fill: T.ink } }],
    // automation: a loop arrow
    (x) => [
      { k: 'circle', x, y: cy, r: 7, p: { stroke: T.ink, width: 1.5 } },
      { k: 'path', d: `M${x + 7},${cy - 4} L${x + 7},${cy + 1} L${x + 3},${cy - 1}`, p: { fill: T.ink } },
    ],
    // repository: stacked lines
    (x) => [{ k: 'path', d: `M${x - 7},${cy - 5} H${x + 7} M${x - 7},${cy} H${x + 7} M${x - 7},${cy + 5} H${x + 7}`, p: { stroke: T.ink, width: 1.5 } }],
  ];
  X.forEach((x, i) => {
    shapes.push({ k: 'circle', x, y: cy, r: 22, p: { fill: T.node, stroke: T.ink, width: 1.5 } });
    shapes.push(...icons[i](x));
  });
  return {
    id: 'build',
    caption: 'Fig. 05 · Build, try, automate, share',
    w: W,
    h: H,
    shapes,
    notes: [
      { x: (X[0] + X[3]) / 2, y: loopTop, text: 'Round again', color: T.ink, bg: T.node },
      { x: X[3] + 26, y: cy + 50, text: 'Skills', color: T.ann, ax: 0, size: 10.5 },
    ],
    labels: [
      { t: 'Environments', d: 'Copilot Studio set up for hackathons' },
      { t: 'Prototypes', d: 'Built with technology teams' },
      { t: 'Automations', d: 'Workflows that run themselves' },
      { t: 'Repository', d: 'Internal skills, ready to reuse' },
    ],
    cols: [1, 1, 1, 1],
  };
}

/** Figure for each case study, in the order of `cases` in content/profile.ts. */
export function caseFigure(index: number, T: Theme = LIGHT): Figure {
  return [gov, funnel, evaluate, adopt, hub, coach, build][index](T);
}

export const CASE_FIGURES = 7;

/** Opacity of a looping token at loop fraction f. */
export function tokenOpacity(f: number, fadeIn: number, fadeOut: number): number {
  if (f < fadeIn) return f / fadeIn;
  if (f > fadeOut) return (1 - f) / (1 - fadeOut);
  return 1;
}
