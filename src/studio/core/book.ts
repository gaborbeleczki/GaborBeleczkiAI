import * as THREE from 'three';
import { Flight, readPose, type ReadFit } from './held.ts';
import { Glide, Spring } from './physics.ts';
import { PH, PW, blocksToHtml, layout, renderEndpaper, renderPage, type Block, type Layout, type Link, type Theme } from '../print/print.ts';

// A book you can hold and read: the chapter dossiers from the shelf and the notebook on the
// desk. Blender models each one as a group (back board with the page block, and a front board
// that turns on its hinge). Here it flies to the reader, the cover swings open on a spring and
// pages turn with a curl; the pages are canvases typeset by print.ts.

/** Book geometry in its reading frame: u from the hinge to the fore-edge, v up, w to the reader. */
export interface BookGeom {
  boardW: number;
  boardH: number;
  boardT: number;
  /** air between the closed cover and the pages */
  gap: number;
  pageW: number;
  pageH: number;
  pageU: number;
  pageV: number;
}

export interface BookContent {
  blocks: Block[];
  theme: Theme;
  endpaper: { color: string; dark: boolean; n: string; kicker?: string; title: string };
}

const NU = 24;
const NV = 3;

const vertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  void main() {
    vUv = uv;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const fragment = /* glsl */ `
  uniform sampler2D front;
  uniform sampler2D back;
  uniform vec3 tint;
  varying vec2 vUv;
  varying vec3 vN;
  void main() {
    vec3 n = normalize(vN);
    vec3 c;
    if (gl_FrontFacing) c = texture2D(front, vUv).rgb;
    else {
      c = texture2D(back, vec2(1.0 - vUv.x, vUv.y)).rgb;
      n = -n;
    }
    float shade = 0.8 + 0.2 * clamp(dot(n, normalize(vec3(0.2, 0.5, 1.0))), 0.0, 1.0);
    gl_FragColor = vec4(c * tint * shade, 1.0);
    #include <colorspace_fragment>
  }
`;

const blank = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 4;
  const g = c.getContext('2d')!;
  g.fillStyle = '#F6F3EC';
  g.fillRect(0, 0, 4, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

/** Paper lit for reading: unlit (so it stays legible at night), warm in the evening. */
export function paperMaterial(side: THREE.Side = THREE.FrontSide): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { front: { value: blank }, back: { value: blank }, tint: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: vertex,
    fragmentShader: fragment,
    side,
    toneMapped: false,
  });
}

class Sheet {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly pos: THREE.BufferAttribute;

  constructor(private readonly g: BookGeom) {
    const geo = new THREE.BufferGeometry();
    const n = (NU + 1) * (NV + 1);
    const pos = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2);
    const idx: number[] = [];
    for (let j = 0; j <= NV; j++)
      for (let i = 0; i <= NU; i++) {
        const k = j * (NU + 1) + i;
        uv[k * 2] = i / NU;
        uv[k * 2 + 1] = j / NV;
      }
    for (let j = 0; j < NV; j++)
      for (let i = 0; i < NU; i++) {
        const a = j * (NU + 1) + i;
        const b = a + 1;
        const c = b + NU + 1;
        const d = a + NU + 1;
        idx.push(a, b, d, b, c, d);
      }
    geo.setIndex(idx);
    this.pos = new THREE.BufferAttribute(pos, 3);
    geo.setAttribute('position', this.pos);
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.mesh = new THREE.Mesh(geo, paperMaterial(THREE.DoubleSide));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  /** Bend the sheet: theta 0 lies on the right, PI on the left; dir is the turning direction. */
  shape(theta: number, dir: number, wRight: number, wLeft: number): void {
    const g = this.g;
    const L = g.pageU + g.pageW;
    const lagMax = 0.95 * Math.sin(theta);
    const wp = wRight + (wLeft - wRight) * (theta / Math.PI) + 0.004 * Math.sin(theta);
    const p = this.pos.array as Float32Array;
    for (let j = 0; j <= NV; j++) {
      const v = g.pageV + (j / NV) * g.pageH;
      // the corner leads a little: a diagonal curl
      const kap = (-dir * lagMax * (1 + 0.28 * dir * (j / NV - 0.5))) / L;
      for (let i = 0; i <= NU; i++) {
        const s = g.pageU + (i / NU) * g.pageW;
        let u: number;
        let w: number;
        if (Math.abs(kap) < 1e-5) {
          u = s * Math.cos(theta);
          w = s * Math.sin(theta);
        } else {
          u = (Math.sin(theta + kap * s) - Math.sin(theta)) / kap;
          w = (Math.cos(theta) - Math.cos(theta + kap * s)) / kap;
        }
        const k = (j * (NU + 1) + i) * 3;
        p[k] = u;
        p[k + 1] = v;
        p[k + 2] = w + wp;
      }
    }
    this.pos.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }
}

