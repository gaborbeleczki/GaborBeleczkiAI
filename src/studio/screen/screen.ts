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
  onCursor(cursor: string): void;
  link(url: string, newTab?: boolean): void;
  copy(text: string): void;
  pageView(): void;
  announce(text: string): void;
}

const MENU_H = 64;
const DOCK_H = 104;
export const CONTENT: Rect = { x: 80, y: MENU_H + 36, w: W - 160, h: H - MENU_H - DOCK_H - 56 };

export class Screen {
  readonly canvas: HTMLCanvasElement;
  readonly texture: THREE.CanvasTexture;
  private readonly g: CanvasRenderingContext2D;
  private readonly prev: HTMLCanvasElement;
  private readonly regions = new Regions();
  private module: ScreenModule | null = null;
  private moduleId: FolioId = 'hello';
  private fade = 1;
  private dirty = true;
  private hoverId: string | null = null;
  private clock = '';
  private time = 0;
  private photo: HTMLImageElement | null = null;
  private loading: FolioId | null = null;
  private night = true;
  private readonly cache = new Map<FolioId, ScreenModule>();
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
    img.src = '/img/gabor.jpg';
  }

  get current(): FolioId {
    return this.moduleId;
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
    this.hoverId = null;
    this.dirty = true;
    this.host.announce(`${mod.title}. ${mod.describe()}`);
  }

  pointer(x: number, y: number, type: 'move' | 'down' | 'up' | 'leave'): void {
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
    if (this.module?.key?.(e)) {
      this.dirty = true;
      return true;
    }
    return false;
  }

  update(dt: number): void {
    this.time += dt;
    if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt / 0.35);
      this.dirty = true;
    }
    if (this.module?.update(dt, this.time)) this.dirty = true;
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Budapest' });
    if (now !== this.clock) {
      this.clock = now;
      this.dirty = true;
    }
    if (this.dirty) {
      this.draw();
      this.dirty = false;
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
    const n = folios.length;
    const size = 56;
    const gap = 18;
    const total = n * size + (n - 1) * gap + 48;
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
      const s = hov ? size + 8 : size;
      const x = x0 + 24 + i * (size + gap) - (s - size) / 2;
      const y = y0 + 14 - (hov ? 10 : 0);
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.12)';
      g.shadowBlur = hov ? 16 : 8;
      g.shadowOffsetY = 3;
      rr(g, x, y, s, s, 14);
      g.fillStyle = f.color;
      g.fill();
      g.restore();
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
  }

  dispose(): void {
    this.module?.unmount();
    this.texture.dispose();
  }
}
