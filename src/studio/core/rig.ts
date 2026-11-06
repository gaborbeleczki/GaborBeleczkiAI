import * as THREE from 'three';

export interface Pose {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  /** width/height (m) of the region around the target that must stay in frame */
  fit: [number, number];
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Camera that glides between curated poses. Each pose frames a rectangle around its target,
 * so the composition holds on wide and tall screens. The pointer adds a gentle look-around.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private from: { pos: THREE.Vector3; target: THREE.Vector3; fov: number } | null = null;
  private to: Pose;
  private t = 1;
  private duration = 1.4;
  private readonly curPos = new THREE.Vector3();
  private readonly curTarget = new THREE.Vector3();
  private curFov = 50;
  private readonly look = new THREE.Vector2();
  private readonly lookGoal = new THREE.Vector2();
  private aspect = 16 / 9;
  lookStrength = 1;

  constructor(initial: Pose) {
    this.camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.03, 80);
    this.to = initial;
    this.curPos.copy(initial.pos);
    this.curTarget.copy(initial.target);
    this.curFov = this.fovFor(initial);
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
    if (this.t >= 1) this.curFov = this.fovFor(this.to);
    this.apply();
  }

  goTo(pose: Pose, duration = 1.4, instant = false): void {
    this.from = { pos: this.curPos.clone(), target: this.curTarget.clone(), fov: this.curFov };
    this.to = pose;
    this.duration = duration;
    this.t = instant ? 1 : 0;
    if (instant) {
      this.curPos.copy(pose.pos);
      this.curTarget.copy(pose.target);
      this.curFov = this.fovFor(pose);
      this.apply();
    }
  }

  get moving(): boolean {
    return this.t < 1;
  }

  /** Pointer in normalised device coordinates (-1..1). */
  setPointer(x: number, y: number): void {
    this.lookGoal.set(x, y);
  }

  update(dt: number): void {
    if (this.t < 1 && this.from) {
      this.t = Math.min(1, this.t + dt / this.duration);
      const k = ease(this.t);
      this.curPos.lerpVectors(this.from.pos, this.to.pos, k);
      // arc slightly upwards on long moves so the camera does not clip furniture
      const lift = Math.sin(Math.PI * k) * Math.min(0.25, this.from.pos.distanceTo(this.to.pos) * 0.06);
      this.curPos.y += lift;
      this.curTarget.lerpVectors(this.from.target, this.to.target, k);
      this.curFov = THREE.MathUtils.lerp(this.from.fov, this.fovFor(this.to), k);
    } else {
      this.curFov = THREE.MathUtils.damp(this.curFov, this.fovFor(this.to), 6, dt);
    }
    this.look.x = THREE.MathUtils.damp(this.look.x, this.lookGoal.x, 3.2, dt);
    this.look.y = THREE.MathUtils.damp(this.look.y, this.lookGoal.y, 3.2, dt);
    this.apply();
  }

  private apply(): void {
    const dist = this.curPos.distanceTo(this.curTarget);
    const s = this.lookStrength * Math.min(1, dist / 4);
    const fwd = new THREE.Vector3().subVectors(this.curTarget, this.curPos).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    // move the eye a little and the target a little more: reads as parallax, not as a pan
    const eye = this.curPos.clone().addScaledVector(right, this.look.x * 0.12 * s).addScaledVector(up, this.look.y * 0.06 * s);
    const tgt = this.curTarget.clone().addScaledVector(right, this.look.x * 0.42 * s).addScaledVector(up, this.look.y * 0.22 * s);
    this.camera.position.copy(eye);
    this.camera.lookAt(tgt);
    this.camera.fov = this.curFov;
    this.camera.updateProjectionMatrix();
  }
}