export class Book {
  readonly flight: Flight;
  /** cover angle (radians): 0 closed, PI open flat */
  private readonly cover = new Spring(0, 1.15, 0.8);
  private readonly turn = new Glide(0, 1.7);
  private turnDir = 0;
  private spread = 0;
  private sheets = 0;
  private lay: Layout | null = null;
  private readonly textures = new Map<string, THREE.CanvasTexture>();
  private readonly links = new Map<string, Link[]>();
  private readonly left: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly right: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly endpaper: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly turning: Sheet;
  /** the cover turns about this: a pivot on the hinge line (the optimiser re-centres mesh
   *  origins, so the cover node's own origin is not on the hinge) */
  private readonly hinge = new THREE.Object3D();
  private readonly hingeAxis = new THREE.Vector3();
  private readonly readPos = new THREE.Vector3();
  private readonly readQuat = new THREE.Quaternion();
  private readonly wRight = 0.0004;
  private readonly wLeft: number;
  private readonly hingeW: number;
  private wantOpen = false;
  private closing = false;
  private onClosed: (() => void) | null = null;
  portrait = false;
  /** on a tall screen one page shows at a time: the left one or the right one */
  private focusLeft = false;
  private readonly pan = new Spring(0, 1.3, 1);
  /** extra parts that leave when the book opens (the notebook's elastic band) */
  band: THREE.Object3D | null = null;
  private bandRest = new THREE.Vector3();

  constructor(
    readonly id: string,
    readonly node: THREE.Object3D,
    private readonly coverNode: THREE.Object3D,
    /** the reading frame inside the node */
    readonly frame: THREE.Object3D,
    readonly geom: BookGeom,
    private readonly content: () => BookContent,
    out: THREE.Vector3,
    outDist: number,
    private readonly reduceMotion: boolean,
  ) {
    this.flight = new Flight(node, { out, outDist, time: 0.95 });
    this.hingeW = geom.boardT / 2 + geom.gap;
    // the hinge line runs along v at u = 0, w = hingeW
    frame.updateMatrix();
    this.hinge.position.set(0, 0, this.hingeW).applyMatrix4(frame.matrix);
    this.hingeAxis.set(0, 1, 0).applyQuaternion(frame.quaternion);
    node.add(this.hinge);
    node.updateWorldMatrix(true, true);
    this.hinge.attach(coverNode);
    this.wLeft = this.hingeW + geom.boardT / 2 + 0.0009;
    const g = geom;
    const plane = () => new THREE.Mesh(new THREE.PlaneGeometry(g.pageW, g.pageH), paperMaterial());
    this.right = plane();
    this.right.position.set(g.pageU + g.pageW / 2, g.pageV + g.pageH / 2, this.wRight);
    this.left = plane();
    this.left.position.set(-(g.pageU + g.pageW / 2), g.pageV + g.pageH / 2, this.wLeft);
    this.turning = new Sheet(g);
    for (const m of [this.right, this.left]) {
      m.renderOrder = 1;
      m.visible = false;
      frame.add(m);
    }
    this.turning.mesh.visible = false;
    frame.add(this.turning.mesh);
    // the inside of the front cover, carried by the cover as it turns
    this.endpaper = plane();
    this.endpaper.visible = false;
    this.attachToCover(this.endpaper, new THREE.Vector3(g.pageU + g.pageW / 2, g.pageV + g.pageH / 2, this.hingeW - g.boardT / 2 - 0.0003), true);
    for (const mesh of [this.left, this.right, this.endpaper, this.turning.mesh]) mesh.userData.page = true;
  }

