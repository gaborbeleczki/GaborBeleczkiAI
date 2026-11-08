import * as THREE from 'three';
import { profile } from '../../../content/profile.ts';
import { NOTEBOOK_THEME, notebookBlocks } from '../print/chapters.ts';
import { Book, paperMaterial, type BookGeom } from './book.ts';
import { carrier, Flight, readPose, type ReadFit } from './held.ts';
import { Spring } from './physics.ts';

// The desk's small objects, each a way into the portfolio: business cards to take, the printed
// CV, the phone, the notebook of build notes, and a brass armillary sphere that spins.

const SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter Variable", Inter, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
const UP = new THREE.Vector3(0, 1, 0);

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
  href?: string;
  act?: string;
  label: string;
}

function canvasTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Something small you pick up and hold: a card, a sheet, the phone. */
export class Held {
  readonly flight: Flight;
  readonly frame = new THREE.Object3D();
  /** turn the object over (radians about its vertical axis) */
  readonly flip = new Spring(0, 1.6, 0.78);
  /** 0 = the whole object, 1 = close up on `focus` */
  readonly zoom = new Spring(0, 1.4, 1);
  readonly focus = new THREE.Vector2();
  private readonly holder = new THREE.Object3D();
  private readonly pos = new THREE.Vector3();
  private readonly quat = new THREE.Quaternion();
  faces: THREE.Mesh[] = [];
  regions: Region[] = [];
  /** the faces only show while held (they float just off the real surface) */
  hideAtRest = true;

  constructor(
    readonly id: string,
    readonly node: THREE.Object3D,
    /** size (m) of the face, u by v */
    readonly size: [number, number],
    /** where the face sits in the node (its centre, facing +w) */
    framePos: THREE.Vector3,
    frameQuat: THREE.Quaternion,
    private readonly fill: number,
    lift: number,
  ) {
    this.flight = new Flight(node, { out: UP, outDist: lift, time: 0.8 });
    this.frame.position.copy(framePos);
    this.frame.quaternion.copy(frameQuat);
    node.add(this.frame);
    this.frame.add(this.holder);
  }

  /** Two-sided face: front and back canvases (or textures). */
  setFaces(front: THREE.Texture, back: THREE.Texture | null): void {
    const [w, h] = this.size;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, h), paperMaterial());
    f.material.uniforms.front.value = front;
    f.position.z = 0.0003;
    f.userData.face = 'front';
    this.holder.add(f);
    this.faces = [f];
    if (back) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(w, h), paperMaterial());
      b.material.uniforms.front.value = back;
      b.rotation.y = Math.PI;
      b.position.z = -0.0003;
      b.userData.face = 'back';
      this.holder.add(b);
      this.faces.push(b);
    }
  }

  get isOpen(): boolean {
    return this.flight.away;
  }

  get busy(): boolean {
    return this.flight.away || !this.flip.settled || !this.zoom.settled;
  }

  open(reduceMotion: boolean): void {
    this.flip.snap(0);
    this.zoom.snap(0);
    this.flight.travel.to(1);
    if (reduceMotion) this.flight.travel.snap(1);
  }

  close(reduceMotion: boolean): void {
    this.flip.target = 0;
    this.zoom.target = 0;
    this.flight.travel.to(0);
    if (reduceMotion) {
      this.flip.snap(0);
      this.zoom.snap(0);
      this.flight.travel.snap(0);
    }
  }

  turnOver(): void {
    this.flip.target = this.flip.target > Math.PI / 2 ? 0 : Math.PI;
  }

  step(h: number): void {
    this.flight.travel.step(h);
    this.flip.step(h);
    this.zoom.step(h);
  }

  update(cam: THREE.PerspectiveCamera): void {
    const [w, h] = this.size;
    const z = THREE.MathUtils.clamp(this.zoom.value, 0, 1);
    const fit: ReadFit = {
      w: THREE.MathUtils.lerp(w, w * 0.42, z),
      h: THREE.MathUtils.lerp(h, h * 0.42, z),
      center: new THREE.Vector3(this.focus.x * w * z, this.focus.y * h * z, 0),
      tilt: THREE.MathUtils.lerp(0.16, 0.04, z),
      fill: this.fill,
    };
    if (this.flight.away) readPose(cam, this.frame.quaternion, this.frame.position, fit, this.pos, this.quat);
    this.flight.place(this.pos, this.quat);
    this.holder.rotation.y = this.flip.value;
    if (this.hideAtRest) for (const f of this.faces) f.visible = this.flight.value > 0.02;
  }

  /** The region under a face hit (canvas pixels of a W×H face canvas). */
  regionAt(uv: THREE.Vector2, cw: number, ch: number): Region | null {
    const x = uv.x * cw;
    const y = (1 - uv.y) * ch;
    return this.regions.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) ?? null;
  }

  setTint(c: THREE.Color): void {
    for (const f of this.faces) ((f.material as THREE.ShaderMaterial).uniforms.tint.value as THREE.Color).copy(c);
  }
}

