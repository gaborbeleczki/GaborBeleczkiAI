import * as THREE from 'three';

// The view out of the window: two photographs of Budapest (evening and day) rebuilt as a small
// 3D scene. Each photo comes with a data map (blender/window_photos.py):
//   R  sqrt(10 m / depth) of the background (city, river, bridge), 0 = sky
//   G  river surface (background) or how much a crown sways (foreground)
//   B  0.45 * point lights / sun glints (background), or 0.5 + 0.5 * foreground cover
// and a fill texture with the background guessed behind the foreground trees.
//
// For every pixel of the glass we follow the viewer's ray into the photo: the background by
// fixed-point iteration on its depth, the foreground (trees and roofs below the terrace) as one
// plane in front. Moving your head slides the layers against each other. On top of that runs a
// small world: cars and buses on the bridge and the embankment, tram 2, river boats with their
// reflections, a plane in the evening sky, birds in the day, wind in the trees, the current.

type Path = number[][]; // [x, y down, depth m]

export interface WindowPhoto {
  size: [number, number];
  fx: number;
  fy: number;
  horizon: number;
  foreground: number;
  paths: Record<string, Path | Path[]>;
}

export interface WindowCredit {
  title: string;
  author: string;
  license: string;
  url: string;
  changes?: string;
}

export interface WindowMeta {
  credits: Record<'evening' | 'day', WindowCredit>;
  evening: WindowPhoto;
  day: WindowPhoto;
}

export interface WindowTextures {
  plate: THREE.Texture;
  data: THREE.Texture;
  fill: THREE.Texture;
}

type State = 'evening' | 'day';

/** How each photo hangs behind the glass: virtual field of view, turn and tilt (degrees). */
export const WINDOW_VIEW: Record<State, { hfov: number; yaw: number; pitch: number; gain: number }> = {
  evening: { hfov: 80, yaw: 13, pitch: -3, gain: 0.92 },
  day: { hfov: 80, yaw: 13, pitch: -3, gain: 1.0 },
};

