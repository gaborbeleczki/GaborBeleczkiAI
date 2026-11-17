import * as THREE from 'three';

// The last touch on each frame: light that spills. Lamps, the fairy lights and the candle bloom
// softly into what surrounds them, and the corners fall away a little. (No grain: noise that
// changes every frame reads as flicker.)
//
// Only things that actually emit light glow (they live on GLOW_LAYER). The room is drawn once
// more, small and in black, so that a lamp behind the plant stays behind the plant.

export const GLOW_LAYER = 1;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }`;

export class Post {
  enabled = true;
  private readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly scene = new THREE.Scene();
  private readonly black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  private readonly targets: THREE.WebGLRenderTarget[] = [];
  private readonly bright: THREE.ShaderMaterial;
  private readonly blur: THREE.ShaderMaterial;
  private readonly comp: THREE.ShaderMaterial;
  private w = 0;
  private h = 0;

  /** `halfFloat`: the device can draw into half-float targets (else lights simply clip at white). */
  constructor(halfFloat: boolean) {
    const rt = (depth: boolean, samples = 0) => {
      const t = new THREE.WebGLRenderTarget(4, 4, { depthBuffer: depth, samples, type: halfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      t.texture.generateMipmaps = false;
      this.targets.push(t);
      return t;
    };
    // 0: the glow as drawn (a third of the view), 1-2: its blur, 3-4: a wider blur at a sixth.
    // The first is multisampled: a fairy bulb is less than a pixel at this size, and without it
    // the bulb (and its halo) blinked on and off as the view moved by a fraction of a pixel.
    rt(true, 4);
    for (let i = 0; i < 4; i++) rt(false);
    this.bright = new THREE.ShaderMaterial({
      uniforms: { map: { value: null }, threshold: { value: 0.62 } },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        uniform float threshold;
        varying vec2 vUv;
        void main() {
          vec3 c = texture2D(map, vUv).rgb;
          float l = max(c.r, max(c.g, c.b));
          // a soft knee: lights bloom, lit walls do not
          float k = smoothstep(threshold, threshold + 0.5, l);
          gl_FragColor = vec4(min(c * k, vec3(4.0)), 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.blur = new THREE.ShaderMaterial({
      uniforms: { map: { value: null }, dir: { value: new THREE.Vector2() } },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        uniform vec2 dir;
        varying vec2 vUv;
        void main() {
          vec3 c = texture2D(map, vUv).rgb * 0.227;
          c += (texture2D(map, vUv + dir * 1.385).rgb + texture2D(map, vUv - dir * 1.385).rgb) * 0.316;
          c += (texture2D(map, vUv + dir * 3.231).rgb + texture2D(map, vUv - dir * 3.231).rgb) * 0.0703;
          gl_FragColor = vec4(c, 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.comp = new THREE.ShaderMaterial({
      uniforms: { near: { value: null }, far: { value: null }, strength: { value: 0.5 }, vignette: { value: 0.22 }, grain: { value: 0 }, time: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D near;
        uniform sampler2D far;
        uniform float strength;
        uniform float vignette;
        uniform float grain;
        uniform float time;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          vec3 g = (texture2D(near, vUv).rgb + texture2D(far, vUv).rgb * 0.9) * strength;
          g = 1.0 - exp(-g);                         // never past white
          g = pow(g, vec3(1.0 / 2.2));               // the frame underneath is display-encoded
          vec2 q = (vUv - 0.5) * vec2(1.0, 0.86);
          float v = smoothstep(0.38, 0.98, length(q)) * vignette;
          float n = (hash(gl_FragCoord.xy + fract(time) * 173.0) - 0.5) * grain;
          // one blend does both: rgb is added, alpha darkens what is underneath
          gl_FragColor = vec4(g + max(n, 0.0), clamp(v + max(-n, 0.0), 0.0, 1.0));
        }`,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
      toneMapped: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.bright);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  /** `w`, `h` in device pixels. */
  setSize(w: number, h: number): void {
    const a = Math.max(2, Math.round(w / 3));
    const b = Math.max(2, Math.round(h / 3));
    if (a === this.w && b === this.h) return;
    this.w = a;
    this.h = b;
    this.targets[0].setSize(a, b);
    this.targets[1].setSize(a, b);
    this.targets[2].setSize(a, b);
    this.targets[3].setSize(Math.max(2, a >> 1), Math.max(2, b >> 1));
    this.targets[4].setSize(Math.max(2, a >> 1), Math.max(2, b >> 1));
  }

  private pass(r: THREE.WebGLRenderer, mat: THREE.ShaderMaterial, src: THREE.Texture, dst: THREE.WebGLRenderTarget | null): void {
    mat.uniforms[mat === this.comp ? 'near' : 'map'].value = src;
    this.quad.material = mat;
    r.setRenderTarget(dst);
    r.render(this.scene, this.cam);
  }

  /** Call right after the frame has been drawn to the screen. `night` 1 = evening, 0 = day. */
  render(r: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, time: number, night: number): void {
    if (!this.enabled || !this.w) return;
    const [glow, a, b, c, d] = this.targets;
    const auto = r.autoClear;
    const mask = camera.layers.mask;
    // the room in black (so things in front hide the lights behind them)...
    r.setRenderTarget(glow);
    r.autoClear = true;
    scene.overrideMaterial = this.black;
    r.render(scene, camera);
    scene.overrideMaterial = null;
    // ...then only what glows, over that depth
    r.autoClear = false;
    camera.layers.set(GLOW_LAYER);
    r.render(scene, camera);
    camera.layers.mask = mask;
    r.autoClear = true;
    // keep the bright part, blur it twice: a tight halo and a wide one
    this.pass(r, this.bright, glow.texture, a);
    this.blur.uniforms.dir.value.set(1 / this.w, 0);
    this.pass(r, this.blur, a.texture, b);
    this.blur.uniforms.dir.value.set(0, 1 / this.h);
    this.pass(r, this.blur, b.texture, a);
    this.blur.uniforms.dir.value.set(2 / this.w, 0);
    this.pass(r, this.blur, a.texture, c);
    this.blur.uniforms.dir.value.set(0, 2 / this.h);
    this.pass(r, this.blur, c.texture, d);
    this.blur.uniforms.dir.value.set(2 / this.w, 0);
    this.pass(r, this.blur, d.texture, c);
    // and lay it over the frame
    r.autoClear = false;
    this.comp.uniforms.far.value = c.texture;
    this.comp.uniforms.strength.value = 0.2 + 0.26 * night;
    this.comp.uniforms.time.value = time;
    this.pass(r, this.comp, a.texture, null);
    r.autoClear = auto;
  }

  dispose(): void {
    for (const t of this.targets) t.dispose();
    this.bright.dispose();
    this.blur.dispose();
    this.comp.dispose();
    this.black.dispose();
    this.quad.geometry.dispose();
  }
}