  /**
   * Fix a decal to the front board, given its centre in the closed book's reading frame.
   * inside = true puts it on the inner face (it reads correctly once the cover is open).
   */
  attachToCover(mesh: THREE.Object3D, at: THREE.Vector3, inside: boolean): void {
    const inFrame = new THREE.Matrix4().compose(
      at,
      inside ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI) : new THREE.Quaternion(),
      new THREE.Vector3(1, 1, 1),
    );
    this.frame.updateMatrix();
    const m = new THREE.Matrix4().makeTranslation(-this.hinge.position.x, -this.hinge.position.y, -this.hinge.position.z).multiply(this.frame.matrix).multiply(inFrame);
    m.decompose(mesh.position, mesh.quaternion, mesh.scale);
    this.hinge.add(mesh);
  }

  get isOpen(): boolean {
    return this.flight.away;
  }

  /** 0..1, how far open the cover is */
  get openness(): number {
    return THREE.MathUtils.clamp(this.cover.value / Math.PI, 0, 1);
  }

  get busy(): boolean {
    return this.flight.away || !this.cover.settled || !this.turn.settled;
  }

  /** Page numbers (1-based, 0 = none) showing on the left and right, and the total. */
  get pageInfo(): { left: number; right: number; total: number } {
    const total = this.lay?.pages.length ?? 0;
    let left = this.spread > 0 && 2 * this.spread <= total ? 2 * this.spread : 0;
    let right = 2 * this.spread + 1 <= total ? 2 * this.spread + 1 : 0;
    // a tall screen shows one side of the spread
    if (this.portrait) {
      if (this.focusLeft) right = 0;
      else left = 0;
    }
    return { left, right, total };
  }

  get canNext(): boolean {
    return this.portrait ? this.focusLeft || this.spread < this.sheets : this.spread < this.sheets;
  }

  get canPrev(): boolean {
    return this.portrait ? !this.focusLeft || this.spread > 0 : this.spread > 0;
  }

  /** On a tall screen, which side of the spread is in view. */
  get showingLeft(): boolean {
    return this.portrait && this.focusLeft;
  }

  /** The chapter's text (for screen readers). */
  get html(): string {
    return blocksToHtml(this.content().blocks);
  }

  /** The page (1-based) where a contents entry starting with `prefix` begins. */
  tocPage(prefix: string): number | null {
    return this.lay?.toc.find((t) => t.label.startsWith(prefix))?.page ?? null;
  }

  /** Open at a page number (1-based; 0 opens at the contents). */
  open(scale: number, startPage = 0): void {
    const c = this.content();
    if (!this.lay || Math.abs(this.lay.scale - scale) > 0.05) {
      this.disposeTextures();
      this.lay = layout(c.blocks, c.theme, scale);
    }
    this.sheets = Math.ceil(this.lay.pages.length / 2);
    this.spread = Math.max(0, Math.min(this.sheets, Math.floor(startPage / 2)));
    this.closing = false;
    this.wantOpen = true;
    this.focusLeft = startPage > 0 && startPage % 2 === 0;
    this.pan.snap(this.geom.pageU + this.geom.pageW / 2);
    this.flight.travel.to(1);
    if (this.reduceMotion) this.flight.travel.snap(1);
    this.showSpread();
  }

  close(done?: () => void): void {
    this.wantOpen = false;
    this.closing = true;
    this.onClosed = done ?? null;
    this.cover.target = 0;
    if (this.reduceMotion) {
      this.cover.snap(0);
      this.flight.travel.snap(0);
    }
  }

  /** Forward: on a tall screen, first pan from the left page to the right one, then turn. */
  next(): boolean {
    if (this.portrait && this.openness > 0.85) {
      if (this.focusLeft) {
        this.focusLeft = false;
        return true;
      }
      if (this.go(1)) {
        this.focusLeft = true;
        return true;
      }
      return false;
    }
    return this.go(1);
  }

  prev(): boolean {
    if (this.portrait && this.openness > 0.85) {
      if (!this.focusLeft) {
        this.focusLeft = true;
        return true;
      }
      if (this.go(-1)) {
        this.focusLeft = false;
        return true;
      }
      return false;
    }
    return this.go(-1);
  }

  /** Jump to a page number (1-based): odd pages are on the right, even on the left. */
  goToPage(page: number): void {
    const s = Math.max(0, Math.min(this.sheets, Math.floor(page / 2)));
    this.focusLeft = page > 0 && page % 2 === 0;
    if (s === this.spread) return;
    this.finishTurn();
    this.spread = s;
    this.showSpread();
  }

  private go(dir: number): boolean {
    if (!this.lay || this.openness < 0.85) return false;
    const target = this.spread + dir;
    if (target < 0 || target > this.sheets) return false;
    this.finishTurn();
    this.turnDir = dir;
    // the sheet being turned shows page (2s+1) on its front and (2s+2) on its back
    const sheet = dir > 0 ? this.spread : this.spread - 1;
    const mat = this.turning.mesh.material;
    mat.uniforms.front.value = this.pageTexture(sheet * 2);
    mat.uniforms.back.value = this.pageTexture(sheet * 2 + 1);
    if (dir > 0) {
      // under it, the next right page is already there
      this.setFace(this.right, this.rightKey(this.spread + 1));
      this.turn.snap(0);
      this.turn.to(Math.PI);
    } else {
      this.setFace(this.left, this.leftKey(this.spread - 1));
      this.left.visible = this.spread - 1 > 0;
      this.turn.snap(Math.PI);
      this.turn.to(0);
    }
    this.spread = target;
    this.turning.mesh.visible = true;
    if (this.reduceMotion) this.finishTurn();
    return true;
  }

  private finishTurn(): void {
    if (!this.turning.mesh.visible) return;
    this.turn.snap(this.turn.goal);
    this.turning.mesh.visible = false;
    this.showSpread();
  }

  private leftKey(s: number): string {
    return s <= 0 ? 'endpaper' : `p${s * 2 - 1}`;
  }

  private rightKey(s: number): string {
    return s >= this.sheets ? 'back' : `p${s * 2}`;
  }

  private showSpread(): void {
    this.setFace(this.endpaper, 'endpaper');
    this.setFace(this.left, this.leftKey(this.spread));
    this.setFace(this.right, this.rightKey(this.spread));
    this.left.visible = this.spread > 0 && this.isOpen;
    this.right.visible = this.isOpen;
    this.endpaper.visible = this.isOpen;
    // typeset the next spread ahead of time
    const s = this.spread;
    for (const k of [this.rightKey(s + 1), this.leftKey(s + 1), `p${s * 2 + 2}`]) this.texture(k);
  }

  private setFace(mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>, key: string): void {
    mesh.material.uniforms.front.value = this.texture(key);
    mesh.userData.pageKey = key;
  }

  private pageTexture(index: number): THREE.Texture {
    return this.texture(index >= (this.lay?.pages.length ?? 0) ? 'blank' : `p${index}`);
  }

  private texture(key: string): THREE.Texture {
    const hit = this.textures.get(key);
    if (hit) return hit;
    if (key === 'blank' || !this.lay) return blank;
    const canvas = document.createElement('canvas');
    const c = this.content();
    if (key === 'endpaper' || key === 'back') {
      renderEndpaper(canvas, { ...c.endpaper, toc: this.lay.toc.slice(0, 9), back: key === 'back' });
    } else {
      const i = Number(key.slice(1));
      if (i >= this.lay.pages.length) return blank;
      this.links.set(key, renderPage(canvas, this.lay, i, c.theme));
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    this.textures.set(key, tex);
    // keep a handful of pages in memory
    if (this.textures.size > 10) {
      const keep = new Set([this.leftKey(this.spread), this.rightKey(this.spread), 'endpaper', key]);
      for (const [k, t] of this.textures) {
        if (this.textures.size <= 8) break;
        if (keep.has(k)) continue;
        t.dispose();
        this.textures.delete(k);
      }
    }
    return tex;
  }

  private disposeTextures(): void {
    for (const t of this.textures.values()) t.dispose();
    this.textures.clear();
    this.links.clear();
  }

  /** The link under a page hit, if any. */
  linkAt(mesh: THREE.Object3D, uv: THREE.Vector2): Link | null {
    const key = mesh.userData.pageKey as string | undefined;
    if (!key) return null;
    const list = this.links.get(key);
    if (!list) return null;
    const x = uv.x * PW;
    const y = (1 - uv.y) * PH;
    return list.find((l) => x >= l.x && x <= l.x + l.w && y >= l.y && y <= l.y + l.h) ?? null;
  }

  /** Which side of the spread a page mesh is on. */
  sideOf(mesh: THREE.Object3D): 'left' | 'right' | null {
    if (mesh === this.right) return 'right';
    if (mesh === this.left || mesh === this.endpaper) return 'left';
    return null;
  }

  get pageMeshes(): THREE.Object3D[] {
    return [this.right, this.left, this.endpaper].filter((m) => m.visible);
  }

  setTint(c: THREE.Color): void {
    for (const m of [this.left, this.right, this.endpaper, this.turning.mesh]) m.material.uniforms.tint.value.copy(c);
  }

  /** Physics step (fixed rate). */
  step(h: number): void {
    this.flight.travel.step(h);
    // the cover opens once the book is in the reader's hands
    if (this.wantOpen && this.flight.value > 0.96) this.cover.target = Math.PI;
    this.cover.step(h);
    // a hardcover board lands flat with a small bounce, it does not sink through the pages
    if (this.cover.value > Math.PI) {
      this.cover.value = Math.PI - (this.cover.value - Math.PI) * 0.3;
      this.cover.velocity = -Math.abs(this.cover.velocity) * 0.25;
    }
    if (this.closing && this.cover.value < 0.04 && this.flight.travel.goal !== 0) {
      this.cover.snap(0);
      this.flight.travel.to(0);
    }
    if (this.closing && this.flight.travel.goal === 0 && this.flight.travel.value < 0.003) {
      this.flight.travel.snap(0);
      this.closing = false;
      this.showSpread();
      const done = this.onClosed;
      this.onClosed = null;
      done?.();
    }
    this.turn.step(h);
    if (this.turning.mesh.visible && this.turn.settled) this.finishTurn();
    const coverU = this.geom.pageU + this.geom.pageW / 2;
    this.pan.target = this.portrait && this.focusLeft && this.openness > 0.9 ? -coverU : coverU;
    this.pan.step(h);
  }

  /** Place everything for this frame (after the camera has moved). */
  update(cam: THREE.PerspectiveCamera): void {
    const g = this.geom;
    const k = this.openness;
    // closed: the cover is centred; open: the spread (or, on a tall screen, the right page)
    const spreadW = 2 * (g.pageU + g.pageW) + 0.012;
    const coverU = g.pageU + g.pageW / 2;
    const center = new THREE.Vector3(this.portrait ? this.pan.value : coverU * (1 - k), g.pageV + g.pageH / 2, 0);
    const fit: ReadFit = {
      w: this.portrait ? g.boardW + 0.012 : THREE.MathUtils.lerp(g.boardW + 0.02, spreadW, k),
      h: g.boardH,
      center,
      tilt: 0.3,
      fill: 0.84,
    };
    if (this.flight.away) readPose(cam, this.frame.quaternion, this.frame.position, fit, this.readPos, this.readQuat);
    this.flight.place(this.readPos, this.readQuat);
    // the cover turns on its hinge (about the frame's v axis)
    this.hinge.quaternion.setFromAxisAngle(this.hingeAxis, -Math.max(0, this.cover.value));
    const shown = this.flight.value > 0.5;
    this.right.visible = shown;
    this.endpaper.visible = shown;
    this.left.visible = shown && this.spread > 0;
    if (this.turning.mesh.visible) this.turning.shape(this.turn.value, this.turnDir, this.wRight, this.wLeft);
    if (this.band) {
      // the elastic slips off the corner before the cover lifts
      const off = THREE.MathUtils.smoothstep(this.flight.value, 0.75, 0.97);
      this.band.visible = off < 0.999;
      this.band.position.copy(this.bandRest).add(new THREE.Vector3(0.06 * off, 0, 0));
    }
  }

  attachBand(band: THREE.Object3D): void {
    this.band = band;
    this.bandRest.copy(band.position);
  }

  dispose(): void {
    this.disposeTextures();
    for (const m of [this.left, this.right, this.endpaper, this.turning.mesh]) {
      m.geometry.dispose();
      m.material.dispose();
    }
  }
}
