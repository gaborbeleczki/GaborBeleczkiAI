import * as THREE from 'three';

// A dot on each thing in the room you can use, so nothing has to be found by accident. The dots
// are real buttons (reachable with Tab, labelled for screen readers) placed over the 3D view.

export interface Spot {
  id: string;
  label: string;
  at: THREE.Vector3;
  /** camera focuses in which the dot shows */
  focus: string[];
}

export class Hotspots {
  readonly root: HTMLDivElement;
  private readonly items: { spot: Spot; el: HTMLButtonElement; shown: boolean }[] = [];
  private readonly v = new THREE.Vector3();
  private named = false;

  constructor(host: HTMLElement, spots: Spot[], onPick: (id: string) => void) {
    this.root = document.createElement('div');
    this.root.className = 'spots';
    host.appendChild(this.root);
    for (const spot of spots) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'spot is-hidden';
      el.setAttribute('aria-label', spot.label);
      el.tabIndex = -1;
      el.innerHTML = `<span class="spot__dot"></span><span class="spot__label">${spot.label}</span>`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onPick(spot.id);
      });
      for (const type of ['pointerdown', 'pointerup', 'pointermove'] as const) el.addEventListener(type, (e) => e.stopPropagation());
      this.root.appendChild(el);
      this.items.push({ spot, el, shown: false });
    }
  }

  /** Show every label for a moment (a first-visit hint). */
  nameAll(on: boolean): void {
    if (this.named === on) return;
    this.named = on;
    for (const it of this.items) it.el.classList.toggle('is-named', on);
  }

  update(cam: THREE.PerspectiveCamera, focus: string, enabled: boolean, w: number, h: number): void {
    for (const it of this.items) {
      let show = enabled && it.spot.focus.includes(focus);
      if (show) {
        this.v.copy(it.spot.at).project(cam);
        show = this.v.z < 1 && Math.abs(this.v.x) < 0.96 && Math.abs(this.v.y) < 0.92;
        if (show) {
          const x = (this.v.x * 0.5 + 0.5) * w;
          const y = (-this.v.y * 0.5 + 0.5) * h;
          it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
          it.el.classList.toggle('is-left', x > w * 0.72);
        }
      }
      if (show !== it.shown) {
        it.shown = show;
        it.el.classList.toggle('is-hidden', !show);
        it.el.tabIndex = show ? 0 : -1;
      }
    }
  }

  dispose(): void {
    this.root.remove();
  }
}
