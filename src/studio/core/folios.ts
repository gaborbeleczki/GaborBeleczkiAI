import * as THREE from 'three';
import { folios as FOLIOS, type FolioId } from '../../../content/profile.ts';
import { Glide, Spring } from './physics.ts';

interface FolioState {
  id: FolioId;
  mesh: THREE.Object3D;
  restPos: THREE.Vector3;
  restQuat: THREE.Quaternion;
  /** pulled out a little under the pointer; a light spring, so it springs back with a wobble */
  hover: Spring;
  /** 0 = on the shelf, 1 = lying on the desk (soft start and landing) */
  travel: Glide;
  /** a small rock when it lands on the desk or slides home into the shelf */
  rock: Spring;
  landed: boolean;
}

const DARK = new Set(['#1D2D3D', '#416180', '#C8432B']);

function spineTexture(n: string, title: string, color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 512;
  const g = c.getContext('2d')!;
  const dark = DARK.has(color);
  // label card
  g.fillStyle = dark ? 'rgba(245,242,236,0.92)' : 'rgba(29,29,31,0.9)';
  g.beginPath();
  g.roundRect(18, 40, 92, 300, 14);
  g.fill();
  g.save();
  g.translate(64, 190);
  g.rotate(-Math.PI / 2);
  g.fillStyle = dark ? '#1D1D1F' : '#F5F2EC';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '600 46px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter Variable", Inter, sans-serif';
  g.fillText(title, 0, 4);
  g.restore();
  g.fillStyle = dark ? '#F5F2EC' : '#1D1D1F';
  g.textAlign = 'center';
  g.font = '600 40px ui-monospace, "SF Mono", Menlo, monospace';
  g.fillText(n, 64, 420);
  // thumb hole
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath();
  g.ellipse(64, 470, 20, 10, 0, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Folios {
  readonly list: FolioState[] = [];
  private active: FolioId | null = null;
  private readonly deskPos: THREE.Vector3;
  private readonly deskQuat: THREE.Quaternion;

  constructor(root: THREE.Object3D, deskSpot: THREE.Vector3, size: [number, number, number], private readonly reduceMotion: boolean) {
    const [depth, height, width] = size;
    // lying flat beside the keyboard: local Z up, spine (local +X) towards the room
    const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0));
    this.deskQuat = new THREE.Quaternion().setFromRotationMatrix(basis).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.22));
    this.deskPos = deskSpot.clone().add(new THREE.Vector3(-height / 2, width / 2 + 0.002, 0));
    FOLIOS.forEach((f, i) => {
      const mesh = root.getObjectByName(`folio_${String(i).padStart(2, '0')}`);
      if (!mesh) return;
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(0.056, 0.224),
        new THREE.MeshStandardMaterial({ map: spineTexture(f.n, f.title, f.color), transparent: true, roughness: 0.7, metalness: 0 }),
      );
      label.rotation.y = Math.PI / 2;
      label.position.set(depth / 2 + 0.0016, 0.158, 0);
      label.name = `folio_label_${i}`;
      label.raycast = () => {};
      mesh.add(label);
      this.list.push({
        id: f.id,
        mesh,
        restPos: mesh.position.clone(),
        restQuat: mesh.quaternion.clone(),
        hover: new Spring(0, 3.4, 0.42),
        travel: new Glide(0, 0.95),
        rock: new Spring(0, 3.2, 0.22),
        landed: false,
      });
    });
  }

  setHover(id: FolioId | null): void {
    for (const f of this.list) f.hover.target = f.id === id && f.travel.goal === 0 ? 1 : 0;
  }

  select(id: FolioId | null): void {
    if (this.active === id) return;
    this.active = id;
    for (const f of this.list) {
      f.travel.to(f.id === id ? 1 : 0);
      if (this.reduceMotion) f.travel.snap(f.travel.goal);
    }
  }

  get busy(): boolean {
    return this.list.some((f) => !f.travel.settled || !f.hover.settled || !f.rock.settled);
  }

  /** Physics step (fixed rate). */
  step(h: number): void {
    for (const f of this.list) {
      f.hover.step(h);
      f.travel.step(h);
      f.rock.step(h);
      const t = f.travel.value;
      // landing on the desk, or sliding back home: a rock proportional to the arrival speed
      const atEnd = f.travel.goal === 1 ? t > 0.985 : t < 0.015;
      if (atEnd && !f.landed && !this.reduceMotion) f.rock.velocity += (f.travel.goal === 1 ? 1 : -0.6) * Math.min(4, 2 + Math.abs(f.travel.velocity) * 3);
      f.landed = atEnd;
    }
  }

  update(): void {
    for (const f of this.list) this.place(f);
  }

  private place(f: FolioState): void {
    const out = new THREE.Vector3(1, 0, 0).applyQuaternion(f.restQuat);
    const pulled = f.restPos.clone().addScaledVector(out, 0.035 * Math.max(-0.2, f.hover.value));
    const travel = THREE.MathUtils.clamp(f.travel.value, 0, 1);
    const rock = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), f.rock.value * 0.035);
    if (travel <= 1e-4) {
      f.mesh.position.copy(pulled);
      f.mesh.quaternion.copy(f.restQuat).multiply(rock);
      return;
    }
    // slide out of the shelf first (0..0.25), then arc over to the desk (0.25..1)
    const t = travel;
    const slide = Math.min(1, t / 0.25);
    const outPos = f.restPos.clone().addScaledVector(out, 0.035 + 0.2 * ease(slide)).add(new THREE.Vector3(0, 0.02 * slide, 0));
    if (t <= 0.25) {
      f.mesh.position.copy(outPos);
      f.mesh.quaternion.copy(f.restQuat);
      return;
    }
    const k = ease((t - 0.25) / 0.75);
    const ctrl = outPos.clone().lerp(this.deskPos, 0.5).add(new THREE.Vector3(0, 0.45, 0));
    const a = outPos.clone().lerp(ctrl, k);
    const b = ctrl.clone().lerp(this.deskPos, k);
    f.mesh.position.copy(a.lerp(b, k));
    f.mesh.quaternion.copy(f.restQuat).slerp(this.deskQuat, k).multiply(rock);
  }
}
