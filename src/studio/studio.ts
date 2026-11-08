import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { cases, folios, profile, type FolioId } from '../../content/profile.ts';
import { Lounge } from './audio/lounge.ts';
import type { Book } from './core/book.ts';
import { Desk, CARD_PX, PHONE_PX, type Held } from './core/desk.ts';
import { Dust } from './core/dust.ts';
import { Shelf, type DossierDims } from './core/shelf.ts';
import { bakedMaterial, configureTexture, emitterMaterial, motionUniforms, type MotionUniforms } from './core/materials.ts';
import { Pendant } from './core/pendant.ts';
import { FixedStep, Wander } from './core/physics.ts';
import { CameraRig, LOOKS, type Pose } from './core/rig.ts';
import { Turntable } from './core/turntable.ts';
import { WindowView, type VehicleMeta, type WindowMeta, type WindowTextures } from './core/window.ts';
import { Screen } from './screen/screen.ts';
import { Hotspots, type Spot } from './ui/hotspots.ts';
import { Hud, type HudAction } from './ui/hud.ts';

interface StudioMeta {
  poses: Record<string, { pos: number[]; target: number[]; fit: [number, number] }>;
  screen: { size: [number, number]; pixels: [number, number] };
  folios: { id: FolioId; object: string; color: string }[];
  dossier: DossierDims;
  objects: Record<string, number[]>;
  lights: Record<string, number[]>;
  flame: number[];
  pendantPivot?: number[];
  tonearm?: { pivot: number[] };
  window: { center: number[]; size: [number, number] };
  atlases: string[];
  bake: Record<string, Record<string, { lmax: number }>>;
}

export interface StudioOptions {
  onExit(): void;
  onFatal(reason: string): void;
}

type Focus = 'home' | 'desk' | 'shelf' | 'window' | 'record' | 'objects';

/** What is in the visitor's hands: a dossier or the notebook (a Book), or a card, the CV, the phone. */
type InHand = { kind: 'book'; book: Book; id: string } | { kind: 'held'; held: Held; id: string } | null;

const v3 = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);

/** Asset URL with the build's asset version (cache busting across deploys). */
const asset = (path: string) => `${path}?v=${import.meta.env.VITE_ASSET_V ?? '0'}`;

const HINTS: Record<Focus, string> = {
  home: 'The dots mark what you can use · take a dossier from the shelf, sit at the desk, look outside',
  desk: 'Use the dock on the display · <kbd>←</kbd> <kbd>→</kbd> to switch chapters · <kbd>Esc</kbd> to step back',
  shelf: 'Eight dossiers, one chapter each · click one to take it down and read',
  objects: 'Pick something up: the cards, the CV, the phone, the notebook · <kbd>Esc</kbd> to step back',
  window: 'Budapest across the Danube · move to look around · watch for tram 2<br><small>Photos: Wilfredor (CC0) · Yair-haklai (CC BY-SA 4.0), via Wikimedia Commons</small>',
  record: 'Budapest sessions: lounge deep house, generated live · click again to stop',
};

export class Studio {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private rig!: CameraRig;
  private readonly hud: Hud;
  private readonly timer = new THREE.Timer();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2(2, 2);
  private readonly reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private meta!: StudioMeta;
  private poses: Record<string, Pose> = {};
  private focus: Focus = 'home';
  private baked: THREE.ShaderMaterial[] = [];
  private emitters: THREE.MeshStandardMaterial[] = [];
  private hitTargets: THREE.Object3D[] = [];
  private screen!: Screen;
  private screenMesh?: THREE.Mesh;
  private windowView?: WindowView;
  private windowMeta?: WindowMeta;
  private sharpening?: Promise<boolean>;
  private shelf?: Shelf;
  private desk?: Desk;
  private hotspots?: Hotspots;
  private inHand: InHand = null;
  private handLook: Focus = 'home';
  private photo: HTMLImageElement | null = null;
  private readonly paperTint = new THREE.Color(1, 1, 1);
  private wheelAcc = 0;
  private wheelAt = 0;
  /** dot labels stay named for a moment after arriving somewhere */
  private namedUntil = 6;
  private turntable?: Turntable;
  private readonly music = new Lounge();
  private envs: { evening?: THREE.Texture; day?: THREE.Texture } = {};
  private flame?: THREE.Sprite;
  private warmLight = new THREE.PointLight('#ffb36b', 0, 6, 1.6);
  private sunLight = new THREE.DirectionalLight('#fff3e2', 0);
  private night = true;
  private dayT = 0;
  private dayGoal = 0;
  private raf = 0;
  private running = false;
  private disposed = false;
  private down: { x: number; y: number; t: number } | null = null;
  private dragLook = false;
  private hovered: THREE.Object3D | null = null;
  private time = 0;
  private frameTimes: number[] = [];
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private contextLostTimer = 0;
  private readonly cleanups: (() => void)[] = [];
  private readonly stepper = new FixedStep();
  private motion!: MotionUniforms;
  private pendant?: Pendant;
  private dust?: Dust;
  private lampPositions: THREE.Vector3[] = [];
  private readonly breeze = new Wander(0.08);
  private readonly air = new THREE.Vector3();
  private readonly lastEye = new THREE.Vector3();
  private readonly capture = /[?&]capture\b/.test(location.search);
  private drift = 0;

