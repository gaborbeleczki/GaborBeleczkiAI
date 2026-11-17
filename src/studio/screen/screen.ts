import * as THREE from 'three';
import { folios, type FolioId } from '../../../content/profile.ts';
import { C, H, MONO, Regions, W, font, rr, setTracking, type Rect } from './kit.ts';
import type { ModuleContext, ScreenModule } from './types.ts';

type Loader = () => Promise<ScreenModule>;

// Modules are separate chunks, loaded the first time their folio is opened.
const LOADERS: Record<FolioId, Loader> = {
  hello: () => import('./modules/hello.ts').then((m) => new m.Hello()),
  approach: () => import('./modules/approach.ts').then((m) => new m.Approach()),
  role: () => import('./modules/role.ts').then((m) => new m.Role()),
  work: () => import('./modules/work.ts').then((m) => new m.Work()),
  career: () => import('./modules/career.ts').then((m) => new m.Career()),
  toolkit: () => import('./modules/toolkit.ts').then((m) => new m.Toolkit()),
  faq: () => import('./modules/faq.ts').then((m) => new m.Faq()),
  contact: () => import('./modules/contact.ts').then((m) => new m.Contact()),
};

export interface ScreenHost {
  onOpen(id: FolioId): void;
  /** the dock's film tile: play the intro again */
  onLegend(): void;
  onCursor(cursor: string): void;
  link(url: string, newTab?: boolean): void;
  copy(text: string): void;
  pageView(): void;
  announce(text: string): void;
}

const MENU_H = 64;
const DOCK_H = 104;
/** The intro film: 16:9 on the 16:10 display, a bar above and below. */
const V = `?v=${import.meta.env.VITE_ASSET_V ?? '0'}`;
const FILM = { src: `/media/legend.mp4${V}`, poster: `/media/legend-poster.jpg${V}`, y: 50, h: 900 };

interface Intro {
  video: HTMLVideoElement;
  poster: HTMLImageElement;
  /** frames have started to arrive */
  rolling: boolean;
  muted: boolean;
  done(how: 'ended' | 'skipped' | 'failed'): void;
}
export const CONTENT: Rect = { x: 80, y: MENU_H + 36, w: W - 160, h: H - MENU_H - DOCK_H - 56 };

export class Screen {
  readonly canvas: HTMLCanvasElement;
  readonly texture: THREE.CanvasTexture;
  private readonly g: CanvasRenderingContext2D;
  private readonly prev: HTMLCanvasElement;
  private readonly regions = new Regions();
  private module: ScreenModule | null = null;
  private moduleId: FolioId = 'hello';
  private animDirty = false;
  private drawnAt = -1;
  private attended = false;
  private fade = 1;
  private dirty = true;
  private hoverId: string | null = null;
  private clock = '';
  private time = 0;
  private photo: HTMLImageElement | null = null;
  private loading: FolioId | null = null;
  private night = true;
  private readonly cache = new Map<FolioId, ScreenModule>();
  private intro: Intro | null = null;
  readonly ctx: ModuleContext;

