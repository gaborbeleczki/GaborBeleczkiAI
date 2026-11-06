import * as THREE from 'three';

// The view out of the window. A Cycles render of Budapest from the window centre (110°),
// plus a small data texture: R = sqrt(10 m / depth), G = water, B = light sources.
// For every pixel of the glass we trace the viewer's ray into the depth map (a few
// fixed-point steps), so the embankment shifts against the castle as you move. City lights
// twinkle, the river shimmers, and a tram drives along the embankment every so often.

export interface CityMeta {
  nearDepth: number;
  hfov: number;
  camHeight: number;
  aspect: number;
  tramDepth: number;
  farTramDepth: number;
  farTramGround: number;
  tramLength: number;
  tramHeight: number;
}

const vertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D cityA;
  uniform sampler2D cityB;
  uniform sampler2D cityData;
  uniform sampler2D tramA;
  uniform sampler2D tramB;
  uniform float mixT;
  uniform float time;
  uniform float tanH;
  uniform float aspect;
  uniform float nearDepth;
  uniform float camHeight;
  uniform vec2 windowSize;
  uniform vec3 viewer;        // camera position in window space (x right, y up, z into the city)
  uniform vec4 tramNear;      // x centre (m), direction (+1/-1), visible (0/1), depth (m)
  uniform vec4 tramFar;
  uniform vec2 tramGround;    // ground height relative to the window centre: near, far (m)
  uniform vec2 tramSprite;    // sprite width, height (m)
  uniform vec3 glassTint;
  uniform float cityYaw;      // turn the city under the window so the castle sits in the main view
  uniform float cityPitch;    // and lift the horizon a little, as from a higher floor
  varying vec2 vUv;

  vec3 rotX(vec3 v, float a) {
    float c = cos(a), s = sin(a);
    return vec3(v.x, v.y * c + v.z * s, -v.y * s + v.z * c);
  }

  vec3 rotY(vec3 v, float a) {
    float c = cos(a), s = sin(a);
    return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
  }

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }

  vec3 drawTram(vec3 col, vec4 tr, float groundY, vec3 P, vec3 d, float sceneDepth) {
    if (tr.z < 0.5) return col;
    float t = (tr.w - P.z) / max(d.z, 1e-3);
    vec2 hit = P.xy + d.xy * t;
    vec2 tuv = vec2((hit.x - tr.x) / tramSprite.x + 0.5, (hit.y - groundY + 0.3) / tramSprite.y);
    if (tr.y < 0.0) tuv.x = 1.0 - tuv.x;
    if (tuv.x <= 0.0 || tuv.x >= 1.0 || tuv.y <= 0.0 || tuv.y >= 1.0) return col;
    if (sceneDepth < tr.w - 2.0) return col;
    vec4 tc = mix(texture2D(tramA, tuv), texture2D(tramB, tuv), mixT);
    return mix(col, tc.rgb, tc.a);
  }

  vec2 project(vec2 ndc) {
    return vec2(0.5 + ndc.x / (2.0 * tanH), 0.5 + ndc.y * aspect / (2.0 * tanH));
  }

  void main() {
    vec3 Pw = vec3((vUv - 0.5) * windowSize, 0.0);
    vec3 P = rotX(rotY(Pw, cityYaw), cityPitch);
    vec3 d = rotX(rotY(normalize(Pw - viewer), cityYaw), cityPitch);
    vec2 dirNdc = d.xy / max(d.z, 1e-3);
    vec2 uv = project(dirNdc);
    // fixed-point parallax: depth at the current guess -> reproject
    float depth = 1e6;
    for (int i = 0; i < 4; i++) {
      float s = texture2D(cityData, uv).r;
      float disp = s * s;
      depth = disp > 1e-4 ? nearDepth / disp : 1e6;
      uv = project(dirNdc + (P.xy - dirNdc * P.z) / depth);
    }
    vec4 data = texture2D(cityData, uv);
    // river shimmer: wobble the colour lookup over water
    float water = data.g;
    vec2 wob = vec2(
      (noise(vec2(uv.x * 90.0, uv.y * 900.0 - time * 0.7)) - 0.5) * 0.0025,
      (noise(vec2(uv.x * 40.0 + 7.0, uv.y * 600.0 + time * 0.5)) - 0.5) * 0.004
    );
    vec2 cuv = uv + wob * water;
    vec3 col = mix(texture2D(cityA, cuv).rgb, texture2D(cityB, cuv).rgb, mixT);
    // twinkling lights (evening only)
    float lights = data.b;
    float tw = noise(uv * vec2(900.0, 450.0) + vec2(time * 1.7, -time * 1.1));
    col += col * lights * (tw - 0.45) * 0.9 * (1.0 - mixT);
    // trams: one right below on the Pest embankment, one far away on the Buda side
    col = drawTram(col, tramFar, tramGround.y, P, d, depth);
    col = drawTram(col, tramNear, tramGround.x, P, d, depth);
    // a whisper of glass: faint room reflection towards grazing angles
    float fres = pow(1.0 - clamp(normalize(Pw - viewer).z, 0.0, 1.0), 3.0);
    col = mix(col, glassTint, 0.06 + 0.12 * fres);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

class TramLine {
  x = 0;
  dir = 1;
  active = false;
  constructor(
    private clock: number,
    private readonly range: number,
    private readonly speed: number,
    private readonly gap: [number, number],
  ) {}
  update(dt: number): void {
    if (!this.active) {
      this.clock -= dt;
      if (this.clock <= 0) {
        this.active = true;
        this.x = -this.range * this.dir;
      }
      return;
    }
    this.x += this.dir * this.speed * dt;
    if (Math.abs(this.x) > this.range) {
      this.active = false;
      this.dir *= -1;
      this.clock = this.gap[0] + Math.random() * (this.gap[1] - this.gap[0]);
    }
  }
  hurry(seconds: number): void {
    if (!this.active && this.clock > seconds) this.clock = seconds;
  }
}

export class WindowView {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  private readonly origin: THREE.Vector3;
  private readonly near = new TramLine(9, 150, 8.5, [30, 55]);
  private readonly far = new TramLine(3, 260, 8.5, [12, 30]);

  constructor(opts: {
    center: THREE.Vector3;
    size: [number, number];
    meta: CityMeta;
    cityEvening: THREE.Texture;
    cityDay: THREE.Texture;
    data: THREE.Texture;
    tramEvening: THREE.Texture;
    tramDay: THREE.Texture;
  }) {
    const { meta } = opts;
    // the plane sits just behind the frame, facing into the room (+z)
    this.origin = opts.center.clone().add(new THREE.Vector3(0, 0, -0.04));
    this.material = new THREE.ShaderMaterial({
      name: 'window-view',
      uniforms: {
        cityA: { value: opts.cityEvening },
        cityB: { value: opts.cityDay },
        cityData: { value: opts.data },
        tramA: { value: opts.tramEvening },
        tramB: { value: opts.tramDay },
        mixT: { value: 0 },
        time: { value: 0 },
        tanH: { value: Math.tan(THREE.MathUtils.degToRad(meta.hfov) / 2) },
        aspect: { value: meta.aspect },
        nearDepth: { value: meta.nearDepth },
        camHeight: { value: meta.camHeight },
        windowSize: { value: new THREE.Vector2(opts.size[0], opts.size[1]) },
        viewer: { value: new THREE.Vector3(0, 0, -3) },
        tramNear: { value: new THREE.Vector4(0, 1, 0, meta.tramDepth) },
        tramFar: { value: new THREE.Vector4(0, -1, 0, meta.farTramDepth) },
        tramGround: { value: new THREE.Vector2(-meta.camHeight, meta.farTramGround - meta.camHeight) },
        tramSprite: { value: new THREE.Vector2(32, 5) },
        glassTint: { value: new THREE.Color('#8b6a4c') },
        cityYaw: { value: THREE.MathUtils.degToRad(24) },
        cityPitch: { value: THREE.MathUtils.degToRad(4.5) },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(opts.size[0], opts.size[1]), this.material);
    this.mesh.position.copy(this.origin);
    this.mesh.name = 'window_view';
    this.mesh.renderOrder = -1;
  }

  setState(t: number): void {
    this.material.uniforms.mixT.value = t;
    (this.material.uniforms.glassTint.value as THREE.Color).set(t > 0.5 ? '#c9d3dc' : '#8b6a4c');
  }

  update(dt: number, time: number, camera: THREE.Camera, reduceMotion: boolean): void {
    const u = this.material.uniforms;
    u.time.value = reduceMotion ? 0 : time;
    const v = u.viewer.value as THREE.Vector3;
    const p = camera.position;
    // window space: x right, y up, z into the city (three.js -z)
    v.set(p.x - this.origin.x, p.y - this.origin.y, -(p.z - this.origin.z));
    const near = u.tramNear.value as THREE.Vector4;
    const far = u.tramFar.value as THREE.Vector4;
    if (reduceMotion) {
      near.z = 0;
      far.z = 0;
      return;
    }
    this.near.update(dt);
    this.far.update(dt);
    near.set(this.near.x, this.near.dir, this.near.active ? 1 : 0, near.w);
    far.set(this.far.x, this.far.dir, this.far.active ? 1 : 0, far.w);
  }

  /** Bring the next trams forward (the window close-up should not feel empty). */
  hurryTram(): void {
    this.near.hurry(2);
    this.far.hurry(1);
  }
}
