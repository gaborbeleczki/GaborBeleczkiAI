import * as THREE from 'three';

// Small, deterministic physics for the studio: everything that moves on its own (camera, folios,
// record player, pendant, curtains) integrates at a fixed 120 Hz, however fast the screen
// refreshes. Springs use semi-implicit Euler, which stays stable at this step for the stiffnesses
// used here, and frame hitches are absorbed by capping the catch-up work.

export const STEP = 1 / 120;

/** Runs a callback at a fixed rate; leftover time carries to the next frame. */
export class FixedStep {
  private acc = 0;
  constructor(
    readonly h = STEP,
    private readonly maxSteps = 15,
  ) {}

  /** Advance by dt seconds; returns how far into the next step we are (0..1), for blending. */
  advance(dt: number, step: (h: number) => void): number {
    this.acc += Math.min(Math.max(dt, 0), this.h * this.maxSteps);
    while (this.acc >= this.h) {
      step(this.h);
      this.acc -= this.h;
    }
    return this.acc / this.h;
  }
}

/** Damped spring towards a target. freq in Hz, damping ratio 1 = no overshoot. */
export class Spring {
  velocity = 0;
  target: number;
  constructor(
    public value: number,
    public freq = 2,
    public damping = 1,
  ) {
    this.target = value;
  }

  step(h: number): void {
    const w = 2 * Math.PI * this.freq;
    const a = w * w * (this.target - this.value) - 2 * this.damping * w * this.velocity;
    this.velocity += a * h;
    this.value += this.velocity * h;
  }

  snap(v = this.target): void {
    this.value = this.target = v;
    this.velocity = 0;
  }

  get settled(): boolean {
    return Math.abs(this.target - this.value) < 1e-4 && Math.abs(this.velocity) < 1e-3;
  }
}

/** Spring in three dimensions. */
export class Spring3 {
  readonly value: THREE.Vector3;
  readonly velocity = new THREE.Vector3();
  readonly target: THREE.Vector3;
  private readonly tmp = new THREE.Vector3();
  constructor(
    value: THREE.Vector3,
    public freq = 2,
    public damping = 1,
  ) {
    this.value = value.clone();
    this.target = value.clone();
  }

  step(h: number): void {
    const w = 2 * Math.PI * this.freq;
    this.tmp.subVectors(this.target, this.value).multiplyScalar(w * w).addScaledVector(this.velocity, -2 * this.damping * w);
    this.velocity.addScaledVector(this.tmp, h);
    this.value.addScaledVector(this.velocity, h);
  }

  snap(v?: THREE.Vector3): void {
    if (v) this.target.copy(v);
    this.value.copy(this.target);
    this.velocity.set(0, 0, 0);
  }

  get settled(): boolean {
    return this.value.distanceToSquared(this.target) < 1e-8 && this.velocity.lengthSq() < 1e-6;
  }
}

/**
 * Two critically damped springs in a row: the first chases the goal, the second chases the first.
 * Movement starts gently and arrives gently (an S-curve) and can be redirected at any moment
 * without a jump in velocity. Good for camera moves.
 */
export class Glide3 {
  private readonly lead: Spring3;
  readonly follow: Spring3;
  constructor(value: THREE.Vector3, freq = 1.1) {
    this.lead = new Spring3(value, freq, 1);
    this.follow = new Spring3(value, freq, 1);
  }

  set freq(f: number) {
    this.lead.freq = f;
    this.follow.freq = f;
  }

  get value(): THREE.Vector3 {
    return this.follow.value;
  }

  get goal(): THREE.Vector3 {
    return this.lead.target;
  }

  step(h: number): void {
    this.lead.step(h);
    this.follow.target.copy(this.lead.value);
    this.follow.step(h);
  }

  to(v: THREE.Vector3): void {
    this.lead.target.copy(v);
  }

  snap(v: THREE.Vector3): void {
    this.lead.snap(v);
    this.follow.snap(v);
  }

  get settled(): boolean {
    return this.lead.settled && this.follow.settled;
  }
}

/** Scalar version of Glide3. */
export class Glide {
  private readonly lead: Spring;
  readonly follow: Spring;
  constructor(value: number, freq = 1.1) {
    this.lead = new Spring(value, freq, 1);
    this.follow = new Spring(value, freq, 1);
  }

  set freq(f: number) {
    this.lead.freq = f;
    this.follow.freq = f;
  }

  get value(): number {
    return this.follow.value;
  }

  get velocity(): number {
    return this.follow.velocity;
  }

  get goal(): number {
    return this.lead.target;
  }

  step(h: number): void {
    this.lead.step(h);
    this.follow.target = this.lead.value;
    this.follow.step(h);
  }

  to(v: number): void {
    this.lead.target = v;
  }

  snap(v: number): void {
    this.lead.snap(v);
    this.follow.snap(v);
  }

  get settled(): boolean {
    return this.lead.settled && this.follow.settled;
  }
}

/**
 * A pendulum hanging from a pivot, swinging in two directions (small angles, x and z tilt).
 * Air drag damps it; a breeze and nudges keep it alive.
 */
export class Pendulum {
  readonly angle = new THREE.Vector2();
  readonly rate = new THREE.Vector2();
  private readonly w0: number;
  constructor(
    readonly length: number,
    private readonly drag = 0.35,
  ) {
    this.w0 = Math.sqrt(9.81 / Math.max(length, 0.05));
  }

  /** Push with an angular velocity (rad/s). */
  nudge(x: number, z: number): void {
    this.rate.x += x;
    this.rate.y += z;
  }

  step(h: number, torqueX = 0, torqueZ = 0): void {
    const k = this.w0 * this.w0;
    const ax = -k * Math.sin(this.angle.x) - this.drag * this.rate.x + torqueX;
    const az = -k * Math.sin(this.angle.y) - this.drag * this.rate.y + torqueZ;
    this.rate.x += ax * h;
    this.rate.y += az * h;
    this.angle.x += this.rate.x * h;
    this.angle.y += this.rate.y * h;
  }
}

/** Smooth random signal in -1..1 (value noise over time), for breezes and idle drift. */
export class Wander {
  private a = Math.random() * 2 - 1;
  private b = Math.random() * 2 - 1;
  private t = 0;
  constructor(private readonly hz = 0.3) {}

  step(h: number): number {
    this.t += h * this.hz;
    while (this.t >= 1) {
      this.t -= 1;
      this.a = this.b;
      this.b = Math.random() * 2 - 1;
    }
    const s = this.t * this.t * (3 - 2 * this.t);
    return this.a + (this.b - this.a) * s;
  }
}
