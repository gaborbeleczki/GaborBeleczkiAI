import * as THREE from 'three';

// Dust in the air: a couple of hundred motes drifting on slow random currents, rising a little
// above the warm lamps. They are only bright where light catches them: in the window light by
// day, around the lamps in the evening.

const vertex = /* glsl */ `
  attribute float seed;
  uniform float size;
  uniform float pixelRatio;
  uniform float dayT;
  uniform vec3 lampA;
  uniform vec3 lampB;
  uniform vec3 lampC;
  uniform vec4 windowBox;   // x0, x1, y0, y1 of the glass
  uniform float windowZ;
  varying float vLight;
  varying float vSeed;

  float lamp(vec3 p, vec3 l, float r) {
    vec3 d = p - l;
    return 1.0 / (1.0 + dot(d, d) / (r * r));
  }

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = size * pixelRatio * (0.6 + seed) / max(-mv.z, 0.2);
    // evening: lamps; day: a soft shaft from the window, fading into the room
    float eve = lamp(position, lampA, 0.45) + lamp(position, lampB, 0.35) * 0.8 + lamp(position, lampC, 0.45) * 0.6;
    float inWin = smoothstep(windowBox.x - 0.4, windowBox.x + 0.2, position.x) * (1.0 - smoothstep(windowBox.y - 0.2, windowBox.y + 0.4, position.x));
    inWin *= smoothstep(windowBox.z - 0.6, windowBox.z, position.y) * (1.0 - smoothstep(windowBox.w, windowBox.w + 0.5, position.y));
    float day = inWin * exp(-(position.z - windowZ) * 0.9);
    vLight = mix(eve * 0.9, day * 0.35, dayT);
    vSeed = seed;
  }
`;

const fragment = /* glsl */ `
  uniform float dayT;
  uniform float opacity;
  varying float vLight;
  varying float vSeed;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.0, length(c));
    vec3 col = mix(vec3(1.0, 0.82, 0.6), vec3(1.0, 0.97, 0.92), dayT);
    gl_FragColor = vec4(col, a * clamp(vLight, 0.0, 1.0) * opacity * (0.5 + vSeed * 0.5));
  }
`;

export class Dust {
  readonly points: THREE.Points;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly geo: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private t = 0;

  constructor(
    private readonly box: THREE.Box3,
    lamps: THREE.Vector3[],
    glass: { center: THREE.Vector3; size: [number, number] },
    count = 240,
  ) {
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const size = new THREE.Vector3();
    box.getSize(size);
    for (let i = 0; i < count; i++) {
      this.pos[i * 3] = box.min.x + Math.random() * size.x;
      this.pos[i * 3 + 1] = box.min.y + Math.random() * size.y;
      this.pos[i * 3 + 2] = box.min.z + Math.random() * size.z;
      seed[i] = Math.random();
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const [lA, lB, lC] = [lamps[0] ?? new THREE.Vector3(), lamps[1] ?? new THREE.Vector3(), lamps[2] ?? new THREE.Vector3()];
    const g = glass;
    this.material = new THREE.ShaderMaterial({
      name: 'dust',
      uniforms: {
        size: { value: 5.5 },
        pixelRatio: { value: 1 },
        dayT: { value: 0 },
        opacity: { value: 0.55 },
        lampA: { value: lA },
        lampB: { value: lB },
        lampC: { value: lC },
        windowBox: { value: new THREE.Vector4(g.center.x - g.size[0] / 2, g.center.x + g.size[0] / 2, g.center.y - g.size[1] / 2, g.center.y + g.size[1] / 2) },
        windowZ: { value: g.center.z },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.points = new THREE.Points(this.geo, this.material);
    this.points.name = 'dust';
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.points.raycast = () => {};
  }

  /** Physics step: a random walk with drag, buoyancy near the lamps, wrapped in the box. */
  step(h: number, lamps: THREE.Vector3[], evening: number): void {
    this.t += h;
    const p = this.pos;
    const v = this.vel;
    const { min, max } = this.box;
    const sx = max.x - min.x;
    const sy = max.y - min.y;
    const sz = max.z - min.z;
    for (let i = 0; i < p.length; i += 3) {
      // gentle turbulence (a few slow sines of position and time)
      const x = p[i];
      const y = p[i + 1];
      const z = p[i + 2];
      const ax = Math.sin(y * 2.1 + this.t * 0.31 + i) * 0.004 + (Math.random() - 0.5) * 0.01;
      let ay = Math.sin(z * 1.7 + this.t * 0.23 + i * 0.5) * 0.003 + (Math.random() - 0.5) * 0.01 - 0.0012;
      const az = Math.sin(x * 1.9 + this.t * 0.27 + i * 0.3) * 0.004 + (Math.random() - 0.5) * 0.01;
      for (const l of lamps) {
        const dx = x - l.x;
        const dz = z - l.z;
        const r2 = dx * dx + dz * dz;
        if (r2 < 0.25 && y > l.y - 0.6) ay += 0.008 * evening * (1 - r2 / 0.25);
      }
      v[i] = (v[i] + ax * h * 60) * (1 - 0.6 * h);
      v[i + 1] = (v[i + 1] + ay * h * 60) * (1 - 0.6 * h);
      v[i + 2] = (v[i + 2] + az * h * 60) * (1 - 0.6 * h);
      p[i] = x + v[i] * h;
      p[i + 1] = y + v[i + 1] * h;
      p[i + 2] = z + v[i + 2] * h;
      if (p[i] < min.x) p[i] += sx;
      else if (p[i] > max.x) p[i] -= sx;
      if (p[i + 1] < min.y) p[i + 1] += sy;
      else if (p[i + 1] > max.y) p[i + 1] -= sy;
      if (p[i + 2] < min.z) p[i + 2] += sz;
      else if (p[i + 2] > max.z) p[i + 2] -= sz;
    }
  }

  update(dayT: number, pixelRatio: number): void {
    (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.material.uniforms.dayT.value = dayT;
    this.material.uniforms.pixelRatio.value = pixelRatio;
  }
}