const NS = 24; // moving things per photo

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  #define NS ${NS}
  uniform sampler2D plateA;
  uniform sampler2D dataA;
  uniform sampler2D fillA;
  uniform sampler2D plateB;
  uniform sampler2D dataB;
  uniform sampler2D fillB;
  uniform vec4 camA;        // tan(hfov / 2), aspect, yaw, pitch
  uniform vec4 camB;
  uniform vec4 fgA;         // foreground: inverse virtual depth, sway amount
  uniform vec4 fgB;
  uniform vec4 sA0[NS];
  uniform vec4 sA1[NS];
  uniform vec4 sB0[NS];
  uniform vec4 sB1[NS];
  uniform int countA;
  uniform int countB;
  uniform float kb;         // background: inverse virtual depth = R * kb
  uniform float mixT;       // 0 evening, 1 day
  uniform float time;
  uniform float wind;
  uniform vec2 gain;
  uniform vec2 windowSize;
  uniform vec3 viewer;      // eye in window space (x right, y up, z into the city)
  uniform vec3 glassTint;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }

  vec3 turn(vec3 v, vec4 cam) {
    float c = cos(cam.z), s = sin(cam.z);
    v = vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
    c = cos(cam.w); s = sin(cam.w);
    return vec3(v.x, v.y * c + v.z * s, -v.y * s + v.z * c);
  }

  // past the bottom edge: mirror (more of the trees below); past the top: clamp (sky)
  vec2 edge(vec2 uv) {
    uv.x = uv.x < 0.0 ? -uv.x : (uv.x > 1.0 ? 2.0 - uv.x : uv.x);
    uv.y = uv.y < 0.0 ? -uv.y : min(uv.y, 0.999);
    return uv;
  }

  float coverOf(vec3 d) { return clamp((d.b - 0.5) * 2.0, 0.0, 1.0); }
  float waterOf(vec3 d) { return d.b < 0.495 ? d.g : 0.0; }
  float sparkOf(vec3 d) { return d.b < 0.48 ? d.b / 0.45 : 0.0; }

  // ---------------------------------------------------------------- moving things

  float box(vec2 p, vec2 lo, vec2 hi, float px) {
    vec2 q = min(p - lo, hi - p);
    return clamp(min(q.x, q.y) / px + 0.5, 0.0, 1.0);
  }

  float glow(vec2 p, vec2 c, float r) {
    vec2 d = (p - c) / r;
    return exp(-dot(d, d));
  }

  // two rows of cabin windows, soft-edged so they read at a few pixels tall
  float rows(vec2 t, float tf) {
    float band1 = smoothstep(0.2, 0.27, t.y) * (1.0 - smoothstep(0.36, 0.43, t.y)) * step(0.06, tf) * step(tf, 0.92);
    float band2 = smoothstep(0.5, 0.56, t.y) * (1.0 - smoothstep(0.68, 0.74, t.y)) * step(0.14, tf) * step(tf, 0.84);
    float panes1 = 0.55 + 0.45 * smoothstep(0.15, 0.4, abs(fract(tf * 26.0) - 0.5) * 2.0);
    float panes2 = 0.5 + 0.5 * smoothstep(0.1, 0.35, abs(fract(tf * 16.0) - 0.5) * 2.0);
    return max(band1 * panes1, band2 * panes2);
  }

  // One thing: base line a -> b (front at b) in plate uv, height h (v units), half width hw (u
  // units), kind.variant, and sqrt(10 m / depth) for where it stands.
  vec3 thing(vec3 col, vec4 s0, vec4 s1, vec2 uvInf, vec2 delta, float wHit, float water, float aspect, float px) {
    float kind = floor(s1.z);
    float variant = fract(s1.z);
    float ws = s1.y * kb;
    vec2 uv = uvInf + delta * ws;
    vec2 p = vec2(uv.x * aspect, uv.y);
    vec2 a = vec2(s0.x * aspect, s0.y);
    vec2 b = vec2(s0.z * aspect, s0.w);
    float h = s1.x;
    float hw = s1.w * aspect;
    float front = b.x >= a.x ? 1.0 : -1.0;
    vec2 lo = vec2(min(a.x, b.x) - hw, min(a.y, b.y));
    vec2 hi = vec2(max(a.x, b.x) + hw, max(a.y, b.y) + h);
    // something nearer (a bridge tower, the deck) stands in front
    bool hidden = ws < wHit * 0.9 - 1e-5;

    if (kind < 1.5) {
      // evening car: head light at the front, tail light at the back
      if (hidden) return col;
      float r = max(h * 0.32, px * 0.9);
      vec2 head = vec2(b.x + front * hw, b.y + h * 0.35);
      vec2 tail = vec2(a.x - front * hw, a.y + h * 0.4);
      vec3 hc = mix(vec3(1.0, 0.9, 0.72), vec3(0.95, 0.95, 1.0), variant);
      col += hc * (glow(p, head, r) * 1.1 + glow(p, head, r * 3.0) * 0.12);
      col += vec3(1.0, 0.1, 0.05) * (glow(p, tail, r * 0.8) * 0.9 + glow(p, tail, r * 2.4) * 0.08);
      return col;
    }
    if (kind < 2.5) {
      // daytime car: a small box with a window band and a shadow
      if (hidden) return col;
      float m = box(p, lo, hi, px);
      if (m <= 0.0) return col;
      vec2 t = (p - lo) / max(hi - lo, vec2(1e-6));
      vec3 paint = variant < 0.25 ? vec3(0.92) : variant < 0.45 ? vec3(0.62, 0.64, 0.66) : variant < 0.6 ? vec3(0.08) : variant < 0.75 ? vec3(0.95, 0.75, 0.1) : variant < 0.88 ? vec3(0.55, 0.08, 0.06) : vec3(0.12, 0.2, 0.4);
      vec3 c = mix(paint, vec3(0.1, 0.12, 0.14), step(0.5, t.y) * step(t.y, 0.82) * 0.8);
      c *= mix(0.55, 1.0, step(0.15, t.y));
      return mix(col, c, m);
    }
    if (kind < 3.5) {
      // tram 2: yellow by day, a strip of lit windows in the evening
      if (hidden) return col;
      float m = box(p, lo, hi, px);
      vec2 t = (p - lo) / max(hi - lo, vec2(1e-6));
      float tf = front > 0.0 ? t.x : 1.0 - t.x;
      float win = step(0.42, t.y) * step(t.y, 0.8) * step(0.18, fract(tf * 11.0)) * step(0.03, tf) * step(tf, 0.97);
      float joint = max(step(abs(tf - 0.333), 0.006), step(abs(tf - 0.666), 0.006));
      vec3 c;
      if (variant < 0.5) {
        c = vec3(0.94, 0.73, 0.12);
        c = mix(c, vec3(0.86, 0.86, 0.84), step(0.86, t.y));
        c = mix(c, vec3(0.13, 0.15, 0.16), win);
        c = mix(c, vec3(0.2), step(t.y, 0.12));
        c = mix(c, vec3(0.15), joint * 0.8);
        return mix(col, c, m);
      }
      c = vec3(0.2, 0.15, 0.07);
      c = mix(c, vec3(1.0, 0.86, 0.6), win);
      c = mix(c, vec3(0.04), joint);
      col = mix(col, c, m);
      vec2 lamp = vec2(front > 0.0 ? hi.x : lo.x, lo.y + h * 0.25);
      col += vec3(1.0, 0.95, 0.8) * glow(p, lamp, max(h * 0.35, px)) * 1.4;
      return col;
    }
    if (kind < 4.5) {
      // river boat, and its reflection on the water below
      vec2 t = (p - lo) / max(hi - lo, vec2(1e-6));
      float tf = front > 0.0 ? t.x : 1.0 - t.x;
      bool night = variant >= 0.5;
      if (t.y >= 0.0) {
        if (hidden) return col;
        // hull and two decks, stepping in towards the top
        float hull = box(p, lo, vec2(hi.x, lo.y + h * 0.45), px);
        float deck = box(p, vec2(mix(lo.x, hi.x, 0.1), lo.y), vec2(mix(lo.x, hi.x, 0.86), lo.y + h * 0.78), px);
        float cab = box(p, vec2(mix(lo.x, hi.x, 0.3), lo.y), vec2(mix(lo.x, hi.x, 0.62), hi.y), px);
        float m = max(hull, max(deck, cab));
        if (m <= 0.0) return col;
        vec3 c;
        if (night) {
          // a dark hull picked out by the city, warm cabins, a few deck lamps
          c = mix(vec3(0.07, 0.055, 0.045), vec3(1.0, 0.74, 0.42), rows(t, tf) * 0.95);
          c += vec3(0.9, 0.85, 0.75) * glow(vec2(fract(tf * 7.0), t.y), vec2(0.5, 0.95), 0.12) * cab * 0.8;
        } else {
          c = vec3(0.9, 0.92, 0.95);
          c = mix(c, vec3(0.16, 0.24, 0.42), step(t.y, 0.12));
          c = mix(c, vec3(0.12, 0.15, 0.18), rows(t, tf) * 0.85);
        }
        return mix(col, c, m);
      }
      // reflection: mirrored about the waterline, broken up by the current
      float under = -t.y;
      if (under > 0.9 || water < 0.3) return col;
      float wob = (noise(vec2(p.x * 900.0, p.y * 2400.0 - time * 3.0)) - 0.5) * 0.08;
      vec2 q = vec2(p.x + wob * (hi.x - lo.x) * 0.15, lo.y + (lo.y - p.y) * 1.15);
      if (q.x < lo.x || q.x > hi.x) return col;
      vec2 tq = vec2((q.x - lo.x) / max(hi.x - lo.x, 1e-6), (q.y - lo.y) / max(h, 1e-6));
      float tfq = front > 0.0 ? tq.x : 1.0 - tq.x;
      float fade = (1.0 - under / 0.9) * water;
      if (night) {
        float streak = rows(tq, tfq) * (0.5 + 0.5 * noise(vec2(p.x * 3000.0, time * 4.0)));
        return col + vec3(1.0, 0.72, 0.38) * streak * fade * 0.4;
      }
      return mix(col, mix(col * 0.75, vec3(0.75, 0.8, 0.85), step(0.12, tq.y)), fade * 0.45 * step(tq.y, 0.45));
    }
    if (kind < 5.5) {
      // plane: blinking lights at night, a speck and a contrail by day
      float r = max(px * 1.4, h);
      if (variant >= 0.5) {
        float strobe = step(0.92, fract(time * 0.8)) + step(0.92, fract(time * 0.8 - 0.12));
        float beacon = 0.35 + 0.65 * step(0.5, fract(time * 0.9));
        col += vec3(1.0) * glow(p, a + vec2(px * 3.0, 0.0), r) * strobe * 2.0;
        col += vec3(1.0, 0.15, 0.1) * glow(p, a, r) * beacon * 1.2;
        return col;
      }
      vec2 ab = b - a;
      float tt = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-9), 0.0, 1.0);
      float dl = length(p - (a + ab * tt));
      float trail = (1.0 - smoothstep(px * 0.6, px * 1.8, dl)) * (1.0 - tt) * step(0.03, tt) * 0.5;
      col = mix(col, vec3(0.97), trail);
      return mix(col, vec3(0.35, 0.37, 0.4), glow(p, a, r * 0.8));
    }
    // bird: a dark V that flaps
    if (hidden) return col;
    float flap = sin(time * 9.0 + variant * 40.0) * 0.6;
    float span = h;
    vec2 e1 = vec2(-span, span * (0.35 + flap * 0.5));
    vec2 e2 = vec2(span, span * (0.35 + flap * 0.5));
    vec2 q = p - a;
    float d1 = length(q - e1 * clamp(dot(q, e1) / dot(e1, e1), 0.0, 1.0));
    float d2 = length(q - e2 * clamp(dot(q, e2) / dot(e2, e2), 0.0, 1.0));
    float m = 1.0 - smoothstep(px * 0.35, px * 1.1, min(d1, d2));
    return mix(col, vec3(0.13, 0.13, 0.14), m * 0.9);
  }

  #define THINGS(S0, S1, COUNT) for (int i = 0; i < NS; i++) { if (i >= COUNT) break; col = thing(col, S0[i], S1[i], uvInf, delta, wHit, water, cam.y, px); }

  // ---------------------------------------------------------------- one photo

  #define PHOTO(NAME, PLATE, DATA, FILL, CAM, FG, S0, S1, COUNT, NIGHT)                                 \\
  vec3 NAME(vec3 Pw, vec3 dw) {                                                                       \\
    vec4 cam = CAM;                                                                                   \\
    vec3 P = turn(Pw, cam);                                                                           \\
    vec3 d = turn(dw, cam);                                                                           \\
    vec2 n = d.xy / max(d.z, 1e-3);                                                                   \\
    vec2 k = vec2(1.0, cam.y) / (2.0 * cam.x);                                                        \\
    vec2 uvInf = 0.5 + n * k;                                                                         \\
    vec2 delta = (P.xy - n * P.z) * k;                                                                \\
    /* background: settle on the depth the ray meets */                                               \\
    vec2 uv = uvInf;                                                                                  \\
    vec3 dat;                                                                                         \\
    for (int i = 0; i < 5; i++) {                                                                     \\
      dat = texture2D(DATA, edge(uv)).rgb;                                                            \\
      uv = uvInf + delta * (dat.r * kb);                                                              \\
    }                                                                                                 \\
    dat = texture2D(DATA, edge(uv)).rgb;                                                              \\
    float wHit = dat.r * kb;                                                                          \\
    float water = waterOf(dat);                                                                       \\
    float spark = sparkOf(dat);                                                                       \\
    float px = max(fwidth(uv.y), 1e-5);                                                               \\
    /* the current: ripples drift downstream, finer with distance */                                  \\
    float D = 10.0 / max(dat.r * dat.r, 1e-4);                                                        \\
    float xw = (uv.x - 0.5) * D * 2.0 * cam.x;                                                        \\
    float n1 = noise(vec2(xw * 0.08 - time * 0.5, uv.y * 160.0));                                     \\
    float n2 = noise(vec2(xw * 0.21 - time * 1.05, uv.y * 420.0 + 3.1));                              \\
    vec2 rip = vec2((n1 - 0.5) * 1.1 + (n2 - 0.5) * 0.7, (n2 - 0.5) * 0.9) * (2.2 / D) * water;       \\
    vec2 cuv = edge(uv + rip);                                                                        \\
    vec3 base = texture2D(PLATE, cuv).rgb;                                                            \\
    /* sky: a slow drift of the clouds (two offsets cross-faded so it never jumps) */                 \\
    float sky = NIGHT ? 0.0 : smoothstep(0.53, 0.58, cuv.y) * step(dat.r, 0.002);                     \\
    if (sky > 0.0) {                                                                                  \\
      float ph = fract(time / 45.0);                                                                  \\
      vec2 o1 = vec2(ph * 0.014, 0.0), o2 = vec2(fract(ph + 0.5) * 0.014, 0.0);                       \\
      vec3 drift = mix(texture2D(PLATE, edge(cuv - o1)).rgb, texture2D(PLATE, edge(cuv - o2)).rgb, abs(ph * 2.0 - 1.0)); \\
      base = mix(base, drift, sky);                                                                   \\
    }                                                                                                 \\
    /* where the photo has a tree in front, use the guessed background instead */                     \\
    vec3 col = mix(base, texture2D(FILL, cuv).rgb, coverOf(dat));                                     \\
    if (NIGHT) {                                                                                      \\
      float tw = noise(uv * vec2(820.0, 460.0) + vec2(time * 1.7, -time * 1.1));                      \\
      col *= 1.0 + spark * (tw - 0.45) * 0.8;                                                         \\
      col *= 1.0 + water * (n2 - 0.5) * 0.35;                                                         \\
    } else {                                                                                          \\
      float g = noise(vec2(xw * 0.7 - time * 0.9, uv.y * 1300.0 + time * 1.6));                       \\
      col += vec3(1.0, 0.97, 0.9) * pow(g, 14.0) * spark * water * 2.5;                               \\
    }                                                                                                 \\
    /* the small world: traffic, tram, boats, plane, birds */                                         \\
    THINGS(S0, S1, COUNT)                                                                             \\
    /* foreground plane: trees and roofs right below the terrace, swaying */                          \\
    vec2 uf = uvInf + delta * FG.x;                                                                   \\
    vec3 df = texture2D(DATA, edge(uf)).rgb;                                                          \\
    float sw = coverOf(df) > 0.0 ? df.g : 0.0;                                                        \\
    float gust = 0.6 + 0.4 * sin(time * 0.31) * sin(time * 0.17 + 1.3);                               \\
    vec2 bend = vec2(                                                                                 \\
      sin(time * 1.15 + uf.y * 9.0 + uf.x * 4.0) * 0.6 + sin(time * 2.4 + uf.x * 23.0) * 0.25,        \\
      sin(time * 1.7 + uf.x * 13.0) * 0.35) * FG.y * wind * gust * sw;                                \\
    vec2 ufs = edge(uf + bend * vec2(1.0, cam.y));                                                    \\
    float cover = coverOf(texture2D(DATA, ufs).rgb);                                                  \\
    col = mix(col, texture2D(PLATE, ufs).rgb, cover);                                                 \\
    return col;                                                                                       \\
  }

  PHOTO(photoA, plateA, dataA, fillA, camA, fgA, sA0, sA1, countA, true)
  PHOTO(photoB, plateB, dataB, fillB, camB, fgB, sB0, sB1, countB, false)

  void main() {
    vec3 Pw = vec3((vUv - 0.5) * windowSize, 0.0);
    vec3 dw = normalize(Pw - viewer);
    vec3 col;
    if (mixT <= 0.001) col = photoA(Pw, dw) * gain.x;
    else if (mixT >= 0.999) col = photoB(Pw, dw) * gain.y;
    else col = mix(photoA(Pw, dw) * gain.x, photoB(Pw, dw) * gain.y, mixT);
    // a whisper of glass: faint room reflection towards grazing angles
    float fres = pow(1.0 - clamp(dw.z, 0.0, 1.0), 3.0);
    col = mix(col, glassTint, 0.05 + 0.12 * fres);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

// ------------------------------------------------------------------------- the small world

interface PathPoint {
  u: number;
  v: number;
  D: number;
  s: number; // metres along the path
}

class Track {
  readonly pts: PathPoint[];
  readonly length: number;

  constructor(raw: Path, fx: number, offsetV = 0) {
    let s = 0;
    let prev: { X: number; Z: number } | null = null;
    this.pts = raw.map(([x, y, D]) => {
      const X = ((x - 0.5) / fx) * D;
      if (prev) s += Math.hypot(X - prev.X, D - prev.Z);
      prev = { X, Z: D };
      return { u: x, v: 1 - y + offsetV, D, s };
    });
    this.length = s;
  }

  at(s: number): { u: number; v: number; D: number } {
    const p = this.pts;
    if (s <= 0) return p[0];
    if (s >= this.length) return p[p.length - 1];
    let i = 1;
    while (i < p.length - 1 && p[i].s < s) i++;
    const a = p[i - 1];
    const b = p[i];
    const t = (s - a.s) / Math.max(b.s - a.s, 1e-6);
    return { u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t, D: a.D + (b.D - a.D) * t };
  }
}

interface Mover {
  track: Track;
  s: number;
  dir: 1 | -1;
  speed: number;
  length: number;
  height: number;
  width: number;
  kind: number;
  variant: number;
}

interface Lane {
  track: Track;
  dir: 1 | -1;
  kind: number;
  max: number;
  gap: [number, number];
  speed: [number, number];
  size: [number, number, number]; // length, height, width (m)
  timer: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Traffic, tram, boats, plane and birds for one photo, packed into shader uniforms. */
class World {
  private readonly lanes: Lane[] = [];
  private readonly movers: Mover[] = [];
  private planeT = rand(8, 25);
  private plane: { t: number; dur: number } | null = null;
  private birds: { t: number; dur: number; n: number; seed: number } | null = null;
  private birdT = rand(6, 14);
  private readonly sky?: Track;
  private readonly flock?: Track;
  count = 0;

  constructor(
    private readonly photo: WindowPhoto,
    private readonly night: boolean,
    private readonly s0: THREE.Vector4[],
    private readonly s1: THREE.Vector4[],
  ) {
    const p = photo.paths;
    const fx = photo.fx;
    const car = night ? 1 : 2;
    const lane = (raw: Path, dir: 1 | -1, kind: number, max: number, gap: [number, number], speed: [number, number], size: [number, number, number], offsetV = 0) =>
      this.lanes.push({ track: new Track(raw, fx, offsetV), dir, kind, max, gap, speed, size, timer: rand(0, gap[1]) });
    // the bridge, both directions
    lane(p.deck as Path, 1, car, 5, [3, 9], [8, 11], [4.4, 1.5, 1.8], night ? 0.0016 : 0);
    lane(p.deck as Path, -1, car, 5, [3, 9], [8, 11], [4.4, 1.5, 1.8], night ? -0.0016 : 0);
    // the Pest embankment
    lane(p.upper as Path, 1, car, 4, [2.5, 7], [10, 14], [4.4, 1.5, 1.8]);
    lane(p.upper as Path, -1, car, 4, [2.5, 7], [10, 14], [4.4, 1.5, 1.8], 0.002);
    lane(p.quay as Path, night ? 1 : -1, car, 3, [4, 10], [9, 12], [4.4, 1.5, 1.8]);
    // tram 2 runs along the river on the Pest side
    const tram = (night ? p.quay : p.tram) as Path;
    lane(tram, 1, 3, 1, [35, 70], [8, 9.5], [30, 3.4, 2.4], night ? -0.0005 : 0);
    lane(tram, -1, 3, 1, [45, 80], [8, 9.5], [30, 3.4, 2.4], night ? -0.0005 : 0);
    // river boats, slow
    const river = p.river as Path[];
    lane(river[0], -1, 4, 1, [50, 110], [3.2, 4.2], [46, 6, 9]);
    lane(river[1], 1, 4, 1, [40, 90], [3.6, 4.8], [56, 7, 11]);
    if (p.sky) this.sky = new Track(p.sky as Path, fx);
    if (p.birds) this.flock = new Track(p.birds as Path, fx);
    // start with the world already busy
    for (let i = 0; i < 240; i++) this.update(0.5, true);
  }

  private spawn(l: Lane): void {
    const busy = this.movers.filter((m) => m.track === l.track && m.dir === l.dir && m.kind === l.kind);
    if (busy.length >= l.max) return;
    const start = l.dir > 0 ? 0 : l.track.length;
    if (busy.some((m) => Math.abs(m.s - start) < m.length + 14)) return;
    const bus = l.kind <= 2 && Math.random() < 0.12;
    this.movers.push({
      track: l.track,
      s: start,
      dir: l.dir,
      speed: rand(l.speed[0], l.speed[1]),
      length: bus ? 12 : l.size[0] * rand(0.9, 1.1),
      height: bus ? 3.1 : l.size[1],
      width: bus ? 2.5 : l.size[2],
      kind: l.kind,
      variant: bus && !this.night ? 0.8 : Math.random() * 0.98,
    });
  }

  update(dt: number, warm = false): void {
    for (const l of this.lanes) {
      l.timer -= dt;
      if (l.timer <= 0) {
        this.spawn(l);
        l.timer = rand(l.gap[0], l.gap[1]);
      }
    }
    for (let i = this.movers.length - 1; i >= 0; i--) {
      const m = this.movers[i];
      // keep a distance to the one in front
      const ahead = this.movers.find((o) => o !== m && o.track === m.track && o.dir === m.dir && (o.s - m.s) * m.dir > 0 && (o.s - m.s) * m.dir < m.length / 2 + o.length / 2 + 8);
      const v = ahead ? Math.min(m.speed, ahead.speed * 0.9) : m.speed;
      m.s += m.dir * v * dt;
      if (m.s < -m.length || m.s > m.track.length + m.length) this.movers.splice(i, 1);
    }
    if (this.sky) {
      this.planeT -= dt;
      if (!this.plane && this.planeT <= 0) this.plane = { t: 0, dur: rand(55, 75) };
      if (this.plane) {
        this.plane.t += dt;
        if (this.plane.t > this.plane.dur) {
          this.plane = null;
          this.planeT = rand(30, 70);
        }
      }
    }
    if (this.flock && !this.night) {
      this.birdT -= dt;
      if (!this.birds && this.birdT <= 0) this.birds = { t: 0, dur: rand(16, 24), n: 3 + Math.floor(Math.random() * 4), seed: Math.random() };
      if (this.birds) {
        this.birds.t += dt;
        if (this.birds.t > this.birds.dur) {
          this.birds = null;
          this.birdT = rand(14, 30);
        }
      }
    }
    if (!warm) this.pack();
  }

  hurry(): void {
    for (const l of this.lanes) if (l.kind >= 3) l.timer = Math.min(l.timer, rand(1, 4));
    if (!this.plane) this.planeT = Math.min(this.planeT, 3);
    if (!this.birds) this.birdT = Math.min(this.birdT, 2);
  }

  private pack(): void {
    const { fx, fy } = this.photo;
    let n = 0;
    const put = (a: { u: number; v: number }, b: { u: number; v: number }, h: number, R: number, kind: number, hw: number) => {
      if (n >= NS) return;
      this.s0[n].set(a.u, a.v, b.u, b.v);
      this.s1[n].set(h, R, kind, hw);
      n++;
    };
    // far things first, so nearer ones paint over them
    const sorted = this.movers.map((m) => ({ m, D: m.track.at(m.s).D })).sort((p, q) => q.D - p.D);
    for (const { m, D } of sorted) {
      const back = m.track.at(m.s - (m.dir * m.length) / 2);
      const front = m.track.at(m.s + (m.dir * m.length) / 2);
      const variant = m.kind === 3 || m.kind === 4 ? (this.night ? 0.75 : 0.25) : m.variant;
      put(back, front, (m.height * fy) / D, Math.sqrt(10 / D), m.kind + Math.min(variant, 0.99), ((m.width / 2) * fx) / D);
    }
    if (this.plane && this.sky) {
      const s = (this.plane.t / this.plane.dur) * this.sky.length;
      put(this.sky.at(s), this.sky.at(Math.max(0, s - this.sky.length * 0.05)), 0.0009, 0, 5 + (this.night ? 0.75 : 0.25), 0);
    }
    if (this.birds && this.flock) {
      const k = this.birds.t / this.birds.dur;
      for (let i = 0; i < this.birds.n; i++) {
        const lag = i * 0.012 + ((this.birds.seed * 7 + i * 3.1) % 1) * 0.01;
        const p = this.flock.at((k - lag) * this.flock.length);
        const bob = Math.sin(this.birds.t * 1.3 + i * 2.1) * 0.004;
        const span = (0.45 * fy) / p.D;
        const at = { u: p.u + i * 0.004, v: p.v + bob + (i % 2) * 0.006 };
        put(at, at, span, Math.sqrt(10 / p.D), 6 + ((this.birds.seed + i * 0.17) % 0.99), 0);
      }
    }
    this.count = n;
  }
}

// ------------------------------------------------------------------------- the view

export class WindowView {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  private readonly origin: THREE.Vector3;
  private readonly worlds: Record<State, World>;

  /** Background: inverse virtual depth = sqrt(10 m / depth) * KB. A gentle squeeze of real
   *  distances, so the bridge and the far bank still slide against each other a little. */
  static readonly KB = 0.12;

  /** The foreground plane's virtual distance for a real one (same squeeze). */
  static virtualDepth(metres: number): number {
    return 1 / (Math.sqrt(10 / metres) * WindowView.KB);
  }

  constructor(opts: { center: THREE.Vector3; size: [number, number]; meta: WindowMeta; evening: WindowTextures; day: WindowTextures }) {
    const { meta } = opts;
    // the plane sits just behind the frame, facing into the room (+z)
    this.origin = opts.center.clone().add(new THREE.Vector3(0, 0, -0.04));
    const vecs = () => Array.from({ length: NS }, () => new THREE.Vector4());
    const sA0 = vecs();
    const sA1 = vecs();
    const sB0 = vecs();
    const sB1 = vecs();
    const cam = (p: WindowPhoto, v: (typeof WINDOW_VIEW)[State]) =>
      new THREE.Vector4(Math.tan(THREE.MathUtils.degToRad(v.hfov) / 2), p.size[0] / p.size[1], THREE.MathUtils.degToRad(v.yaw), THREE.MathUtils.degToRad(v.pitch));
    this.material = new THREE.ShaderMaterial({
      name: 'window-view',
      uniforms: {
        plateA: { value: opts.evening.plate },
        dataA: { value: opts.evening.data },
        fillA: { value: opts.evening.fill },
        plateB: { value: opts.day.plate },
        dataB: { value: opts.day.data },
        fillB: { value: opts.day.fill },
        camA: { value: cam(meta.evening, WINDOW_VIEW.evening) },
        camB: { value: cam(meta.day, WINDOW_VIEW.day) },
        fgA: { value: new THREE.Vector4(1 / WindowView.virtualDepth(meta.evening.foreground), 0.0016, 0, 0) },
        fgB: { value: new THREE.Vector4(1 / WindowView.virtualDepth(meta.day.foreground), 0.0022, 0, 0) },
        sA0: { value: sA0 },
        sA1: { value: sA1 },
        sB0: { value: sB0 },
        sB1: { value: sB1 },
        countA: { value: 0 },
        countB: { value: 0 },
        kb: { value: WindowView.KB },
        mixT: { value: 0 },
        time: { value: 0 },
        wind: { value: 1 },
        gain: { value: new THREE.Vector2(WINDOW_VIEW.evening.gain, WINDOW_VIEW.day.gain) },
        windowSize: { value: new THREE.Vector2(opts.size[0], opts.size[1]) },
        viewer: { value: new THREE.Vector3(0, 0, -3) },
        glassTint: { value: new THREE.Color('#8b6a4c') },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      toneMapped: false,
    });
    this.worlds = {
      evening: new World(meta.evening, true, sA0, sA1),
      day: new World(meta.day, false, sB0, sB1),
    };
    // a little larger than the opening, so no gap shows in the reveal at grazing angles
    const plane: [number, number] = [opts.size[0] + 0.24, opts.size[1] + 0.24];
    (this.material.uniforms.windowSize.value as THREE.Vector2).set(plane[0], plane[1]);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(plane[0], plane[1]), this.material);
    this.mesh.position.copy(this.origin);
    this.mesh.name = 'window_view';
    this.mesh.renderOrder = -1;
  }

  /** Swap a photo's textures (the sharp plate arrives after the first frames). */
  setTextures(state: State, t: Partial<WindowTextures>): void {
    const u = this.material.uniforms;
    const k = state === 'evening' ? 'A' : 'B';
    if (t.plate) u[`plate${k}`].value = t.plate;
    if (t.data) u[`data${k}`].value = t.data;
    if (t.fill) u[`fill${k}`].value = t.fill;
  }

  /** Live tuning: how one photo hangs behind the glass. */
  frame(state: State, v: Partial<(typeof WINDOW_VIEW)[State]>): void {
    const view = Object.assign(WINDOW_VIEW[state], v);
    const c = this.material.uniforms[state === 'evening' ? 'camA' : 'camB'].value as THREE.Vector4;
    c.x = Math.tan(THREE.MathUtils.degToRad(view.hfov) / 2);
    c.z = THREE.MathUtils.degToRad(view.yaw);
    c.w = THREE.MathUtils.degToRad(view.pitch);
    (this.material.uniforms.gain.value as THREE.Vector2).set(WINDOW_VIEW.evening.gain, WINDOW_VIEW.day.gain);
  }

  setState(t: number): void {
    this.material.uniforms.mixT.value = t;
    (this.material.uniforms.glassTint.value as THREE.Color).set(t > 0.5 ? '#c9d3dc' : '#8b6a4c');
  }

  update(dt: number, time: number, camera: THREE.Camera, reduceMotion: boolean): void {
    const u = this.material.uniforms;
    u.time.value = reduceMotion ? 0 : time;
    u.wind.value = reduceMotion ? 0 : 1;
    const v = u.viewer.value as THREE.Vector3;
    const p = camera.position;
    // window space: x right, y up, z into the city (three.js -z)
    v.set(p.x - this.origin.x, p.y - this.origin.y, -(p.z - this.origin.z));
    const step = reduceMotion ? 0 : dt;
    const t = u.mixT.value as number;
    // only the visible photo's world needs to move (both while they cross-fade)
    if (t < 0.999) this.worlds.evening.update(step);
    if (t > 0.001) this.worlds.day.update(step);
    u.countA.value = this.worlds.evening.count;
    u.countB.value = this.worlds.day.count;
  }

  /** Bring the tram, a boat and a plane forward (the window close-up should feel alive). */
  hurry(): void {
    this.worlds.evening.hurry();
    this.worlds.day.hurry();
  }
}
