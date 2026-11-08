import * as THREE from 'three';
import { Glide, Glide3, Spring, Wander } from './physics.ts';

export interface Pose {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  /** width/height (m) of the region around the target that must stay in frame */
  fit: [number, number];
}

/** How far the pointer moves the eye and the point looked at (metres for a full swing). */
export interface Look {
  eye: [number, number];
  target: [number, number];
  /** idle drift of the eye, metres */
  drift: number;
}

export const LOOKS: Record<string, Look> = {
  // a glance around the room: the eye moves a little, the gaze more
  home: { eye: [0.14, 0.07], target: [0.45, 0.24], drift: 0.008 },
  // at the display the view holds still: no sway, no drift
  desk: { eye: [0, 0], target: [0, 0], drift: 0 },
  objects: { eye: [0.02, 0.012], target: [0.05, 0.03], drift: 0 },
  shelf: { eye: [0.03, 0.015], target: [0.08, 0.04], drift: 0 },
  record: { eye: [0.03, 0.015], target: [0.08, 0.04], drift: 0 },
  // reading: whatever is held stays exactly where it is
  read: { eye: [0, 0], target: [0, 0], drift: 0 },
  // at the window you lean: the eye travels, the gaze barely turns, the city shifts in depth
  window: { eye: [0.32, 0.14], target: [0.08, 0.04], drift: 0.02 },
};

/**
 * Camera that glides between curated poses on critically damped springs (soft start, soft
 * landing, interruptible at any time). Each pose frames a rectangle around its target, so the
 * composition holds on wide and tall screens. The pointer moves the eye and the gaze; at the
 * window it becomes a lean, which is what makes the photo outside read as depth.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private readonly pos: Glide3;
  private readonly target: Glide3;
  private readonly fov: Glide;
  private to: Pose;
  private from: THREE.Vector3;
  private lift = 0;
  private aspect = 16 / 9;
  private readonly lookX = new Spring(0, 1.1, 1);
  private readonly lookY = new Spring(0, 1.1, 1);
  private look: Look = LOOKS.home;
  private prevLook: Look = LOOKS.home;
  private readonly blend = new Spring(1, 0.8, 1); // eases between look profiles
  private readonly wx = new Wander(0.13);
  private readonly wy = new Wander(0.11);
  private readonly drift = new THREE.Vector2();
  private readonly fwd = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly eye = new THREE.Vector3();
  private readonly gaze = new THREE.Vector3();
  /** no idle drift (reduced motion, captures) */
  calm = false;

  constructor(initial: Pose) {
    this.camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.03, 80);
    this.to = initial;
    this.from = initial.pos.clone();
    this.pos = new Glide3(initial.pos);
    this.target = new Glide3(initial.target);
    this.fov = new Glide(this.fovFor(initial));
    this.apply();
  }

  fovFor(p: Pose): number {
    const d = p.pos.distanceTo(p.target);
    const halfH = Math.max(p.fit[1] / 2, p.fit[0] / 2 / this.aspect);
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfH / d));
    return THREE.MathUtils.clamp(fov, 18, 72);
  }

  setAspect(aspect: number): void {
    this.aspect = aspect;
    this.camera.aspect = aspect;
    if (this.moving) this.fov.to(this.fovFor(this.to));
    else this.fov.snap(this.fovFor(this.to));
    this.apply();
  }

  /** Glide to a pose; `duration` is roughly how long the move takes. */
  goTo(pose: Pose, duration = 1.4, instant = false): void {
    this.from = this.pos.value.clone();
    this.to = pose;
    const f = 1 / Math.max(duration, 0.05);
    this.pos.freq = f;
    this.target.freq = f;
    this.fov.freq = f;
    // arc slightly upwards on long moves so the camera clears the furniture
    this.lift = Math.min(0.25, this.from.distanceTo(pose.pos) * 0.06);
    if (instant) {
      this.pos.snap(pose.pos);
      this.target.snap(pose.target);
      this.fov.snap(this.fovFor(pose));
      this.from = pose.pos.clone();
      this.lift = 0;
      this.apply();
      return;
    }
    this.pos.to(pose.pos);
    this.target.to(pose.target);
    this.fov.to(this.fovFor(pose));
  }

  /** Switch how the pointer moves the camera (per pose). */
  setLook(look: Look): void {
    if (look === this.look) return;
    this.prevLook = this.currentLook();
    this.look = look;
    this.blend.snap(0);
    this.blend.target = 1;
  }

  get moving(): boolean {
    return !(this.pos.settled && this.target.settled);
  }

  /** Pointer in normalised device coordinates (-1..1). */
  setPointer(x: number, y: number): void {
    this.lookX.target = x;
    this.lookY.target = y;
  }

  /** Physics step (fixed rate). */
  step(h: number): void {
    this.pos.step(h);
    this.target.step(h);
    this.fov.step(h);
    this.lookX.step(h);
    this.lookY.step(h);
    this.blend.step(h);
    const d = this.calm ? 0 : 1;
    this.drift.set(this.wx.step(h) * d, this.wy.step(h) * d);
  }

  private currentLook(): Look {
    const k = THREE.MathUtils.clamp(this.blend.value, 0, 1);
    const a = this.prevLook;
    const b = this.look;
    const mix = (p: number, q: number) => p + (q - p) * k;
    return {
      eye: [mix(a.eye[0], b.eye[0]), mix(a.eye[1], b.eye[1])],
      target: [mix(a.target[0], b.target[0]), mix(a.target[1], b.target[1])],
      drift: mix(a.drift, b.drift),
    };
  }

  /** Place the camera (every frame, after physics). */
  apply(): void {
    const look = this.currentLook();
    const p = this.pos.value;
    // progress along the current move, for the arc
    const total = this.from.distanceTo(this.to.pos);
    const k = total > 1e-3 ? THREE.MathUtils.clamp(1 - p.distanceTo(this.to.pos) / total, 0, 1) : 1;
    this.eye.copy(p);
    this.eye.y += Math.sin(Math.PI * k) * this.lift;
    this.gaze.copy(this.target.value);
    this.fwd.subVectors(this.gaze, this.eye).normalize();
    this.right.crossVectors(this.fwd, THREE.Object3D.DEFAULT_UP).normalize();
    this.up.crossVectors(this.right, this.fwd).normalize();
    const lx = this.lookX.value;
    const ly = this.lookY.value;
    this.eye
      .addScaledVector(this.right, lx * look.eye[0] + this.drift.x * look.drift)
      .addScaledVector(this.up, ly * look.eye[1] + this.drift.y * look.drift * 0.6);
    this.gaze.addScaledVector(this.right, lx * look.target[0]).addScaledVector(this.up, ly * look.target[1]);
    this.camera.position.copy(this.eye);
    this.camera.lookAt(this.gaze);
    this.camera.fov = this.fov.value;
    this.camera.updateProjectionMatrix();
  }

  /** Eye speed (m/s), for the air it stirs. */
  get speed(): number {
    return this.pos.follow.velocity.length();
  }
}
