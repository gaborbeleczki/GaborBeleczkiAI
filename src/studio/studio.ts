import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { folios, profile, type FolioId } from '../../content/profile.ts';
import { Ambient } from './audio/ambient.ts';
import { Folios } from './core/folios.ts';
import { bakedMaterial, configureTexture, emitterMaterial } from './core/materials.ts';
import { CameraRig, type Pose } from './core/rig.ts';
import { Turntable } from './core/turntable.ts';
import { WindowView, type CityMeta } from './core/window.ts';
import { Screen } from './screen/screen.ts';
import { Hud } from './ui/hud.ts';

interface StudioMeta {
  poses: Record<string, { pos: number[]; target: number[]; fit: [number, number] }>;
  screen: { size: [number, number]; pixels: [number, number] };
  folios: { id: FolioId; object: string; color: string }[];
  folioSize: [number, number, number];
  lights: Record<string, number[]>;
  flame: number[];
  window: { center: number[]; size: [number, number] };
  atlases: string[];
  bake: Record<string, Record<string, { lmax: number }>>;
}

export interface StudioOptions {
  onExit(): void;
  onFatal(reason: string): void;
}

type Focus = 'home' | 'desk' | 'shelf' | 'window' | 'record';

const v3 = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);

const HINTS: Record<Focus, string> = {
  home: 'Pick a folio on the shelf · click the display, the window or a lamp',
  desk: 'Use the dock on the display · <kbd>←</kbd> <kbd>→</kbd> to browse · <kbd>Esc</kbd> to step back',
  shelf: 'Each folio is a chapter · click one to open it',
  window: 'Budapest, across the Danube · watch for the trams',
  record: 'Studio sessions: generated ambient music · click again to stop',
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
  private folios?: Folios;
  private turntable?: Turntable;
  private readonly ambient = new Ambient();
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
  private dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  private contextLostTimer = 0;
  private readonly cleanups: (() => void)[] = [];
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
      back: () => this.setFocus('home'),
      toggleLights: () => this.setNight(!this.night),
      toggleSound: () => this.toggleMusic(),
      pageView: () => this.opts.onExit(),
      open: (id) => this.openFolio(id),
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
    const meta: StudioMeta = await fetch('/models/studio.json').then((r) => {
      if (!r.ok) throw new Error('studio.json');
      return r.json();
    });
    const city: CityMeta = await fetch('/models/city.json').then((r) => r.json());
    this.meta = meta;
    for (const [k, p] of Object.entries(meta.poses)) this.poses[k] = { pos: v3(p.pos), target: v3(p.target), fit: p.fit };

    const tl = new THREE.TextureLoader(manager);
    const tex = (url: string, srgb: boolean, flipY: boolean) =>
      new Promise<THREE.Texture>((res, rej) => tl.load(url, (t) => res(configureTexture(t, { srgb, flipY, aniso: this.renderer.capabilities.getMaxAnisotropy() >= 8 ? 8 : 4 })), undefined, rej));
    const gltfLoader = new GLTFLoader(manager);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    const hdr = new HDRLoader(manager);
    const loadHdr = (url: string) => new Promise<THREE.Texture>((res, rej) => hdr.load(url, res, undefined, rej));

    const atlasJobs = meta.atlases.map(async (g) => {
      const [albedo, evening, day] = await Promise.all([
        tex(`/textures/${g}_albedo.webp`, true, false),
        tex(`/textures/${g}_light_evening.webp`, true, false),
        tex(`/textures/${g}_light_day.webp`, true, false),
      ]);
      return [g, { albedo, evening, day }] as const;
    });
    const [gltf, atlases, cityE, cityD, cityData, tramE, tramD, envE, envD] = await Promise.all([
      gltfLoader.loadAsync('/models/studio.glb'),
      Promise.all(atlasJobs),
      tex('/textures/city_evening.webp', true, true),
      tex('/textures/city_day.webp', true, true),
      tex('/textures/city_data.webp', false, true),
      tex('/textures/tram_evening.webp', true, true),
      tex('/textures/tram_day.webp', true, true),
      loadHdr('/textures/room_evening.hdr').catch(() => null),
      loadHdr('/textures/room_day.hdr').catch(() => null),
    ]);
    cityData.generateMipmaps = false;
    cityData.minFilter = THREE.LinearFilter;

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
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const ud = o.userData || {};
      if (o.name.startsWith('bake_') && mesh.isMesh) {
        const g = o.name.slice(5);
        const set = sets.get(g);
        const scales = meta.bake?.[g] ?? {};
        if (set) {
          const m = bakedMaterial({
            albedo: set.albedo,
            evening: set.evening,
            day: set.day,
            scaleEvening: scales.evening?.lmax ?? 1,
            scaleDay: scales.day?.lmax ?? 1,
          });
          mesh.material = m;
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
        onOpen: (id) => this.openFolio(id),
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
      meta: city,
      cityEvening: cityE,
      cityDay: cityD,
      data: cityData,
      tramEvening: tramE,
      tramDay: tramD,
    });
    this.scene.add(this.windowView.mesh);

    // folios, record player
    const deskSpot = v3(meta.poses.desk.target).add(new THREE.Vector3(0.42, -0.33, 0.12));
    deskSpot.y = 0.751;
    this.folios = new Folios(root, deskSpot, meta.folioSize, this.reduceMotion);
    this.turntable = new Turntable(root.getObjectByName('tt_platter'), root.getObjectByName('tt_record'), root.getObjectByName('tonearm'));

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
    this.applyState(this.dayT);

    this.rig = new CameraRig(this.poses.home);
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
    on(window, 'keydown', (e) => this.onKey(e as KeyboardEvent));
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
    this.hud.announce(`Studio loaded. ${HINTS.home}. Press 0 to 7 to open a chapter, L for light, M for music.`);
    this.exposeHooks();
    void this.screen.prefetch();
    if (!this.capture) this.resume();
    canvas.focus({ preventScroll: true });
  }

  /** Test and capture hooks: window.__studio (always) and manual stepping with ?capture. */
  private exposeHooks(): void {
    const api = {
      ready: true,
      info: () => ({ focus: this.focus, module: this.screen.current, screenReady: this.screen.ready, night: this.night, dpr: this.dpr, size: [this.renderer.domElement.width, this.renderer.domElement.height] }),
      prefetched: () => this.screen.prefetch().then(() => true),
      exposure: (v: number) => (this.renderer.toneMappingExposure = v),
      open: (id: FolioId) => this.openFolio(id),
      focus: (f: Focus) => this.setFocus(f),
      night: (n: boolean) => this.setNight(n),
      lookAt: (x: number, y: number) => this.rig.setPointer(x, y),
      drift: (on: boolean) => (this.drift = on ? 1 : 0),
      // advance the simulation n steps but only draw the last one (software WebGL is slow)
      step: (dt: number, n = 1) => {
        for (let i = 0; i < n; i++) this.frame(dt, i === n - 1);
      },
      screenPng: () => this.screen.canvas.toDataURL('image/png'),
      screenMaterial: () => {
        const m = this.screenMesh?.material as THREE.MeshBasicMaterial | undefined;
        const uv = this.screenMesh?.geometry.getAttribute('uv');
        return { has: !!this.screenMesh, type: m?.type, map: !!m?.map, uvCount: uv?.count ?? 0, uv0: uv ? [uv.getX(0), uv.getY(0), uv.getX(2), uv.getY(2)] : null, normalized: (uv as THREE.BufferAttribute | undefined)?.normalized };
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
    this.ambient.dispose();
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
    this.rig.update(dt);
    // day/evening cross-fade
    if (this.dayT !== this.dayGoal) {
      const step = this.reduceMotion ? 1 : dt / 1.6;
      this.dayT = this.dayGoal > this.dayT ? Math.min(this.dayGoal, this.dayT + step) : Math.max(this.dayGoal, this.dayT - step);
      this.applyState(this.dayT);
    }
    this.windowView?.update(dt, this.time, this.rig.camera, this.reduceMotion);
    this.folios?.update(dt);
    this.turntable?.update(dt);
    this.screen.update(dt);
    if (this.flame) {
      const f = this.reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(this.time * 13.1) * Math.sin(this.time * 7.3 + 1.3);
      this.flame.scale.set(0.02 * f, 0.048 * (0.9 + 0.2 * f), 1);
      (this.flame.material as THREE.SpriteMaterial).opacity = (1 - this.dayT) * 0.95;
    }
    if (!draw) return;
    this.renderer.render(this.scene, this.rig.camera);
    if (!this.capture) this.adapt(dt);
  }

  /** Lower the pixel ratio when frames run long; raise it back carefully. */
  private adapt(dt: number): void {
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    const max = Math.min(window.devicePixelRatio || 1, 1.75);
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
  }

  private setNight(night: boolean): void {
    this.night = night;
    this.dayGoal = night ? 0 : 1;
    this.hud.setNight(night);
    this.hud.announce(night ? 'Evening. The lamps are on.' : 'Daylight.');
  }

  private async toggleMusic(force?: boolean): Promise<void> {
    const on = force ?? !this.ambient.playing;
    if (on) await this.ambient.start();
    else this.ambient.stop();
    this.turntable?.setPlaying(on);
    this.hud.setSound(on);
  }

  private setFocus(f: Focus): void {
    if (f !== 'desk' && this.focus === 'desk') this.folios?.select(null);
    this.focus = f;
    const pose = this.poses[f] ?? this.poses.home;
    this.rig.goTo(pose, f === 'home' ? 1.5 : 1.25);
    this.rig.lookStrength = f === 'home' ? 1 : f === 'desk' ? 0.12 : 0.45;
    this.hud.setFocused(f !== 'home');
    this.hud.setHint(HINTS[f]);
    if (f === 'window') this.windowView?.hurryTram();
    if (f !== 'desk') this.renderer.domElement.style.cursor = 'default';
  }

  private openFolio(id: FolioId): void {
    void this.screen.show(id);
    this.folios?.select(id === 'hello' ? null : id);
    this.hud.setCurrent(id);
    if (this.focus !== 'desk') this.setFocus('desk');
  }

  // ------------------------------------------------------------------ input

  private ndc(e: PointerEvent): void {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  private pick(): THREE.Intersection | null {
    this.raycaster.setFromCamera(this.pointer, this.rig.camera);
    const hits = this.raycaster.intersectObjects([...this.hitTargets, ...(this.screenMesh ? [this.screenMesh] : [])], true);
    return hits[0] ?? null;
  }

  private targetOf(o: THREE.Object3D | null): THREE.Object3D | null {
    let cur = o;
    while (cur && !cur.userData?.hit) cur = cur.parent;
    return cur;
  }

  private onPointerMove(e: PointerEvent): void {
    this.ndc(e);
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
      this.folios?.setHover(null);
      return;
    }
    this.screen.pointer(0, 0, 'leave');
    this.hovered = target;
    const folioId = hitId.startsWith('folio:') ? (hitId.slice(6) as FolioId) : null;
    this.folios?.setHover(folioId);
    let label = (target?.userData.label as string | undefined) ?? '';
    if (folioId) {
      const f = folios.find((x) => x.id === folioId)!;
      label = `Folio ${f.n} · ${f.title}`;
    } else if (hitId === 'lights') label = this.night ? `${label} · switch to day` : `${label} · switch to evening`;
    else if (hitId === 'record') label = this.ambient.playing ? 'Stop the record' : 'Play a record';
    else if (hitId === 'screen') label = 'Sit at the desk';
    this.renderer.domElement.style.cursor = target ? 'pointer' : 'default';
    this.hud.showTip(target && e.pointerType === 'mouse' ? label : null, e.clientX, e.clientY);
  }

  private onPointerDown(e: PointerEvent): void {
    this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
    this.dragLook = false;
    this.ndc(e);
    const hit = this.pick();
    if (this.targetOf(hit?.object ?? null)?.userData.hit === 'screen' && this.focus === 'desk' && hit?.uv) this.screen.pointer(hit.uv.x * 1600, hit.uv.y * 1000, 'down');
  }

  private onPointerUp(e: PointerEvent): void {
    const down = this.down;
    this.down = null;
    if (!down) return;
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
    if (id.startsWith('folio:')) return this.openFolio(id.slice(6) as FolioId);
    if (id === 'window') return this.setFocus(this.focus === 'window' ? 'home' : 'window');
    if (id === 'lights') return this.setNight(!this.night);
    if (id === 'record') {
      if (this.focus !== 'record' && !this.ambient.playing) this.setFocus('record');
      void this.toggleMusic();
      return;
    }
    if (id === 'desk') return this.setFocus('desk');
    if (id === 'print') {
      this.hud.setHint('“Duna”: a print drawn for the studio, in the same palette as the site.');
      return;
    }
    if (this.focus !== 'home') this.setFocus('home');
  }

  private onKey(e: KeyboardEvent): void {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement;
    if (target && target.closest('.hud') && (e.key === 'Enter' || e.key === ' ')) return;
    if (e.key === 'Escape') {
      if (this.focus !== 'home') this.setFocus('home');
      else this.hud.toggleMenu(false);
      return;
    }
    if (/^[0-7]$/.test(e.key)) {
      this.openFolio(folios[Number(e.key)].id);
      return;
    }
    if (e.key === 'l' || e.key === 'L') return this.setNight(!this.night);
    if (e.key === 'm' || e.key === 'M') return void this.toggleMusic();
    if (this.focus === 'desk' && this.screen.key(e)) {
      e.preventDefault();
      return;
    }
    if (this.focus === 'desk' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      const i = folios.findIndex((f) => f.id === this.screen.current);
      const next = (i + (e.key === 'ArrowRight' ? 1 : folios.length - 1)) % folios.length;
      this.openFolio(folios[next].id);
    }
  }
}

export function describeStudio(): string {
  return `${profile.name}'s studio`;
}