// ------------------------------------------------------------------ business card

export const CARD_PX: [number, number] = [1024, 598];

function cardFront(): { canvas: HTMLCanvasElement; regions: Region[] } {
  const [W, H] = CARD_PX;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#FBF9F4';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#1D2D3D';
  g.fillRect(0, 0, 14, H);
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#1D1D1F';
  g.font = `700 64px ${SANS}`;
  g.fillText(profile.name, 76, 132);
  g.font = `500 34px ${SANS}`;
  g.fillStyle = '#3D3D41';
  g.fillText(profile.role, 78, 190);
  g.fillStyle = '#6E6E73';
  g.font = `400 30px ${SANS}`;
  g.fillText(`${profile.org} · ${profile.orgUnit}`, 78, 236);
  g.fillStyle = 'rgba(29,29,31,0.12)';
  g.fillRect(78, 290, W - 156, 3);
  const regions: Region[] = [];
  const row = (label: string, value: string, y: number, href: string) => {
    g.font = `600 22px ${MONO}`;
    g.fillStyle = '#9A9AA0';
    g.fillText(label, 78, y);
    g.font = `500 34px ${SANS}`;
    g.fillStyle = '#2A5D8F';
    g.fillText(value, 250, y);
    const w = g.measureText(value).width;
    g.fillRect(250, y + 10, w, 2);
    regions.push({ x: 236, y: y - 44, w: w + 30, h: 66, href, label: value });
  };
  row('EMAIL', profile.email, 370, `mailto:${profile.email}`);
  row('LINKEDIN', 'in/gaborbeleczki', 440, profile.linkedin);
  g.font = `600 22px ${MONO}`;
  g.fillStyle = '#9A9AA0';
  g.fillText('BASED IN', 78, 510);
  g.font = `400 32px ${SANS}`;
  g.fillStyle = '#3D3D41';
  g.fillText(profile.location, 250, 510);
  return { canvas: c, regions };
}

function cardBack(): HTMLCanvasElement {
  const [W, H] = CARD_PX;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1D2D3D';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#F3EFE6';
  g.textAlign = 'center';
  g.font = `700 150px ${SANS}`;
  g.fillText('GB', W / 2, H / 2 + 30);
  g.font = `500 30px ${SANS}`;
  g.fillStyle = 'rgba(243,239,230,0.7)';
  g.fillText(profile.tagline, W / 2, H / 2 + 110);
  return c;
}

// ------------------------------------------------------------------ phone

export const PHONE_PX: [number, number] = [644, 1392];

export class PhoneScreen {
  readonly canvas = document.createElement('canvas');
  readonly texture: THREE.CanvasTexture;
  regions: Region[] = [];
  private photo: HTMLImageElement | null = null;
  private drawnMinute = '';
  wake = new Spring(0, 2.2, 1);

  constructor() {
    this.canvas.width = PHONE_PX[0];
    this.canvas.height = PHONE_PX[1];
    this.texture = canvasTexture(this.canvas);
    this.texture.anisotropy = 4;
    // the screen quad comes from glTF, whose UVs run top-down
    this.texture.flipY = false;
    const img = new Image();
    img.onload = () => {
      this.photo = img;
      this.drawnMinute = '';
    };
    img.src = '/img/gabor.jpg';
  }

