import * as THREE from 'three';
import type { MotionUniforms } from './materials.ts';
import { Pendulum, Wander } from './physics.ts';

/**
 * The pendant lamp over the desk hangs on a cord from the ceiling and swings like a pendulum
 * (period ~1.8 s for its 0.8 m cord). A faint draught keeps it barely moving; switching the
 * lights or walking the camera past gives it a push. The shade and cord are part of the baked
 * mesh and swing in the vertex shader; the glowing diffuser and the live light follow here.
 */
export class Pendant {
  private readonly pendulum: Pendulum;
  private readonly draughtX = new Wander(0.21);
  private readonly draughtZ = new Wander(0.17);
  private readonly parts: { obj: THREE.Object3D; pos: THREE.Vector3; quat: THREE.Quaternion }[] = [];
  private readonly lightRest: THREE.Vector3;
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly tmp = new THREE.Vector3();
  calm = false;

  constructor(
    private readonly pivot: THREE.Vector3,
    private readonly motion: MotionUniforms,
    objects: (THREE.Object3D | undefined)[],
    private readonly light: THREE.Object3D,
  ) {
    for (const obj of objects) if (obj) this.parts.push({ obj, pos: obj.position.clone(), quat: obj.quaternion.clone() });
    this.lightRest = light.position.clone();
    const shade = this.parts[0]?.pos ?? light.position;
    this.pendulum = new Pendulum(Math.max(0.3, pivot.y - shade.y), 0.32);
  }

  /** A push, e.g. when the lights are switched. */
  nudge(strength = 1): void {
    if (this.calm) return;
    const a = Math.random() * Math.PI * 2;
    this.pendulum.nudge(Math.cos(a) * 0.12 * strength, Math.sin(a) * 0.12 * strength);
  }

  /** Physics step. `air` is the horizontal air velocity at the lamp (m/s), from the camera. */
  step(h: number, air: THREE.Vector3): void {
    const d = this.calm ? 0 : 1;
    // draught plus the air the camera pushes along (torque ~ drag on the shade / length)
    const tx = (this.draughtX.step(h) * 0.05 + air.z * 0.9) * d;
    const tz = (this.draughtZ.step(h) * 0.05 - air.x * 0.9) * d;
    this.pendulum.step(h, tx, tz);
  }

  /** Move the diffuser and the light, and feed the angles to the baked shader. */
  apply(): void {
    const a = this.pendulum.angle;
    this.motion.pendant.value.copy(a);
    // same rotation as the shader: about x first, then z, around the pivot
    this.e.set(a.x, 0, a.y, 'ZYX');
    this.q.setFromEuler(this.e);
    for (const p of this.parts) {
      this.tmp.subVectors(p.pos, this.pivot).applyQuaternion(this.q).add(this.pivot);
      p.obj.position.copy(this.tmp);
      p.obj.quaternion.copy(this.q).multiply(p.quat);
    }
    this.light.position.copy(this.tmp.subVectors(this.lightRest, this.pivot).applyQuaternion(this.q).add(this.pivot));
  }
}