  constructor(private readonly host: ScreenHost, private readonly reduceMotion: boolean) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.g = this.canvas.getContext('2d')!;
    this.prev = document.createElement('canvas');
    this.prev.width = W;
    this.prev.height = H;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.flipY = false;
    this.texture.anisotropy = 8;
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    const self = this;
    this.ctx = {
      regions: this.regions,
      get hover() {
        return self.hoverId;
      },
      reduceMotion,
      get photo() {
        return self.photo;
      },
      open: (id) => this.host.onOpen(id),
      link: (url, newTab) => this.host.link(url, newTab),
      copy: (text) => this.host.copy(text),
      pageView: () => this.host.pageView(),
      announce: (text) => this.host.announce(text),
    } as ModuleContext;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      this.photo = img;
      this.dirty = true;
    };
    img.src = '/img/intro.jpg'; // the legend's hero, generated like the film
  }

  get current(): FolioId {
    return this.moduleId;
  }

  /** Load every chapter in the background (a few KB each) so switching is instant. */
  async prefetch(): Promise<void> {
    for (const id of Object.keys(LOADERS) as FolioId[]) {
      if (this.cache.has(id)) continue;
      try {
        this.cache.set(id, await LOADERS[id]());
      } catch {
        /* offline: it will load on demand */
      }
    }
  }

  get ready(): boolean {
    return this.loading === null;
  }

  setNight(night: boolean): void {
    if (this.night !== night) {
      this.night = night;
      this.dirty = true;
    }
  }

  async show(id: FolioId): Promise<void> {
    if (this.loading === id || (this.module && this.moduleId === id)) return;
    this.loading = id;
    let mod = this.cache.get(id);
    if (!mod) {
      mod = await LOADERS[id]();
      this.cache.set(id, mod);
    }
    if (this.loading !== id) return; // a newer request won
    this.loading = null;
    // keep a snapshot of the outgoing frame for the cross-fade
    const pg = this.prev.getContext('2d')!;
    pg.clearRect(0, 0, W, H);
    pg.drawImage(this.canvas, 0, 0);
    this.module?.unmount();
    this.module = mod;
    this.moduleId = id;
    this.fade = this.reduceMotion ? 1 : 0;
    mod.mount(this.ctx);
    mod.attention?.(this.attended);
    this.hoverId = null;
    this.dirty = true;
    this.host.announce(`${mod.title}. ${mod.describe()}`);
  }

  // ------------------------------------------------------------------ the intro film

  get introPlaying(): boolean {
    return !!this.intro;
  }

  /**
   * Play the intro film on the display, with its sound. Call it from a click or a key press
   * (browsers only start sound on a gesture); if sound is refused all the same, the film plays
   * muted and the display offers a button to turn it on. Resolves when it ends or is skipped.
   */
  playIntro(): Promise<'ended' | 'skipped' | 'failed'> {
    if (this.intro) return Promise.resolve('skipped');
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = FILM.src;
      video.playsInline = true;
      video.preload = 'auto';
      video.volume = 0.9;
      const poster = new Image();
      poster.src = FILM.poster;
      poster.onload = () => (this.dirty = true);
      const intro: Intro = {
        video,
        poster,
        rolling: false,
        muted: false,
        done: (how) => {
          if (this.intro !== intro) return;
          video.pause();
          video.removeAttribute('src');
          video.load();
          // dissolve from the last frame back to the chapter
          const pg = this.prev.getContext('2d')!;
          pg.clearRect(0, 0, W, H);
          pg.drawImage(this.canvas, 0, 0);
          this.intro = null;
          this.fade = this.reduceMotion ? 1 : 0;
          this.hoverId = null;
          this.dirty = true;
          this.host.onCursor('');
          resolve(how);
        },
      };
      this.intro = intro;
      this.hoverId = null;
      this.dirty = true;
      video.addEventListener('playing', () => (intro.rolling = true));
      video.addEventListener('ended', () => intro.done('ended'));
      video.addEventListener('error', () => intro.done('failed'));
      video.play().catch(() => {
        // no sound without a gesture: start silent, offer the sound on screen
        video.muted = true;
        intro.muted = true;
        video.play().catch(() => intro.done('failed'));
      });
      this.host.announce('A one-minute film is playing on the display: The Legend of the AI Program Manager. Press Escape to skip it.');
    });
  }

  skipIntro(): void {
    this.intro?.done('skipped');
  }

  /** The tab went to the background (or came back) while the film was on. */
  holdIntro(hold: boolean): void {
    const v = this.intro?.video;
    if (!v) return;
    if (hold) v.pause();
    else void v.play().catch(() => this.intro?.done('failed'));
  }

  private drawIntro(g: CanvasRenderingContext2D, intro: Intro): void {
    const v = intro.video;
    g.fillStyle = '#050506';
    g.fillRect(0, 0, W, H);
    if (intro.rolling && v.readyState >= 2) g.drawImage(v, 0, FILM.y, W, FILM.h);
    else if (intro.poster.complete && intro.poster.naturalWidth) {
      g.globalAlpha = 0.55;
      g.drawImage(intro.poster, 0, FILM.y, W, FILM.h);
      g.globalAlpha = 1;
    }
    g.textBaseline = 'middle';
    // progress along the foot of the picture
    const p = v.duration ? Math.min(1, v.currentTime / v.duration) : 0;
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.fillRect(0, FILM.y + FILM.h - 4, W, 4);
    g.fillStyle = '#E7B56A';
    g.fillRect(0, FILM.y + FILM.h - 4, W * p, 4);
    g.font = font(20, 500, MONO);
    g.fillStyle = 'rgba(245,245,247,0.62)';
    g.textAlign = 'left';
    g.fillText('THE LEGEND OF THE AI PROGRAM MANAGER', 28, H - 25);
    const left = v.duration ? Math.max(0, Math.ceil(v.duration - v.currentTime)) : 69;
    g.fillText(`${left}s`, 28 + g.measureText('THE LEGEND OF THE AI PROGRAM MANAGER').width + 26, H - 25);
    // skip (and the sound, if the browser held it back): in the foot bar, clear of the room's own controls
    const pill = (id: string, label: string, x: number, w: number, onClick: () => void) => {
      const hov = this.hoverId === id;
      rr(g, x, H - 42, w, 34, 17);
      g.fillStyle = hov ? 'rgba(245,245,247,0.94)' : 'rgba(245,245,247,0.18)';
      g.fill();
      g.font = font(19, 600);
      g.textAlign = 'center';
      g.fillStyle = hov ? '#1D1D1F' : '#F5F5F7';
      g.fillText(label, x + w / 2, H - 24);
      this.regions.add({ id, rect: { x: x - 6, y: H - 50, w: w + 12, h: 50 }, label, onClick });
    };
    pill('intro:skip', 'Skip  ›', W - 28 - 118, 118, () => this.skipIntro());
    if (intro.muted) {
      pill('intro:sound', 'Turn the sound on', W - 28 - 118 - 16 - 230, 230, () => {
        v.muted = false;
        intro.muted = false;
        this.dirty = true;
      });
    }
    if (!intro.rolling) {
      g.textAlign = 'center';
      g.font = font(26, 500);
      g.fillStyle = 'rgba(245,245,247,0.8)';
      g.fillText('Lighting the candle…', W / 2, FILM.y + FILM.h / 2);
    }
    g.textAlign = 'left';
    g.textBaseline = 'top';
  }

  pointer(x: number, y: number, type: 'move' | 'down' | 'up' | 'leave'): void {
    if (!this.intro && this.module?.pointer?.(x, y, type)) this.dirty = true;
    if (type === 'leave') {
      if (this.hoverId) {
        this.hoverId = null;
        this.dirty = true;
      }
      this.host.onCursor('');
      return;
    }
    const r = this.regions.hit(x, y);
    const id = r?.id ?? null;
    if (id !== this.hoverId) {
      this.hoverId = id;
      this.dirty = true;
    }
    this.host.onCursor(r ? r.cursor ?? 'pointer' : 'default');
    if (type === 'up' && r?.onClick) r.onClick();
  }

  key(e: KeyboardEvent): boolean {
    if (this.intro) return false;
    if (this.module?.key?.(e)) {
      this.dirty = true;
      return true;
    }
    return false;
  }

  /** QA: whatever the current chapter wants to report (the game's state). */
  debug(): unknown {
    return (this.module as unknown as { debug?: () => unknown })?.debug?.() ?? null;
  }

  keyUp(e: KeyboardEvent): boolean {
    return !!this.module?.keyUp?.(e);
  }

  /** The visitor sits at the desk (true) or has walked away (false). */
  attention(on: boolean): void {
    this.attended = on;
    this.module?.attention?.(on);
  }

  update(dt: number): void {
    this.time += dt;
    if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt / 0.35);
      this.dirty = true;
    }
    // continuous animations (figures, the game) redraw at up to 30 fps; input redraws at once
    if (this.intro) this.animDirty = true;
    else if (this.module?.update(dt, this.time)) this.animDirty = true;
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Budapest' });
    if (now !== this.clock) {
      this.clock = now;
      this.dirty = true;
    }
    const rate = this.intro ? 30 : this.attended ? (this.module?.fps ?? 30) : 15;
    if (this.dirty || (this.animDirty && this.time - this.drawnAt >= 1 / rate - 1e-4)) {
      this.draw();
      this.dirty = false;
      this.animDirty = false;
      this.drawnAt = this.time;
      this.texture.needsUpdate = true;
    }
  }

  invalidate(): void {
    this.dirty = true;
  }

  private draw(): void {
    const g = this.g;
    this.regions.clear();
    g.save();
    g.fillStyle = C.bg;
    g.fillRect(0, 0, W, H);
    // a soft vignette of paper
    const grd = g.createRadialGradient(W * 0.5, H * 0.35, 200, W * 0.5, H * 0.5, W * 0.8);
    grd.addColorStop(0, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(233,228,218,0.35)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    g.textBaseline = 'top';
    if (this.intro) {
      this.drawIntro(g, this.intro);
      g.restore();
      return;
    }
    if (this.module) this.module.draw(g, CONTENT, this.ctx);
    this.drawMenu(g);
    this.drawDock(g);
    if (this.fade < 1) {
      g.globalAlpha = 1 - this.fade;
      g.drawImage(this.prev, 0, 0);
      g.globalAlpha = 1;
    }
    g.restore();
  }

  private drawMenu(g: CanvasRenderingContext2D): void {
    g.fillStyle = 'rgba(246,244,239,0.92)';
    g.fillRect(0, 0, W, MENU_H);
    g.fillStyle = C.line;
    g.fillRect(0, MENU_H - 1, W, 1);
    const f = folios.find((x) => x.id === this.moduleId)!;
    rr(g, 36, 22, 20, 20, 6);
    g.fillStyle = f.color;
    g.fill();
    g.strokeStyle = 'rgba(29,29,31,0.18)';
    g.lineWidth = 1.5;
    g.stroke();
    g.textBaseline = 'middle';
    g.font = font(24, 600);
    setTracking(g, -0.3);
    g.fillStyle = C.ink;
    g.fillText('Studio', 72, MENU_H / 2 + 1);
    g.font = font(24, 400);
    g.fillStyle = C.muted;
    g.fillText(`Folio ${f.n} · ${f.title}`, 72 + g.measureText('Studio').width + 70, MENU_H / 2 + 1);
    g.textAlign = 'right';
    g.font = font(22, 500, MONO);
    g.fillStyle = C.ink2;
    g.fillText(`Budapest ${this.clock}`, W - 40, MENU_H / 2 + 1);
    g.font = font(24, 500);
    g.fillStyle = C.muted;
    g.fillText(this.night ? '☾' : '☀', W - 40 - g.measureText(`Budapest ${this.clock}`).width - 40, MENU_H / 2 + 1);
    g.textAlign = 'left';
    setTracking(g, 0);
    g.textBaseline = 'top';
  }

  private drawDock(g: CanvasRenderingContext2D): void {
    const n = folios.length + 1; // the chapters, then the film
    const size = 56;
    const gap = 18;
    const total = n * size + (n - 1) * gap + 48 + 14;
    const x0 = (W - total) / 2;
    const y0 = H - DOCK_H + 8;
    g.save();
    g.shadowColor = 'rgba(29,45,61,0.14)';
    g.shadowBlur = 30;
    g.shadowOffsetY = 6;
    rr(g, x0, y0, total, size + 28, 30);
    g.fillStyle = 'rgba(255,255,255,0.78)';
    g.fill();
    g.restore();
    rr(g, x0, y0, total, size + 28, 30);
    g.strokeStyle = 'rgba(29,29,31,0.08)';
    g.lineWidth = 1.5;
    g.stroke();
    folios.forEach((f, i) => {
      const id = `dock:${f.id}`;
      const hov = this.hoverId === id;
      const active = f.id === this.moduleId;
      // icons stay put: hover only rings the icon, nothing jumps or grows
      const s = size;
      const x = x0 + 24 + i * (size + gap);
      const y = y0 + 14;
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.12)';
      g.shadowBlur = 8;
      g.shadowOffsetY = 3;
      rr(g, x, y, s, s, 14);
      g.fillStyle = f.color;
      g.fill();
      g.restore();
      if (hov) {
        rr(g, x - 4, y - 4, s + 8, s + 8, 17);
        g.strokeStyle = 'rgba(42,93,143,0.55)';
        g.lineWidth = 3;
        g.stroke();
      }
      const dark = ['#1D2D3D', '#416180', '#C8432B'].includes(f.color);
      g.fillStyle = dark ? '#F5F5F7' : C.ink;
      g.font = font(20, 600, MONO);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(f.n, x + s / 2, y + s / 2 + 1);
      g.textAlign = 'left';
      g.textBaseline = 'top';
      if (active) {
        g.beginPath();
        g.arc(x0 + 24 + i * (size + gap) + size / 2, y0 + size + 22, 3.5, 0, Math.PI * 2);
        g.fillStyle = C.ink2;
        g.fill();
      }
      if (hov) {
        g.font = font(20, 500);
        const label = f.title;
        const lw = g.measureText(label).width + 28;
        const lx = x + s / 2 - lw / 2;
        rr(g, lx, y - 48, lw, 36, 10);
        g.fillStyle = 'rgba(29,29,31,0.86)';
        g.fill();
        g.fillStyle = '#F5F5F7';
        g.textBaseline = 'middle';
        g.fillText(label, lx + 14, y - 30);
        g.textBaseline = 'top';
      }
      this.regions.add({ id, rect: { x: x0 + 24 + i * (size + gap) - 4, y: y0 + 6, w: size + 8, h: size + 20 }, label: f.title, onClick: () => this.host.onOpen(f.id) });
    });
    // the film tile, set a little apart
    {
      const id = 'dock:legend';
      const hov = this.hoverId === id;
      const x = x0 + 24 + folios.length * (size + gap) + 14;
      const y = y0 + 14;
      g.fillStyle = 'rgba(29,29,31,0.12)';
      g.fillRect(x - 16, y + 6, 1.5, size - 12);
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.16)';
      g.shadowBlur = 8;
      g.shadowOffsetY = 3;
      rr(g, x, y, size, size, 14);
      const grd = g.createLinearGradient(x, y, x, y + size);
      grd.addColorStop(0, '#3B2A1E');
      grd.addColorStop(1, '#15110D');
      g.fillStyle = grd;
      g.fill();
      g.restore();
      g.fillStyle = '#E7B56A';
      g.beginPath();
      g.moveTo(x + 22, y + 17);
      g.lineTo(x + 40, y + 28);
      g.lineTo(x + 22, y + 39);
      g.closePath();
      g.fill();
      if (hov) {
        rr(g, x - 4, y - 4, size + 8, size + 8, 17);
        g.strokeStyle = 'rgba(42,93,143,0.55)';
        g.lineWidth = 3;
        g.stroke();
        g.font = font(20, 500);
        const label = 'The legend · 1 min film';
        const lw = g.measureText(label).width + 28;
        const lx = Math.min(x + size / 2 - lw / 2, W - lw - 24);
        rr(g, lx, y - 48, lw, 36, 10);
        g.fillStyle = 'rgba(29,29,31,0.86)';
        g.fill();
        g.fillStyle = '#F5F5F7';
        g.textBaseline = 'middle';
        g.fillText(label, lx + 14, y - 30);
        g.textBaseline = 'top';
      }
      this.regions.add({ id, rect: { x: x - 4, y: y0 + 6, w: size + 8, h: size + 20 }, label: 'The legend, a one-minute film', onClick: () => this.host.onLegend() });
    }
  }

  dispose(): void {
    this.intro?.done('skipped');
    this.module?.unmount();
    this.texture.dispose();
  }
}