  constructor(private readonly host: HTMLElement, private readonly opts: StudioOptions) {
    host.classList.add('studio');
    const poster = document.createElement('div');
    poster.className = 'studio__poster';
    const night = this.initialNight();
    poster.style.backgroundImage = `url(/img/studio-${night ? 'evening' : 'day'}.webp)`;
    host.appendChild(poster);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: /[?&]capture\b/.test(location.search) });
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.AgXToneMapping;
    // calibrated against the Cycles reference renders (scripts/qa/pixeldiff.mjs): three.js AgX
    // reads ~18% brighter than Blender's AgX at the same exposure
    this.renderer.toneMappingExposure = 0.82;
    const canvas = this.renderer.domElement;
    canvas.className = 'studio__gl';
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', '3D studio. Use the Chapters button or the number keys 0 to 7 to open chapters.');
    host.appendChild(canvas);
    this.hud = new Hud(host, {
      back: () => (this.inHand ? this.putDown() : this.setFocus('home')),
      toggleLights: () => this.setNight(!this.night),
      toggleSound: () => this.toggleMusic(),
      pageView: () => this.opts.onExit(),
      open: (id) => this.openDossier(id),
      prev: () => this.turnPage(-1),
      next: () => this.turnPage(1),
      close: () => this.putDown(),
      act: (id) => this.act(id),
    });
    this.night = night;
    this.dayT = this.dayGoal = night ? 0 : 1;
    this.hud.setNight(night);
    this.hud.setHint(HINTS.home);
  }

  private initialNight(): boolean {
    const q = location.search;
    if (/[?&]day\b/.test(q)) return false;
    if (/[?&](evening|night)\b/.test(q)) return true;
    const h = Number(new Date().toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/Budapest' }));
    return !(h >= 7 && h < 17);
  }

  // ------------------------------------------------------------------ loading

  async load(): Promise<void> {
    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url, loaded, total) => this.hud.progress(loaded / Math.max(total, 1));
    const meta: StudioMeta = await fetch(asset('/models/studio.json')).then((r) => {
      if (!r.ok) throw new Error('studio.json');
      return r.json();
    });
    const [view, vehicles]: [WindowMeta, VehicleMeta] = await Promise.all([
      fetch(asset('/models/window.json')).then((r) => r.json()),
      fetch(asset('/models/vehicles.json')).then((r) => r.json()),
    ]);
    this.meta = meta;
    this.windowMeta = view;
    for (const [k, p] of Object.entries(meta.poses)) this.poses[k] = { pos: v3(p.pos), target: v3(p.target), fit: p.fit };

    const tl = new THREE.TextureLoader(manager);
    const tex = (url: string, srgb: boolean, flipY: boolean) =>
      new Promise<THREE.Texture>((res, rej) => tl.load(asset(url), (t) => res(configureTexture(t, { srgb, flipY, aniso: this.renderer.capabilities.getMaxAnisotropy() >= 8 ? 8 : 4 })), undefined, rej));
    const gltfLoader = new GLTFLoader(manager);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    const hdr = new HDRLoader(manager);
    const loadHdr = (url: string) => new Promise<THREE.Texture>((res, rej) => hdr.load(url, res, undefined, rej));

    // small previews of the bake first; sharpen() swaps in the full 4K/2K atlases
    const atlasJobs = meta.atlases.map(async (g) => {
      const [albedo, evening, day] = await Promise.all([
        tex(`/textures/${g}_albedo_lo.webp`, true, false),
        tex(`/textures/${g}_light_evening_lo.webp`, true, false),
        tex(`/textures/${g}_light_day_lo.webp`, true, false),
      ]);
      return [g, { albedo, evening, day }] as const;
    });
    // the window: small plates first, the sharp ones arrive after the first frames (sharpenWindow)
    const windowSet = async (state: 'evening' | 'day'): Promise<WindowTextures> => {
      const [plate, data, fill] = await Promise.all([
        tex(`/textures/window_${state}_lo.webp`, true, true),
        tex(`/textures/window_${state}_data.png`, false, true),
        tex(`/textures/window_${state}_fill.webp`, true, true),
      ]);
      data.generateMipmaps = false;
      data.minFilter = THREE.LinearFilter;
      data.anisotropy = 1;
      return { plate, data, fill };
    };
    // the vehicles' sprite sheets hold premultiplied colour: read them raw, decode in the shader
    const sprites = (state: 'day' | 'night') =>
      tex(`/textures/vehicles_${state}.webp`, false, true).then((t) => {
        t.premultiplyAlpha = false;
        t.anisotropy = 1;
        return t;
      });
    const [gltf, atlases, winE, winD, vehDay, vehNight, envE, envD] = await Promise.all([
      gltfLoader.loadAsync(asset('/models/studio.glb')),
      Promise.all(atlasJobs),
      windowSet('evening'),
      windowSet('day'),
      sprites('day'),
      sprites('night'),
      loadHdr(asset('/textures/room_evening.hdr')).catch(() => null),
      loadHdr(asset('/textures/room_day.hdr')).catch(() => null),
    ]);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    if (envE) {
      envE.mapping = THREE.EquirectangularReflectionMapping;
      this.envs.evening = pmrem.fromEquirectangular(envE).texture;
      envE.dispose();
    }
    if (envD) {
      envD.mapping = THREE.EquirectangularReflectionMapping;
      this.envs.day = pmrem.fromEquirectangular(envD).texture;
      envD.dispose();
    }
    pmrem.dispose();

    const sets = new Map(atlases);
    const root = gltf.scene;
    this.motion = motionUniforms(v3(meta.pendantPivot ?? [-0.15, 2.85, -1.62]));
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const ud = o.userData || {};
      if (o.name.startsWith('bake_') && mesh.isMesh) {
        const g = o.name.slice(5);
        const set = sets.get(g);
        const scales = meta.bake?.[g] ?? {};
        // Blender's per-vertex 'sway' attribute arrives as glTF COLOR_0
        const geo = mesh.geometry;
        const sway = geo.getAttribute('color');
        if (sway) {
          geo.setAttribute('sway', sway);
          geo.deleteAttribute('color');
        }
        if (set) {
          const m = bakedMaterial(
            {
              albedo: set.albedo,
              evening: set.evening,
              day: set.day,
              scaleEvening: scales.evening?.lmax ?? 1,
              scaleDay: scales.day?.lmax ?? 1,
            },
            this.motion,
            !!sway,
          );
          mesh.material = m;
          m.userData.atlas = g;
          this.baked.push(m);
        }
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
      } else if (ud.hit && ud.invisible) {
        mesh.visible = false;
        this.hitTargets.push(o);
      } else if (ud.dyn === 'emitter' && mesh.isMesh) {
        const m = emitterMaterial(new THREE.Color(ud.base || '#1a1a1a'), new THREE.Color(ud.glow || '#ffd9a8'), Number(ud.strength || 1));
        mesh.material = m;
        this.emitters.push(m);
      } else if (ud.dyn === 'screen' && mesh.isMesh) {
        this.screenMesh = mesh;
      } else if (mesh.isMesh) {
        const m = mesh.material as THREE.MeshStandardMaterial;
        if (m && 'envMapIntensity' in m) m.envMapIntensity = 1.0;
      }
      if (ud.hit && !ud.invisible) this.hitTargets.push(o);
    });
    this.scene.add(root);

    // display canvas
    this.screen = new Screen(
      {
        // the display's dock switches its own chapters; nothing else in the room moves
        onOpen: (id) => this.showOnScreen(id),
        onCursor: (c) => {
          if (this.focus === 'desk') this.renderer.domElement.style.cursor = c || 'default';
        },
        link: (url, newTab) => {
          if (newTab) window.open(url, '_blank', 'noopener');
          else window.location.href = url;
        },
        copy: (text) => void navigator.clipboard?.writeText(text).catch(() => {}),
        pageView: () => this.opts.onExit(),
        announce: (t) => this.hud.announce(t),
      },
      this.reduceMotion,
    );
    if (this.screenMesh) this.screenMesh.material = new THREE.MeshBasicMaterial({ map: this.screen.texture, toneMapped: false });
    await this.screen.show('hello');

    // window
    this.windowView = new WindowView({
      center: v3(meta.window.center),
      size: meta.window.size,
      meta: view,
      evening: winE,
      day: winD,
      vehicles,
      vehicleTextures: { day: vehDay, night: vehNight },
    });
    this.scene.add(this.windowView.mesh);

    // the dossiers on the shelf, the things on the desk, the record player
    const photo = new Image();
    photo.decoding = 'async';
    photo.onload = () => (this.photo = photo);
    photo.src = '/img/gabor.jpg';
    this.shelf = new Shelf(root, meta.dossier, () => this.photo, this.reduceMotion);
    this.desk = new Desk(root, meta.objects?.coffee ? v3(meta.objects.coffee) : null, this.reduceMotion);
    this.hotspots = new Hotspots(this.host, this.spotList(meta, root), (id) => this.use(id));
    // the tonearm swings about its bearing: give it a pivot there (the optimiser moved its origin)
    let arm = root.getObjectByName('tonearm');
    if (arm && meta.tonearm?.pivot) {
      const pivot = new THREE.Object3D();
      pivot.position.copy(v3(meta.tonearm.pivot));
      arm.parent?.add(pivot);
      root.updateWorldMatrix(true, true);
      pivot.attach(arm);
      arm = pivot;
    }
    this.turntable = new Turntable(root.getObjectByName('tt_platter'), root.getObjectByName('tt_record'), arm);

    // candle flame
    const flameTex = this.flameTexture();
    this.flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: '#ffc27a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.flame.position.copy(v3(meta.flame));
    this.flame.scale.set(0.022, 0.05, 1);
    this.scene.add(this.flame);

    // a little directional help for the live-lit objects
    this.warmLight.position.copy(v3(meta.lights.pendant ?? [0, 1.9, -1.6]));
    this.scene.add(this.warmLight);
    this.sunLight.position.set(-3, 4, -6);
    this.scene.add(this.sunLight);

    // the pendant swings on its cord; the glowing diffuser and the live light go with it
    this.pendant = new Pendant(this.motion.pivot.value, this.motion, [root.getObjectByName('pendant_diffuser'), root.getObjectByName('hit_pendant')], this.warmLight);
    this.pendant.calm = this.reduceMotion;
    this.lampPositions = ['pendant', 'desk_lamp', 'candle'].map((k) => v3(meta.lights[k] ?? [0, 2, -1.6]));
    if (!this.reduceMotion) {
      this.dust = new Dust(new THREE.Box3(new THREE.Vector3(-1.75, 0.75, -2.1), new THREE.Vector3(1.55, 2.5, 0.9)), this.lampPositions, {
        center: v3(meta.window.center),
        size: meta.window.size,
      });
      this.scene.add(this.dust.points);
    }
    this.applyState(this.dayT);

    this.rig = new CameraRig(this.poses.home);
    this.rig.calm = this.reduceMotion || this.capture;
    this.lastEye.copy(this.rig.camera.position);
    const start = this.poses.home;
    // arrive with a short dolly
    const from: Pose = { pos: start.pos.clone().add(new THREE.Vector3(0.5, 0.18, 0.9)), target: start.target.clone(), fit: start.fit };
    this.rig.goTo(from, 0, true);
    this.rig.goTo(start, this.reduceMotion ? 0.01 : 2.6);
    this.resize();
    // compile shaders before the first visible frame
    this.renderer.compile(this.scene, this.rig.camera);
  }

  private flameTexture(): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 128;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(32, 84, 2, 32, 76, 46);
    grd.addColorStop(0, 'rgba(255,248,230,1)');
    grd.addColorStop(0.25, 'rgba(255,200,120,0.9)');
    grd.addColorStop(0.6, 'rgba(255,140,60,0.25)');
    grd.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(32, 72, 22, 50, 0, 0, Math.PI * 2);
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /**
   * Full-resolution textures, swapped in once the studio is on screen: the bake atlases (the
   * current light first), then the window photos. Until then the small previews stand in.
   */
  private async sharpen(): Promise<boolean> {
    const loader = new THREE.TextureLoader();
    const aniso = Math.min(16, this.renderer.capabilities.getMaxAnisotropy());
    const load = async (url: string, flipY: boolean) => configureTexture(await loader.loadAsync(asset(url)), { srgb: true, flipY, aniso });
    // the full 4K bake needs ~400 MB of video memory: desktops get it, tablets and
    // low-memory devices get the 2K set
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const full = mem >= 8 && !coarse && this.renderer.capabilities.maxTextureSize >= 4096;
    // (the walls' albedo is 2K already, so it has no smaller sibling)
    const sharp = (g: string, kind: string) => (full || (g === 'walls' && kind === 'albedo') ? `/textures/${g}_${kind}.webp` : `/textures/${g}_${kind}_md.webp`);
    const states: ('evening' | 'day')[] = this.night ? ['evening', 'day'] : ['day', 'evening'];
    try {
      for (const m of this.baked) {
        const g = m.userData.atlas as string;
        const [albedo, light] = await Promise.all([load(sharp(g, 'albedo'), false), load(sharp(g, `light_${states[0]}`), false)]);
        this.swapTexture(m, 'albedoMap', albedo);
        this.swapTexture(m, states[0] === 'evening' ? 'lightA' : 'lightB', light);
      }
      for (const state of states) this.windowView?.setTextures(state, { plate: await load(`/textures/window_${state}.webp`, true) });
      for (const m of this.baked) {
        const g = m.userData.atlas as string;
        this.swapTexture(m, states[1] === 'evening' ? 'lightA' : 'lightB', await load(sharp(g, `light_${states[1]}`), false));
      }
      return true;
    } catch {
      return false; // the previews stay; nothing else depends on this
    }
  }

  private swapTexture(m: THREE.ShaderMaterial, uniform: string, tex: THREE.Texture): void {
    const old = m.uniforms[uniform].value as THREE.Texture | null;
    m.uniforms[uniform].value = tex;
    if (old && old !== tex) old.dispose();
  }

  // ------------------------------------------------------------------ lifecycle

  start(): void {
    const canvas = this.renderer.domElement;
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Window | Document, type: K | string, fn: EventListener, opts?: AddEventListenerOptions) => {
      el.addEventListener(type, fn, opts);
      this.cleanups.push(() => el.removeEventListener(type, fn, opts));
    };
    on(window, 'resize', () => this.resize());
    on(canvas, 'pointermove', (e) => this.onPointerMove(e as PointerEvent));
    on(canvas, 'pointerdown', (e) => this.onPointerDown(e as PointerEvent));
    on(canvas, 'pointerup', (e) => this.onPointerUp(e as PointerEvent));
    on(canvas, 'pointerleave', () => {
      this.pointer.set(2, 2);
      this.hud.showTip(null);
      this.screen.pointer(0, 0, 'leave');
      this.rig.setPointer(0, 0);
    });
    on(canvas, 'wheel', (e) => this.onWheel(e as WheelEvent), { passive: false });
    on(window, 'keydown', (e) => this.onKey(e as KeyboardEvent));
    on(window, 'keyup', (e) => {
      if (this.focus === 'desk' && this.screen.keyUp(e as KeyboardEvent)) e.preventDefault();
    });
    on(document, 'visibilitychange', () => (document.hidden ? this.pause() : this.resume()));
    on(canvas, 'webglcontextlost', (e) => {
      e.preventDefault();
      this.pause();
      this.contextLostTimer = window.setTimeout(() => this.opts.onFatal('graphics context lost'), 4000);
    });
    on(canvas, 'webglcontextrestored', () => {
      window.clearTimeout(this.contextLostTimer);
      this.resume();
    });
    this.host.classList.add('is-ready');
    this.hud.announce('Studio loaded. The dots mark what you can use. Press 0 to 7 to take a chapter dossier from the shelf, L for light, M for music.');
    this.exposeHooks();
    void this.screen.prefetch();
    this.sharpening = this.sharpen();
    if (!this.capture) this.resume();
    canvas.focus({ preventScroll: true });
  }

  /** Test and capture hooks: window.__studio (always) and manual stepping with ?capture. */
  private exposeHooks(): void {
    const api = {
      ready: true,
      info: () => ({ focus: this.focus, module: this.screen.current, screenReady: this.screen.ready, night: this.night, dpr: this.dpr, size: [this.renderer.domElement.width, this.renderer.domElement.height] }),
      prefetched: () => this.screen.prefetch().then(() => true),
      sharpened: () => this.sharpening ?? Promise.resolve(false),
      window: (state: 'evening' | 'day', v: { hfov?: number; yaw?: number; pitch?: number; gain?: number }) => this.windowView?.frame(state, v),
      exposure: (v: number) => (this.renderer.toneMappingExposure = v),
      open: (id: FolioId, page = 0) => this.openDossier(id, page),
      use: (id: string) => this.use(id),
      turn: (dir: number) => this.turnPage(dir),
      putDown: () => this.putDown(),
      hand: () => {
        const h = this.inHand;
        if (!h) return null;
        if (h.kind === 'book') return { id: h.id, open: h.book.openness, travel: h.book.flight.value, ...h.book.pageInfo };
        return { id: h.id, travel: h.held.flight.value, flip: h.held.flip.value, zoom: h.held.zoom.value };
      },
      spots: () => [...this.host.querySelectorAll<HTMLElement>('.spot:not(.is-hidden)')].map((el) => el.getAttribute('aria-label')),
      showOnScreen: (id: FolioId) => this.showOnScreen(id),
      debugBook: (id: FolioId) => {
        const book = this.shelf?.get(id);
        if (!book) return null;
        const cam = this.rig.camera;
        cam.updateMatrixWorld();
        book.node.updateMatrixWorld(true);
        const proj = (o: THREE.Object3D) => {
          const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
          const q = p.clone().project(cam);
          return { world: p.toArray().map((x) => +x.toFixed(3)), screen: [+((q.x * 0.5 + 0.5) * 1280).toFixed(0), +((-q.y * 0.5 + 0.5) * 720).toFixed(0)] };
        };
        const out: Record<string, unknown> = { node: proj(book.node), frame: proj(book.frame) };
        book.frame.children.forEach((c, i) => (out[`frameChild${i}_${c.type}_${c.visible}`] = proj(c)));
        const cover = book.node.getObjectByName(`${book.node.name}_cover`);
        if (cover) {
          out.cover = proj(cover);
          out.coverQuat = cover.quaternion.toArray().map((x) => +x.toFixed(3));
          cover.children.forEach((c, i) => (out[`coverChild${i}`] = proj(c)));
        }
        out.frameQuat = book.frame.quaternion.toArray().map((x) => +x.toFixed(3));
        out.nodeQuat = book.node.quaternion.toArray().map((x) => +x.toFixed(3));
        out.camQuat = cam.quaternion.toArray().map((x) => +x.toFixed(3));
        out.open = book.openness;
        return out;
      },
      focus: (f: Focus) => this.setFocus(f),
      night: (n: boolean) => this.setNight(n),
      lookAt: (x: number, y: number) => this.rig.setPointer(x, y),
      drift: (on: boolean) => (this.drift = on ? 1 : 0),
      // advance the simulation n steps but only draw the last one (software WebGL is slow)
      step: (dt: number, n = 1) => {
        for (let i = 0; i < n; i++) this.frame(dt, i === n - 1);
      },
      screenPng: () => this.screen.canvas.toDataURL('image/png'),
      game: () => this.screen.debug(),
      screenMaterial: () => {
        const m = this.screenMesh?.material as THREE.MeshBasicMaterial | undefined;
        const uv = this.screenMesh?.geometry.getAttribute('uv');
        return { has: !!this.screenMesh, type: m?.type, map: !!m?.map, uvCount: uv?.count ?? 0, uv0: uv ? [uv.getX(0), uv.getY(0), uv.getX(2), uv.getY(2)] : null, normalized: (uv as THREE.BufferAttribute | undefined)?.normalized };
      },
      // QA: render the soundtrack's opening offline and report its levels per second
      music: async (seconds = 40, wav = false) => {
        const buf = await Lounge.render(seconds);
        if (wav) {
          // 16-bit stereo WAV, base64, for a listenable preview
          const n = buf.length;
          const data = new DataView(new ArrayBuffer(44 + n * 4));
          const str = (o: number, t: string) => [...t].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
          str(0, 'RIFF');
          data.setUint32(4, 36 + n * 4, true);
          str(8, 'WAVEfmt ');
          data.setUint32(16, 16, true);
          data.setUint16(20, 1, true);
          data.setUint16(22, 2, true);
          data.setUint32(24, buf.sampleRate, true);
          data.setUint32(28, buf.sampleRate * 4, true);
          data.setUint16(32, 4, true);
          data.setUint16(34, 16, true);
          str(36, 'data');
          data.setUint32(40, n * 4, true);
          const L = buf.getChannelData(0);
          const R = buf.getChannelData(1);
          for (let i = 0; i < n; i++) {
            data.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
            data.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
          }
          let bin = '';
          const bytes = new Uint8Array(data.buffer);
          for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          return btoa(bin);
        }
        const per: { peak: number; rms: number }[] = [];
        const sr = buf.sampleRate;
        for (let s = 0; s < Math.floor(buf.duration); s++) {
          let peak = 0;
          let sum = 0;
          for (let ch = 0; ch < buf.numberOfChannels; ch++) {
            const d = buf.getChannelData(ch).subarray(s * sr, (s + 1) * sr);
            for (let i = 0; i < d.length; i++) {
              const v = Math.abs(d[i]);
              if (v > peak) peak = v;
              sum += v * v;
            }
          }
          per.push({ peak: Math.round(peak * 1000) / 1000, rms: Math.round(Math.sqrt(sum / (sr * buf.numberOfChannels)) * 1000) / 1000 });
        }
        return per;
      },
      loseContext: () => (this.renderer.getContext().getExtension('WEBGL_lose_context') as { loseContext(): void } | null)?.loseContext(),
    };
    (window as unknown as { __studio: typeof api }).__studio = api;
  }

  private pause(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private resume(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    this.timer.update();
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.frame();
    };
    this.raf = requestAnimationFrame(loop);
  }

  dispose(): void {
    this.disposed = true;
    this.pause();
    window.clearTimeout(this.contextLostTimer);
    this.cleanups.forEach((f) => f());
    this.music.dispose();
    this.screen?.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose());
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.hud.dispose();
    this.host.classList.remove('is-ready');
    this.host.replaceChildren();
  }

  // ------------------------------------------------------------------ frame

  private frame(fixedDt?: number, draw = true): void {
    if (fixedDt === undefined) this.timer.update();
    const dt = fixedDt ?? Math.min(this.timer.getDelta(), 1 / 20);
    this.time += dt;
    if (this.drift) {
      // a slow, looping glance around the room for the page's hero video (period 12 s)
      const a = (this.time / 12) * Math.PI * 2;
      this.rig.setPointer(Math.sin(a) * 0.55, Math.sin(a * 2) * 0.18);
    }
    // physics at a fixed 120 Hz: camera, folios, record player, pendant, dust
    this.stepper.advance(dt, (h) => this.physics(h));
    this.rig.apply();
    const portrait = this.rig.camera.aspect < 0.95;
    this.shelf?.update(this.rig.camera, portrait);
    this.desk?.update(this.rig.camera, portrait, this.time);
    this.syncReader();
    this.turntable?.update();
    this.pendant?.apply();
    this.dust?.update(this.dayT, this.dpr);
    this.motion.time.value = this.reduceMotion ? 0 : this.time;
    // day/evening cross-fade
    if (this.dayT !== this.dayGoal) {
      const step = this.reduceMotion ? 1 : dt / 1.6;
      this.dayT = this.dayGoal > this.dayT ? Math.min(this.dayGoal, this.dayT + step) : Math.max(this.dayGoal, this.dayT - step);
      this.applyState(this.dayT);
    }
    this.windowView?.update(dt, this.time, this.rig.camera, this.reduceMotion);
    this.screen.update(dt);
    // the room recedes a little while something is held up to read
    const reading = this.inHand ? 1 : 0;
    this.motion.dim.value += (reading - this.motion.dim.value) * Math.min(1, dt * 4);
    if (this.hotspots) {
      const r = this.renderer.domElement;
      this.hotspots.update(this.rig.camera, this.focus, !this.inHand && this.rig.speed < 0.3, r.clientWidth, r.clientHeight);
      this.hotspots.nameAll(this.time < this.namedUntil && !this.inHand);
    }
    if (this.flame) {
      const f = this.reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(this.time * 13.1) * Math.sin(this.time * 7.3 + 1.3);
      this.flame.scale.set(0.02 * f, 0.048 * (0.9 + 0.2 * f), 1);
      (this.flame.material as THREE.SpriteMaterial).opacity = (1 - this.dayT) * 0.95;
    }
    if (!draw) return;
    this.renderer.render(this.scene, this.rig.camera);
    if (!this.capture) this.adapt(dt);
  }

  private physics(h: number): void {
    this.rig.step(h);
    this.shelf?.step(h);
    this.desk?.step(h);
    this.turntable?.step(h);
    // air the camera pushes along, felt by the pendant when it passes close
    const eye = this.rig.camera.position;
    const lamp = this.lampPositions[0];
    if (lamp) {
      this.air.subVectors(eye, this.lastEye).divideScalar(h).clampLength(0, 3);
      const near = Math.max(0, 1 - eye.distanceTo(lamp) / 1.6);
      this.air.multiplyScalar(near * near * 0.6);
      this.air.y = 0;
    }
    this.lastEye.copy(eye);
    this.pendant?.step(h, this.air);
    // a breeze from the window: curtains and leaves
    const b = this.reduceMotion ? 0 : 0.5 + 0.5 * this.breeze.step(h);
    this.motion.wind.value = b * b;
    this.dust?.step(h, this.lampPositions, 1 - this.dayT);
  }

  /** Lower the pixel ratio when frames run long; raise it back carefully. */
  private adapt(dt: number): void {
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    const max = Math.min(window.devicePixelRatio || 1, 2);
    if (avg > 1 / 40 && this.dpr > 0.75) this.dpr = Math.max(0.75, this.dpr - 0.25);
    else if (avg < 1 / 58 && this.dpr < max) this.dpr = Math.min(max, this.dpr + 0.25);
    else return;
    this.renderer.setPixelRatio(this.dpr);
    this.resize();
  }

  private resize(): void {
    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.rig?.setAspect(w / h);
  }

  // ------------------------------------------------------------------ state

  private applyState(t: number): void {
    for (const m of this.baked) m.uniforms.mixT.value = t;
    this.windowView?.setState(t);
    for (const m of this.emitters) m.emissiveIntensity = (m.userData.glowStrength as number) * (1 - t);
    this.scene.environment = (t < 0.5 ? this.envs.evening : this.envs.day) ?? null;
    this.scene.environmentIntensity = 1;
    this.warmLight.intensity = 1.2 * (1 - t);
    this.sunLight.intensity = 1.4 * t;
    this.screen?.setNight(t < 0.5);
    // paper under a reading lamp in the evening, in daylight by day
    this.paperTint.setRGB(0.95 + 0.05 * t, 0.91 + 0.09 * t, 0.83 + 0.15 * t);
    for (const e of this.shelf?.list ?? []) e.book.setTint(this.paperTint);
    this.desk?.setTint(this.paperTint);
  }

  private setNight(night: boolean): void {
    this.night = night;
    this.pendant?.nudge(0.8);
    this.dayGoal = night ? 0 : 1;
    this.hud.setNight(night);
    this.hud.announce(night ? 'Evening. The lamps are on.' : 'Daylight.');
  }

  private async toggleMusic(force?: boolean): Promise<void> {
    const on = force ?? !this.music.playing;
    if (on) await this.music.start();
    else this.music.stop();
    this.turntable?.setPlaying(on);
    this.hud.setSound(on);
  }

  private setFocus(f: Focus): void {
    this.focus = f;
    const pose = this.poses[f] ?? this.poses.home;
    this.rig.goTo(pose, f === 'home' ? 1.5 : 1.25);
    if (!this.inHand) this.rig.setLook(LOOKS[f] ?? LOOKS.home);
    this.screen.attention(f === 'desk');
    this.hud.setFocused(f !== 'home');
    this.hud.setHint(HINTS[f]);
    this.hud.showCaption(null);
    if (f === 'home' || f === 'objects') this.namedUntil = this.time + 1.6 + 3.5;
    if (f === 'window') this.windowView?.hurry();
    if (f !== 'desk') this.renderer.domElement.style.cursor = 'default';
    this.shelf?.setHover(null);
  }

  /** The display's dock: switch the chapter on screen, nothing else moves. */
  private showOnScreen(id: FolioId): void {
    void this.screen.show(id);
    this.hud.setCurrent(id);
  }

  // ------------------------------------------------------------------ things in hand

  /** Take a dossier down from the shelf and open it in front of the reader. */
  private openDossier(id: FolioId, page = 0): void {
    const book = this.shelf?.get(id);
    if (!book) return;
    if (this.inHand?.kind === 'book' && this.inHand.book === book) {
      book.goToPage(page);
      return;
    }
    this.putDown(true);
    this.hud.setCurrent(id);
    this.hud.showCaption(null);
    book.open(this.printScale(book), page);
    this.take({ kind: 'book', book, id });
    const f = folios.find((x) => x.id === id)!;
    this.hud.announce(`Folio ${f.n}, ${f.title}, opened. ${book.pageInfo.total} pages. Use the arrow keys to turn the pages, Escape to put it back.`);
  }

  private openNotebook(): void {
    const book = this.desk?.notebook;
    if (!book) return;
    this.putDown(true);
    book.open(this.printScale(book));
    this.take({ kind: 'book', book, id: 'notebook' });
    this.hud.announce('The notebook: notes on building the studio. Use the arrow keys to turn the pages.');
  }

  private pickUp(id: 'cards' | 'cv' | 'phone'): void {
    const held = id === 'cards' ? this.desk?.card : id === 'cv' ? this.desk?.cv : this.desk?.phone;
    if (!held) return;
    if (this.inHand?.kind === 'held' && this.inHand.held === held) return;
    this.putDown(true);
    held.open(this.reduceMotion);
    this.take({ kind: 'held', held, id });
    const say = { cards: 'A business card. Click it to turn it over.', cv: 'The one-page CV. Click to read it closer.', phone: 'The phone. Its screen has links to LinkedIn and email.' }[id];
    this.hud.announce(say);
  }

  private take(h: Exclude<InHand, null>): void {
    this.inHand = h;
    this.hud.setText(h.kind === 'book' ? h.book.html : null);
    this.rig.setLook(LOOKS.read);
    this.rig.setPointer(0, 0);
    this.renderer.domElement.style.cursor = 'default';
    this.hud.showTip(null);
    this.syncReader(true);
  }

  /** Put whatever is held back where it came from. */
  private putDown(quiet = false): void {
    const h = this.inHand;
    if (!h) return;
    this.inHand = null;
    if (h.kind === 'book') h.book.close();
    else h.held.close(this.reduceMotion);
    this.rig.setLook(LOOKS[this.focus] ?? LOOKS.home);
    this.hud.setReader(null);
    this.hud.setText(null);
    this.hud.showTip(null);
    this.renderer.domElement.style.cursor = 'default';
    if (!quiet) this.hud.announce('Put back.');
  }

  /** Type size for print: phones get larger type (and more pages). */
  private printScale(book: Book): number {
    const r = this.renderer.domElement;
    const w = r.clientWidth || window.innerWidth;
    const portrait = w / (r.clientHeight || window.innerHeight) < 0.95;
    const g = book.geom;
    // share of the screen width one page will take
    const pageShare = portrait ? (g.pageW / (g.boardW + 0.012)) * 0.9 : (g.pageW / (2 * (g.pageU + g.pageW) + 0.012)) * 0.9;
    const css = w * pageShare;
    return THREE.MathUtils.clamp(580 / css, 1, 1.9);
  }

  private turnPage(dir: number): void {
    const h = this.inHand;
    if (h?.kind !== 'book') return;
    if (dir > 0 ? h.book.next() : h.book.prev()) this.syncReader(true);
  }

  private lastReader = '';

  /** Keep the HUD's reading bar in step with what is held. */
  private syncReader(force = false): void {
    const h = this.inHand;
    if (!h) return;
    let state: Parameters<Hud['setReader']>[0];
    if (h.kind === 'book') {
      const { left, right, total } = h.book.pageInfo;
      const f = folios.find((x) => x.id === h.id);
      const title = f ? `Folio ${f.n} · ${f.title}` : 'Notebook · Building the studio';
      let sub: string;
      if (h.book.openness < 0.5) sub = 'Opening…';
      else if (left && right) sub = `Pages ${left}–${right} of ${total}`;
      else if (right || left) sub = `Page ${right || left} of ${total}`;
      else sub = h.book.showingLeft ? `Contents · ${total} pages` : 'The end';
      state = { title, sub, pager: true, canPrev: h.book.canPrev, canNext: h.book.canNext };
    } else if (h.id === 'cards') {
      state = { title: 'Business card', sub: 'Click it to turn it over', pager: false, actions: [{ label: 'Email', href: `mailto:${profile.email}` }, { label: 'LinkedIn ↗', href: profile.linkedin, quiet: true }] };
    } else if (h.id === 'cv') {
      state = { title: 'CV · one page', sub: 'Click the sheet to read closer', pager: false, actions: [{ label: 'Open the CV ↗', href: '/page/cv/' }, { label: 'Full CV ↗', href: '/page/cv-long/', quiet: true }] };
    } else {
      state = { title: 'Phone', sub: 'Tap a button on the screen', pager: false, actions: [{ label: 'LinkedIn ↗', href: profile.linkedin }] };
    }
    const key = JSON.stringify(state);
    if (!force && key === this.lastReader) return;
    this.lastReader = key;
    this.hud.setReader(state);
  }

  // ------------------------------------------------------------------ using things

  /** What happens when a thing in the room (or its dot) is used. */
  private use(id: string): void {
    if (id.startsWith('folio:')) return this.openDossier(id.slice(6) as FolioId);
    switch (id) {
      case 'shelf':
        return this.setFocus('shelf');
      case 'objects':
        return this.setFocus('objects');
      case 'display':
      case 'desk':
        return this.setFocus('desk');
      case 'window':
        return this.setFocus(this.focus === 'window' ? 'home' : 'window');
      case 'lights':
        return this.setNight(!this.night);
      case 'record':
        if (this.focus !== 'record' && !this.music.playing) this.setFocus('record');
        void this.toggleMusic();
        return;
      case 'cards':
      case 'cv':
      case 'phone':
        return this.pickUp(id);
      case 'notebook':
        return this.openNotebook();
      case 'globe':
        this.desk?.spinGlobe(1);
        return this.hud.showCaption({
          title: 'A global network',
          text: 'The Global AI Innovator programme: 80+ innovators and ambassadors, a hub-and-spoke network of AI champions across regions. Give the sphere another spin.',
          actions: [{ label: 'Read the case', act: 'case:4' }, { label: 'Spin', act: 'spin', quiet: true }],
        });
      case 'coffee':
        this.desk?.pour();
        return this.hud.showCaption({
          title: 'Coffee in Budapest?',
          text: 'Always up for a conversation about applied AI, enablement and adoption, over coffee in Budapest or on a call.',
          actions: [{ label: 'Email', href: `mailto:${profile.email}` }, { label: 'LinkedIn ↗', href: profile.linkedin, quiet: true }],
        });
      case 'about':
        return this.hud.showCaption({
          title: profile.name,
          text: `${profile.role}, ${profile.org} ${profile.orgUnit}, ${profile.location}. ${profile.intro}`,
          actions: [{ label: 'Read “Hello”', act: 'open:hello' }, { label: 'Contact', act: 'open:contact', quiet: true }],
        });
      case 'music':
        void this.toggleMusic().then(() =>
          this.hud.showCaption({
            title: 'Budapest sessions',
            text: this.music.playing ? 'Lounge deep house, generated live in your browser. Now playing.' : 'Lounge deep house, generated live in your browser. Stopped.',
            actions: [{ label: this.music.playing ? 'Stop' : 'Play', act: 'music' }],
          }),
        );
        return;
      case 'print':
        return this.hud.showCaption({ title: '“Duna”', text: 'A print drawn for the studio in the site’s palette: a low sun, layered hills, the river.' });
      case 'screen':
        return this.setFocus('desk');
    }
  }

  /** Buttons on the HUD's cards and reading bar. */
  private act(id: string): void {
    if (id.startsWith('open:')) {
      this.hud.showCaption(null);
      return this.openDossier(id.slice(5) as FolioId);
    }
    if (id.startsWith('case:')) {
      this.hud.showCaption(null);
      const n = cases[Number(id.slice(5))]?.n;
      const book = this.shelf?.get('work');
      if (!book) return;
      this.openDossier('work');
      // the case's page, from the dossier's contents
      const page = n ? book.tocPage(`${n} `) : null;
      if (page) book.goToPage(page);
      this.syncReader(true);
      return;
    }
    if (id === 'spin') return this.desk?.spinGlobe(1);
    if (id === 'music') return this.use('music');
  }

  // ------------------------------------------------------------------ input

  private ndc(e: PointerEvent): void {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  private pick(): THREE.Intersection | null {
    this.raycaster.setFromCamera(this.pointer, this.rig.camera);
    const hits = this.raycaster.intersectObjects([...this.hitTargets, ...(this.screenMesh ? [this.screenMesh] : [])], true);
    return hits.find((h) => !h.object.userData.page) ?? null;
  }

  private targetOf(o: THREE.Object3D | null): THREE.Object3D | null {
    let cur = o;
    while (cur && !cur.userData?.hit) cur = cur.parent;
    return cur;
  }

  /** What the pointer is over on the thing held: a link, a page side, a face. */
  private handTarget(): { label: string; href?: string; run?: () => void } | null {
    const h = this.inHand;
    if (!h) return null;
    this.raycaster.setFromCamera(this.pointer, this.rig.camera);
    if (h.kind === 'book') {
      const hit = this.raycaster.intersectObjects(h.book.pageMeshes, false)[0];
      if (!hit?.uv) return null;
      const link = h.book.linkAt(hit.object, hit.uv);
      if (link) return { label: link.label, href: link.href };
      const side = h.book.sideOf(hit.object);
      if (side === 'right') return { label: 'Next page', run: () => this.turnPage(1) };
      if (side === 'left') return { label: 'Previous page', run: () => this.turnPage(-1) };
      return null;
    }
    const held = h.held;
    const hit = this.raycaster.intersectObjects(held.faces, false)[0];
    if (!hit?.uv) return null;
    if (h.id === 'phone') {
      const r = held.regionAt(hit.uv, PHONE_PX[0], PHONE_PX[1]);
      return r ? { label: r.label, href: r.href } : { label: 'Phone' };
    }
    if (h.id === 'cards') {
      const front = held.flip.target < Math.PI / 2 && hit.object.userData.face === 'front';
      const r = front ? held.regionAt(hit.uv, CARD_PX[0], CARD_PX[1]) : null;
      return r ? { label: r.label, href: r.href } : { label: 'Turn it over', run: () => held.turnOver() };
    }
    // the CV: click to read closer, again to see the whole page
    return {
      label: held.zoom.target > 0.5 ? 'See the whole page' : 'Read closer',
      run: () => {
        if (held.zoom.target > 0.5) held.zoom.target = 0;
        else {
          held.focus.set(THREE.MathUtils.clamp(hit.uv!.x - 0.5, -0.3, 0.3), THREE.MathUtils.clamp(hit.uv!.y - 0.5, -0.32, 0.32));
          held.zoom.target = 1;
        }
      },
    };
  }

  private follow(href: string): void {
    if (/^https?:/.test(href)) window.open(href, '_blank', 'noopener');
    else window.location.href = href;
  }

  private onPointerMove(e: PointerEvent): void {
    this.ndc(e);
    if (this.inHand) {
      if (this.down && e.pointerType !== 'mouse') return;
      const t = this.handTarget();
      this.renderer.domElement.style.cursor = t && (t.href || t.run) ? 'pointer' : 'default';
      this.hud.showTip(t && e.pointerType === 'mouse' ? t.label : null, e.clientX, e.clientY);
      return;
    }
    if (this.down && e.pointerType !== 'mouse') {
      const dx = e.clientX - this.down.x;
      const dy = e.clientY - this.down.y;
      if (Math.hypot(dx, dy) > 8) this.dragLook = true;
      if (this.dragLook) this.rig.setPointer(THREE.MathUtils.clamp(-dx / 200, -1, 1), THREE.MathUtils.clamp(dy / 200, -1, 1));
      return;
    }
    if (e.pointerType === 'mouse') this.rig.setPointer(this.pointer.x, this.pointer.y);
    const hit = this.pick();
    const target = this.targetOf(hit?.object ?? null);
    const hitId = (target?.userData.hit as string | undefined) ?? '';
    // pointer on the display while sitting at the desk goes to the screen UI
    if (hitId === 'screen' && this.focus === 'desk' && hit?.uv) {
      this.screen.pointer(hit.uv.x * 1600, hit.uv.y * 1000, 'move');
      this.hud.showTip(null);
      this.shelf?.setHover(null);
      return;
    }
    this.screen.pointer(0, 0, 'leave');
    this.hovered = target;
    const folioId = hitId.startsWith('folio:') ? (hitId.slice(6) as FolioId) : null;
    this.shelf?.setHover(folioId);
    let label = (target?.userData.label as string | undefined) ?? '';
    if (folioId) {
      const f = folios.find((x) => x.id === folioId)!;
      label = `Folio ${f.n} · ${f.title} · open`;
    } else if (hitId === 'lights') label = this.night ? `${label} · switch to day` : `${label} · switch to evening`;
    else if (hitId === 'record' || hitId === 'music') label = this.music.playing ? `${label} · stop the music` : `${label} · play a record`;
    else if (hitId === 'screen') label = 'Sit at the desk';
    else if (hitId === 'cards') label = 'Business cards · take one';
    else if (hitId === 'cv' || hitId === 'phone' || hitId === 'notebook') label = `${label} · pick up`;
    this.renderer.domElement.style.cursor = target ? 'pointer' : 'default';
    this.hud.showTip(target && e.pointerType === 'mouse' ? label : null, e.clientX, e.clientY);
  }

  private onPointerDown(e: PointerEvent): void {
    this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
    this.dragLook = false;
    this.ndc(e);
    if (this.inHand) return;
    const hit = this.pick();
    if (this.targetOf(hit?.object ?? null)?.userData.hit === 'screen' && this.focus === 'desk' && hit?.uv) this.screen.pointer(hit.uv.x * 1600, hit.uv.y * 1000, 'down');
  }

  private onPointerUp(e: PointerEvent): void {
    const down = this.down;
    this.down = null;
    if (!down) return;
    if (this.inHand) {
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      // a swipe turns the page
      if (this.inHand.kind === 'book' && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) return this.turnPage(dx < 0 ? 1 : -1);
      if (Math.hypot(dx, dy) > 8) return;
      this.ndc(e);
      const t = this.handTarget();
      if (!t) return this.putDown();
      if (t.href) return this.follow(t.href);
      t.run?.();
      return;
    }
    if (this.dragLook) {
      this.dragLook = false;
      this.rig.setPointer(0, 0);
      return;
    }
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return;
    this.ndc(e);
    const hit = this.pick();
    const target = this.targetOf(hit?.object ?? null);
    const id = (target?.userData.hit as string | undefined) ?? '';
    if (id === 'screen') {
      if (this.focus === 'desk' && hit?.uv) this.screen.pointer(hit.uv.x * 1600, hit.uv.y * 1000, 'up');
      else this.setFocus('desk');
      return;
    }
    if (id) return this.use(id);
    if (this.hud.captionOpen) return this.hud.showCaption(null);
    if (this.focus !== 'home') this.setFocus('home');
  }

  private onWheel(e: WheelEvent): void {
    if (this.inHand?.kind !== 'book') return;
    e.preventDefault();
    const now = performance.now();
    if (now - this.wheelAt > 400) this.wheelAcc = 0;
    this.wheelAcc += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(this.wheelAcc) > 80 && now - this.wheelAt > 380) {
      this.turnPage(this.wheelAcc > 0 ? 1 : -1);
      this.wheelAcc = 0;
      this.wheelAt = now;
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement;
    if (target && target.closest('.hud, .spots') && (e.key === 'Enter' || e.key === ' ')) return;
    if (this.inHand) {
      if (e.key === 'Escape') return this.putDown();
      if (this.inHand.kind === 'book' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'PageDown' || e.key === 'PageUp')) {
        e.preventDefault();
        return this.turnPage(e.key === 'ArrowRight' || e.key === 'PageDown' ? 1 : -1);
      }
      if (this.inHand.kind === 'held' && this.inHand.id === 'cards' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        return this.inHand.held.turnOver();
      }
    }
    if (e.key === 'Escape') {
      if (this.hud.captionOpen) return this.hud.showCaption(null);
      if (this.focus !== 'home') this.setFocus('home');
      else this.hud.toggleMenu(false);
      return;
    }
    if (/^[0-7]$/.test(e.key)) {
      this.openDossier(folios[Number(e.key)].id);
      return;
    }
    if (e.key === 'l' || e.key === 'L') return this.setNight(!this.night);
    if (e.key === 'm' || e.key === 'M') return void this.toggleMusic();
    if (this.inHand) return;
    if (this.focus === 'desk' && this.screen.key(e)) {
      e.preventDefault();
      return;
    }
    if (this.focus === 'desk' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      const i = folios.findIndex((f) => f.id === this.screen.current);
      const next = (i + (e.key === 'ArrowRight' ? 1 : folios.length - 1)) % folios.length;
      this.showOnScreen(folios[next].id);
    }
  }

  // ------------------------------------------------------------------ hotspots

  private spotList(meta: StudioMeta, root: THREE.Object3D): Spot[] {
    const o = meta.objects ?? {};
    const at = (k: string, dy = 0) => (o[k] ? v3(o[k]).add(new THREE.Vector3(0, dy, 0)) : null);
    const centre = (name: string, dy = 0) => {
      const n = root.getObjectByName(name);
      if (!n) return null;
      const b = new THREE.Box3().setFromObject(n);
      return b.getCenter(new THREE.Vector3()).add(new THREE.Vector3(0, dy, 0));
    };
    const shelfAt = (() => {
      const a = root.getObjectByName('folio_00');
      const b = root.getObjectByName('folio_07');
      if (!a || !b) return null;
      return a.position.clone().lerp(b.position, 0.5).add(new THREE.Vector3(0.02, 0.33, 0));
    })();
    const list: (Spot | null)[] = [
      shelfAt && { id: 'shelf', label: 'Dossiers · one per chapter', at: shelfAt, focus: ['home'] },
      centre('tt_platter', 0.05) && { id: 'record', label: 'Record player', at: centre('tt_platter', 0.05)!, focus: ['home'] },
      this.screenMesh ? { id: 'display', label: 'Sit at the desk', at: centre('screen', 0.12)!, focus: ['home'] } : null,
      { id: 'objects', label: 'On the desk', at: v3([0.32, 0.86, -1.72]), focus: ['home'] },
      { id: 'window', label: 'Budapest, outside', at: v3([0.62, 2.05, -2.3]), focus: ['home'] },
      at('cards', 0.03) && { id: 'cards', label: 'Business cards', at: at('cards', 0.03)!, focus: ['objects'] },
      at('phone', 0.02) && { id: 'phone', label: 'Phone', at: at('phone', 0.02)!, focus: ['objects'] },
      at('cv', 0.02) && { id: 'cv', label: 'CV', at: at('cv', 0.02)!, focus: ['objects'] },
      at('notebook', 0.02) && { id: 'notebook', label: 'Notebook · build notes', at: at('notebook', 0.02)!, focus: ['objects'] },
      at('about', 0.06) && { id: 'about', label: 'About me', at: at('about', 0.06)!, focus: ['objects'] },
      at('globe', 0.1) && { id: 'globe', label: 'Global network', at: at('globe', 0.1)!, focus: ['objects'] },
      at('coffee', 0.03) && { id: 'coffee', label: 'Coffee?', at: at('coffee', 0.03)!, focus: ['objects'] },
      at('music', 0.04) && { id: 'music', label: 'Music', at: at('music', 0.04)!, focus: ['objects'] },
    ];
    return list.filter((x): x is Spot => !!x);
  }
}

export function describeStudio(): string {
  return `${profile.name}'s studio`;
}