  /** Redraw when the minute changes or the brightness moves. */
  draw(force = false): void {
    const now = new Date();
    const minute = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Budapest' });
    const b = THREE.MathUtils.clamp(this.wake.value, 0, 1);
    const key = `${minute}|${b.toFixed(2)}`;
    if (!force && key === this.drawnMinute) return;
    this.drawnMinute = key;
    const [W, H] = PHONE_PX;
    const g = this.canvas.getContext('2d')!;
    g.globalAlpha = 1;
    g.fillStyle = '#050506';
    g.fillRect(0, 0, W, H);
    if (b < 0.01) {
      this.texture.needsUpdate = true;
      return;
    }
    g.globalAlpha = b;
    // a calm wallpaper: dusk over the river
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#22344A');
    grd.addColorStop(0.55, '#5A6E8C');
    grd.addColorStop(0.78, '#C99A7E');
    grd.addColorStop(1, '#2B3346');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(10,14,22,0.35)';
    g.beginPath();
    g.moveTo(0, H * 0.83);
    for (let x = 0; x <= W; x += 16) g.lineTo(x, H * 0.83 - 26 * Math.sin(x / 90) - 14 * Math.sin(x / 37));
    g.lineTo(W, H);
    g.lineTo(0, H);
    g.fill();
    g.textAlign = 'center';
    g.fillStyle = '#F5F5F7';
    g.font = `600 30px ${SANS}`;
    g.fillText('Budapest', W / 2, 92);
    g.font = `300 168px ${SANS}`;
    g.fillText(minute, W / 2, 290);
    g.font = `500 34px ${SANS}`;
    g.fillText(now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Budapest' }), W / 2, 350);
    // a contact card, like a widget
    const x = 40;
    const y = 470;
    const w = W - 80;
    const h = 600;
    g.fillStyle = 'rgba(245,245,247,0.86)';
    g.beginPath();
    g.roundRect(x, y, w, h, 46);
    g.fill();
    if (this.photo) {
      g.save();
      g.beginPath();
      g.arc(W / 2, y + 120, 78, 0, Math.PI * 2);
      g.clip();
      const iw = this.photo.naturalWidth;
      const ih = this.photo.naturalHeight;
      const sc = 156 / Math.min(iw, ih);
      g.drawImage(this.photo, W / 2 - (iw * sc) / 2, y + 42, iw * sc, ih * sc);
      g.restore();
    }
    g.fillStyle = '#1D1D1F';
    g.font = `700 46px ${SANS}`;
    g.fillText(profile.name, W / 2, y + 262);
    g.fillStyle = '#3D3D41';
    g.font = `400 30px ${SANS}`;
    g.fillText(profile.role, W / 2, y + 310);
    g.fillStyle = '#6E6E73';
    g.font = `400 26px ${SANS}`;
    g.fillText(profile.openTo.title.replace('Open to ', 'Open to: '), W / 2, y + 356, w - 60);
    this.regions = [];
    const btn = (label: string, by: number, fill: string, ink: string, href: string) => {
      g.fillStyle = fill;
      g.beginPath();
      g.roundRect(x + 40, by, w - 80, 92, 46);
      g.fill();
      g.fillStyle = ink;
      g.font = `600 32px ${SANS}`;
      g.fillText(label, W / 2, by + 58);
      this.regions.push({ x: x + 40, y: by, w: w - 80, h: 92, href, label });
    };
    btn('View LinkedIn profile ↗', y + 400, '#1D2D3D', '#F5F5F7', profile.linkedin);
    btn('Write an email', y + 504 - 2, 'rgba(29,45,61,0.1)', '#1D2D3D', `mailto:${profile.email}`);
    g.textAlign = 'left';
    g.globalAlpha = 1;
    this.texture.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ the desk

export interface DeskDims {
  notebook: { w: number; h: number; cover_t: number; pages_t: number; page_w: number; page_h: number; page_x: number };
}

export class Desk {
  readonly notebook: Book | null = null;
  readonly card: Held | null = null;
  readonly cv: Held | null = null;
  readonly phone: Held | null = null;
  readonly phoneScreen = new PhoneScreen();
  private readonly rings: { node: THREE.Object3D; rest: THREE.Quaternion }[] = [];
  private readonly spin = { angle: 0, rate: 0 };
  private center = new THREE.Vector3();
  private steam: THREE.Points | null = null;
  private steamAge = 99;
  private readonly steamBase = new THREE.Vector3();

  constructor(root: THREE.Object3D, coffee: THREE.Vector3 | null, private readonly reduceMotion: boolean) {
    // ---- notebook: a Book with the build notes
    const nbNode = root.getObjectByName('notebook');
    const nbCover = nbNode?.getObjectByName('notebook_cover');
    if (nbNode) {
      // the linen weave is procedural in Blender and does not travel through glTF: give the
      // notebook its colours back
      const linen = new THREE.MeshStandardMaterial({ color: '#2D4257', roughness: 0.92, metalness: 0 });
      const cream = new THREE.MeshStandardMaterial({ color: '#F2ECDF', roughness: 0.95, metalness: 0 });
      nbNode.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        if (/notebook_(back|cover|spine)/.test(m.name)) m.material = linen;
        else if (m.name === 'notebook_block') m.material = cream;
      });
    }
    if (nbNode && nbCover) {
      const n = { w: 0.15, h: 0.21, cover_t: 0.0022, pages_t: 0.0116, page_w: 0.142, page_h: 0.202, page_x: 0.004 };
      const frame = new THREE.Object3D();
      frame.position.set(-n.w / 2, n.cover_t + n.pages_t, n.h / 2);
      frame.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
      nbNode.add(frame);
      const geom: BookGeom = {
        boardW: n.w,
        boardH: n.h,
        boardT: n.cover_t,
        gap: 0,
        pageW: n.page_w,
        pageH: n.page_h,
        pageU: n.page_x,
        pageV: (n.h - n.page_h) / 2,
      };
      const book = new Book('notebook', nbNode, nbCover, frame, geom, () => ({ blocks: notebookBlocks(), theme: NOTEBOOK_THEME, endpaper: { color: '#2D4257', dark: true, n: '', kicker: 'Notebook', title: 'Notes' } }), UP, 0.07, reduceMotion);
      const band = nbNode.getObjectByName('notebook_band');
      if (band) book.attachBand(band);
      (this as { notebook: Book | null }).notebook = book;
    }
    // ---- business card: the top card of the stack
    const cardNode = root.getObjectByName('card_top') as THREE.Mesh | undefined;
    if (cardNode) {
      const held = new Held('cards', carrier(cardNode), [0.089, 0.052], new THREE.Vector3(0, 0, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), 0.46, 0.05);
      const front = cardFront();
      held.setFaces(canvasTexture(front.canvas), canvasTexture(cardBack()));
      held.regions = front.regions;
      cardNode.material = new THREE.MeshStandardMaterial({ color: '#F7F3EA', roughness: 0.85 });
      (this as { card: Held | null }).card = held;
    }
    // ---- the CV: the top sheet of the pile
    const cvNode = root.getObjectByName('cv_sheet') as THREE.Mesh | undefined;
    if (cvNode) {
      const held = new Held('cv', carrier(cvNode), [0.21, 0.297], new THREE.Vector3(0, 0.0003, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), 0.9, 0.06);
      const tex = new THREE.TextureLoader().load('/textures/cv_page.webp', (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        t.needsUpdate = true;
        // the sheet on the desk comes from glTF, whose UVs run top-down
        const onDesk = t.clone();
        onDesk.flipY = false;
        onDesk.needsUpdate = true;
        (cvNode.material as THREE.MeshStandardMaterial).map = onDesk;
        (cvNode.material as THREE.MeshStandardMaterial).needsUpdate = true;
      });
      held.setFaces(tex, null);
      cvNode.material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
      (this as { cv: Held | null }).cv = held;
    }
    // ---- the phone
    const phoneNode = root.getObjectByName('phone');
    const screen = phoneNode?.getObjectByName('phone_screen') as THREE.Mesh | undefined;
    if (phoneNode && screen) {
      const held = new Held('phone', phoneNode, [0.0644, 0.1392], new THREE.Vector3(0, 0.0086, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), 0.56, 0.05);
      screen.material = new THREE.MeshBasicMaterial({ map: this.phoneScreen.texture, toneMapped: false });
      screen.userData.phoneScreen = true;
      held.faces = [screen];
      held.hideAtRest = false;
      (this as { phone: Held | null }).phone = held;
      this.phoneScreen.draw(true);
    }
    // soft shadows under the things you can lift (the bake leaves the desk clean under them)
    if (nbNode && this.notebook) this.contactShadow(nbNode, 0.15, 0.21, 0.5, () => this.notebook!.flight.value);
    if (phoneNode && this.phone) this.contactShadow(phoneNode, 0.0716, 0.1466, 0.55, () => this.phone!.flight.value);
    // ---- armillary sphere: the rings turn together about the vertical axis
    root.traverse((o) => {
      if (o.userData?.dyn === 'armillary') this.rings.push({ node: o, rest: o.quaternion.clone() });
    });
    if (this.rings.length) this.center.copy(this.rings[0].node.position);
    // ---- steam over the coffee
    if (coffee && !reduceMotion) {
      const n = 14;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(n), 1));
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { scale: { value: 600 } },
        vertexShader: /* glsl */ `
          attribute float alpha;
          uniform float scale;
          varying float vA;
          void main() {
            vA = alpha;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = scale * 0.022 / -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying float vA;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d) * vA * 0.32;
            gl_FragColor = vec4(vec3(0.97, 0.96, 0.94), a);
          }`,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      pts.visible = false;
      this.steamBase.copy(coffee).add(new THREE.Vector3(0, -0.02, 0));
      this.steam = pts;
      root.add(pts);
    }
  }

  /** A soft live shadow under an object resting on the desk; it fades as the object lifts. */
  private contactShadow(node: THREE.Object3D, w: number, d: number, strength: number, away: () => number): void {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const pad = 128 * (1 - 1 / 1.4) / 2;
    // draw the rectangle off canvas and keep only its blurred shadow
    g.shadowColor = 'rgba(0,0,0,1)';
    g.shadowBlur = 14;
    g.shadowOffsetX = 400;
    g.fillStyle = '#000';
    g.beginPath();
    g.roundRect(pad - 400, pad, 128 - 2 * pad, 128 - 2 * pad, 10);
    g.fill();
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: '#000000', transparent: true, depthWrite: false, opacity: strength, toneMapped: false });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.4, d * 1.4), mat);
    plane.rotation.x = -Math.PI / 2;
    const holder = new THREE.Object3D();
    holder.position.copy(node.position);
    holder.position.y += 0.0007;
    holder.quaternion.copy(node.quaternion);
    holder.add(plane);
    plane.raycast = () => {};
    node.parent?.add(holder);
    this.shadows.push({ mat, base: strength, away });
  }

  private readonly shadows: { mat: THREE.MeshBasicMaterial; base: number; away: () => number }[] = [];

  get helds(): Held[] {
    return [this.card, this.cv, this.phone].filter((h): h is Held => !!h);
  }

  /** Give the sphere a turn; `dir` is +1 or -1. */
  spinGlobe(dir = 1): void {
    this.spin.rate += dir * (this.reduceMotion ? 0 : 5.5);
    if (this.reduceMotion) this.spin.angle += dir * 0.6;
  }

  /** A curl of steam rises from the mug for a few seconds. */
  pour(): void {
    this.steamAge = 0;
  }

  get busy(): boolean {
    return Math.abs(this.spin.rate) > 0.01 || this.steamAge < 6 || this.helds.some((h) => h.busy) || !!this.notebook?.busy;
  }

  step(h: number): void {
    // bearings: a little viscous drag and a little dry friction, so it coasts and then stops
    const s = this.spin;
    s.rate -= s.rate * 0.55 * h + Math.sign(s.rate) * Math.min(Math.abs(s.rate), 0.35 * h);
    s.angle += s.rate * h;
    for (const hd of this.helds) hd.step(h);
    const ph = this.phoneScreen.wake;
    ph.target = this.phone?.isOpen && (this.phone.flight.travel.goal > 0) ? 1 : 0;
    ph.step(h);
    this.notebook?.step(h);
    this.steamAge += h;
  }

  update(cam: THREE.PerspectiveCamera, portrait: boolean, time: number): void {
    for (const sh of this.shadows) sh.mat.opacity = sh.base * (1 - THREE.MathUtils.smoothstep(sh.away(), 0, 0.22));
    const q = new THREE.Quaternion().setFromAxisAngle(UP, this.spin.angle);
    for (const r of this.rings) r.node.quaternion.copy(q).multiply(r.rest);
    for (const hd of this.helds) hd.update(cam);
    if (this.notebook) {
      this.notebook.portrait = portrait;
      this.notebook.update(cam);
    }
    if (this.phone && (this.phone.isOpen || this.phoneScreen.wake.value > 0.002)) this.phoneScreen.draw();
    if (this.steam) {
      const a = this.steamAge;
      this.steam.visible = a < 6;
      if (this.steam.visible) {
        const pos = this.steam.geometry.getAttribute('position') as THREE.BufferAttribute;
        const al = this.steam.geometry.getAttribute('alpha') as THREE.BufferAttribute;
        const n = pos.count;
        for (let i = 0; i < n; i++) {
          const life = (time * 0.32 + i / n) % 1;
          const y = life * 0.2;
          pos.setXYZ(i, this.steamBase.x + Math.sin(time * 1.3 + i * 1.7 + life * 5) * 0.012 * life, this.steamBase.y + 0.1 + y, this.steamBase.z + Math.cos(time * 1.1 + i) * 0.008 * life);
          const fade = Math.min(1, a / 0.8) * Math.min(1, (6 - a) / 1.5);
          al.setX(i, Math.sin(Math.PI * life) * fade);
        }
        pos.needsUpdate = true;
        al.needsUpdate = true;
      }
    }
  }

  setTint(c: THREE.Color): void {
    for (const hd of this.helds) if (hd !== this.phone) hd.setTint(c);
    this.notebook?.setTint(c);
  }
}
