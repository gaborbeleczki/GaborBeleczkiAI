import * as THREE from 'three';
import { Glide } from './physics.ts';

// Things you pick up: a dossier from the shelf, the notebook, the CV, a business card, the
// phone. Each flies from where it rests to a reading position in front of the camera (worked
// out every frame from the camera, so it stays put while the camera settles), and back again.

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const X = new THREE.Vector3(1, 0, 0);

export interface ReadFit {
  /** width and height (m) of what must fit on screen */
  w: number;
  h: number;
  /** the point (in the object's reading frame) to centre */
  center: THREE.Vector3;
  /** tilt of the top edge away from the eye (radians) */
  tilt: number;
  /** share of the screen to fill */
  fill?: number;
}

/**
 * Pose of an object held in front of the camera. `frame` maps the object's reading frame
 * (u right, v up, w towards the reader) into the object's own space.
 */
export function readPose(cam: THREE.PerspectiveCamera, frameQuat: THREE.Quaternion, framePos: THREE.Vector3, fit: ReadFit, outPos: THREE.Vector3, outQuat: THREE.Quaternion): number {
  const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
  const tanH = tanV * cam.aspect;
  const fill = fit.fill ?? 0.86;
  const h = fit.h * Math.cos(fit.tilt);
  // the reader's controls sit along the bottom: keep a strip free there
  const dist = Math.max(fit.w / (2 * tanH * fill), h / (2 * tanV * fill * 0.9));
  // world rotation of the reading frame: the camera's, tilted back a little
  _q.setFromAxisAngle(X, -fit.tilt);
  const qFrameWorld = cam.quaternion.clone().multiply(_q);
  // object rotation so that object * frame = frameWorld
  outQuat.copy(qFrameWorld).multiply(frameQuat.clone().invert());
  // the centre point sits on the view axis, a touch above the middle
  const target = _v.set(0, dist * tanV * 0.07, -dist).applyQuaternion(cam.quaternion).add(cam.position);
  _w.copy(fit.center).applyQuaternion(frameQuat).add(framePos).applyQuaternion(outQuat);
  outPos.copy(target).sub(_w);
  return dist;
}

/**
 * Wrap a mesh node in a plain carrier at the same pose. The web optimiser bakes a scale and
 * offset into quantised mesh nodes, so things attached to the mesh itself would be scaled too.
 */
export function carrier(node: THREE.Object3D): THREE.Object3D {
  const c = new THREE.Object3D();
  c.name = `${node.name}_carrier`;
  c.position.copy(node.position);
  c.quaternion.copy(node.quaternion);
  node.parent?.add(c);
  c.updateWorldMatrix(true, false);
  node.updateWorldMatrix(true, false);
  c.attach(node);
  return c;
}

export interface HeldOptions {
  /** how the object leaves its rest: slide along this world direction first */
  out: THREE.Vector3;
  outDist: number;
  /** flight time, roughly (s) */
  time?: number;
}

/** The flight between the rest pose and the reading pose. */
export class Flight {
  readonly travel: Glide;
  readonly restPos = new THREE.Vector3();
  readonly restQuat = new THREE.Quaternion();
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly c = new THREE.Vector3();

  constructor(
    readonly node: THREE.Object3D,
    private readonly opts: HeldOptions,
  ) {
    this.restPos.copy(node.position);
    this.restQuat.copy(node.quaternion);
    this.travel = new Glide(0, 1 / (opts.time ?? 0.9));
  }

  get value(): number {
    return THREE.MathUtils.clamp(this.travel.value, 0, 1);
  }

  get away(): boolean {
    return this.travel.goal > 0 || this.travel.value > 0.002;
  }

  /** Place the node between rest (0) and the given reading pose (1). */
  place(readPos: THREE.Vector3, readQuat: THREE.Quaternion, extraQuat?: THREE.Quaternion): void {
    const t = this.value;
    const n = this.node;
    if (t <= 1e-4) {
      n.position.copy(this.restPos);
      n.quaternion.copy(this.restQuat);
      return;
    }
    const lift = 0.2;
    const k1 = Math.min(1, t / lift);
    const out = this.a.copy(this.restPos).addScaledVector(this.opts.out, this.opts.outDist * ease(k1));
    if (t <= lift) {
      n.position.copy(out);
      n.quaternion.copy(this.restQuat);
      return;
    }
    const k = ease((t - lift) / (1 - lift));
    // a soft arc: up and towards the eye
    const ctrl = this.b.copy(out).lerp(readPos, 0.5);
    ctrl.y += Math.min(0.35, out.distanceTo(readPos) * 0.25);
    const p0 = this.c.copy(out).lerp(ctrl, k);
    const p1 = ctrl.clone().lerp(readPos, k);
    n.position.copy(p0.lerp(p1, k));
    n.quaternion.copy(this.restQuat).slerp(readQuat, k);
    if (extraQuat) n.quaternion.multiply(extraQuat);
  }
}
