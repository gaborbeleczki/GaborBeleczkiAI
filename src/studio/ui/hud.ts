import { folios, type FolioId } from '../../../content/profile.ts';
import './hud.css';

const ICON = {
  back: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sun: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  moon: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.2 10.2A5.6 5.6 0 0 1 5.8 2.8a5.6 5.6 0 1 0 7.4 7.4Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  sound: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6.2h2.6L8.5 3.3v9.4L5.1 9.8H2.5Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M10.8 5.6a3.4 3.4 0 0 1 0 4.8M12.6 3.9a5.8 5.8 0 0 1 0 8.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  page: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.8h5.2L12.5 5v9.2H4Z M9 1.8V5.2h3.5 M6 8.5h4.5 M6 11h4.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  list: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 4h8M5.5 8h8M5.5 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="2.6" cy="4" r="1" fill="currentColor"/><circle cx="2.6" cy="8" r="1" fill="currentColor"/><circle cx="2.6" cy="12" r="1" fill="currentColor"/></svg>',
};

export interface HudActions {
  back(): void;
  toggleLights(): void;
  toggleSound(): void;
  pageView(): void;
  open(id: FolioId): void;
}

export class Hud {
  readonly root: HTMLDivElement;
  private readonly hint: HTMLDivElement;
  private readonly tip: HTMLDivElement;
  private readonly live: HTMLDivElement;
  private readonly backBtn: HTMLButtonElement;
  private readonly lightsBtn: HTMLButtonElement;
  private readonly soundBtn: HTMLButtonElement;
  private readonly ring: SVGCircleElement;
  private readonly pct: HTMLParagraphElement;
  private readonly menu: HTMLDivElement;

  constructor(host: HTMLElement, private readonly actions: HudActions) {
    const root = document.createElement('div');
    root.className = 'hud';
    root.innerHTML = `
      <div class="hud__brand glass"><span class="mono">GB</span>Gábor Béleczki<small>· Studio</small></div>
      <div class="hud__controls glass" role="toolbar" aria-label="Studio controls">
        <button type="button" class="hud__btn" data-act="lights" aria-pressed="false" title="Day or evening (L)">${ICON.moon}<span class="label">Evening</span></button>
        <button type="button" class="hud__btn" data-act="sound" aria-pressed="false" title="Music (M)">${ICON.sound}<span class="label">Music</span></button>
        <button type="button" class="hud__btn" data-act="menu" aria-expanded="false" title="Chapters">${ICON.list}<span class="label">Chapters</span></button>
        <button type="button" class="hud__btn" data-act="page" title="Read as a page">${ICON.page}<span class="label">Page</span></button>
      </div>
      <button type="button" class="hud__btn hud__back glass" data-act="back">${ICON.back}<span>Studio</span></button>
      <div class="hud__menu glass" role="menu" aria-label="Chapters">
        ${folios
          .map((f) => `<button type="button" role="menuitem" data-open="${f.id}"><span class="sw" style="background:${f.color}"></span>${f.n} · ${f.title}</button>`)
          .join('')}
      </div>
      <div class="hud__hint glass" aria-hidden="true"></div>
      <div class="hud__tip" aria-hidden="true"></div>
      <div class="hud__loader glass" role="status">
        <svg class="hud__ring" viewBox="0 0 54 54"><circle class="bg" cx="27" cy="27" r="23"/><circle class="fg" cx="27" cy="27" r="23" stroke-dasharray="144.5" stroke-dashoffset="144.5" transform="rotate(-90 27 27)"/></svg>
        <h2>Preparing the studio</h2>
        <p>Loading 0%</p>
        <a data-act="page">Read the page instead</a>
      </div>
      <div class="sr-only" aria-live="polite"></div>
    `;
    host.appendChild(root);
    this.root = root;
    this.hint = root.querySelector('.hud__hint')!;
    this.tip = root.querySelector('.hud__tip')!;
    this.live = root.querySelector('[aria-live]')!;
    this.backBtn = root.querySelector('.hud__back')!;
    this.lightsBtn = root.querySelector('[data-act="lights"]')!;
    this.soundBtn = root.querySelector('[data-act="sound"]')!;
    this.ring = root.querySelector('.hud__ring .fg')!;
    this.pct = root.querySelector('.hud__loader p')!;
    this.menu = root.querySelector('.hud__menu')!;
    root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act],[data-open]');
      if (!el) return;
      e.stopPropagation();
      const open = el.dataset.open as FolioId | undefined;
      if (open) {
        this.toggleMenu(false);
        return this.actions.open(open);
      }
      switch (el.dataset.act) {
        case 'back':
          return this.actions.back();
        case 'lights':
          return this.actions.toggleLights();
        case 'sound':
          return this.actions.toggleSound();
        case 'page':
          return this.actions.pageView();
        case 'menu':
          return this.toggleMenu();
      }
    });
    // keep pointer events on the HUD from reaching the 3D canvas
    for (const type of ['pointerdown', 'pointerup', 'pointermove', 'wheel'] as const) {
      root.addEventListener(type, (e) => {
        if ((e.target as HTMLElement) !== root) e.stopPropagation();
      });
    }
  }

  toggleMenu(force?: boolean): void {
    const open = force ?? !this.menu.classList.contains('is-open');
    this.menu.classList.toggle('is-open', open);
    this.root.querySelector('[data-act="menu"]')!.setAttribute('aria-expanded', String(open));
    if (open) this.menu.querySelector('button')?.focus();
  }

  progress(p: number): void {
    const v = Math.max(0, Math.min(1, p));
    this.ring.setAttribute('stroke-dashoffset', String(144.5 * (1 - v)));
    this.pct.textContent = `Loading ${Math.round(v * 100)}%`;
  }

  setHint(html: string): void {
    this.hint.innerHTML = html;
  }

  setFocused(focused: boolean): void {
    this.backBtn.classList.toggle('is-on', focused);
  }

  setNight(night: boolean): void {
    this.lightsBtn.innerHTML = `${night ? ICON.moon : ICON.sun}<span class="label">${night ? 'Evening' : 'Day'}</span>`;
    this.lightsBtn.setAttribute('aria-pressed', String(!night));
    this.lightsBtn.setAttribute('aria-label', night ? 'Evening light. Switch to day' : 'Daylight. Switch to evening');
  }

  setSound(on: boolean): void {
    this.soundBtn.setAttribute('aria-pressed', String(on));
  }

  setCurrent(id: FolioId): void {
    this.menu.querySelectorAll('button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.open === id)));
  }

  showTip(text: string | null, x = 0, y = 0): void {
    if (!text) {
      this.tip.classList.remove('is-on');
      return;
    }
    this.tip.textContent = text;
    this.tip.style.left = `${x}px`;
    this.tip.style.top = `${y}px`;
    this.tip.classList.add('is-on');
  }

  announce(text: string): void {
    this.live.textContent = '';
    window.setTimeout(() => (this.live.textContent = text), 30);
  }

  dispose(): void {
    this.root.remove();
  }
}
