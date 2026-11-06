import * as THREE from 'three';
import { Spring } from './physics.ts';

function vinylTexture(): THREE.CanvasTexture {
  const s = 512;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0d0d0f';
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
  g.fill();
  // grooves
  for (let r = s * 0.17; r < s * 0.49; r += 1.6) {
    g.strokeStyle = `rgba(255,255,255,${0.025 + 0.03 * Math.random()})`;
    g.lineWidth = 0.8;
    g.beginPath();
    g.arc(s / 2, s / 2, r, 0, Math.PI * 2);
    g.stroke();
  }
  // a faint sheen band so the rotation reads
  const grd = g.createConicGradient(0, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,255,255,0.0)');
  grd.addColorStop(0.12, 'rgba(255,255,255,0.07)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.0)');
  grd.addColorStop(0.62, 'rgba(255,255,255,0.0)');
  grd.addColorStop(0.75, 'rgba(255,255,255,0.06)');
  grd.addColorStop(0.88, 'rgba(255,255,255,0.0)');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(s / 2, s / 2, s * 0.49, 0, Math.PI * 2);
  g.fill();
  // label
  g.fillStyle = '#C8432B';
  g.beginPath();
  g.arc(s / 2, s / 2, s * 0.15, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#F5F2EC';
  g.textAlign = 'center';
  g.font = '600 22px -apple-system, BlinkMacSystemFont, "Inter Variable", sans-serif';
  g.fillText('STUDIO', s / 2, s / 2 - 20);
  g.font = '500 15px -apple-system, BlinkMacSystemFont, "Inter Variable", sans-serif';
  g.fillText('Budapest sessions', s / 2, s / 2 + 34);
  g.fillStyle = '#0d0d0f';
  g.beginPath();
  g.arc(s / 2, s / 2, 6, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * Belt-driven record player. The platter has inertia: the motor pulls it up to 33⅓ rpm through
 * the belt, and when stopped it coasts down against bearing friction. The tonearm swings on a
 * spring, lifts while it travels (cueing) and settles into the groove, then tracks inwards.
 */
export class Turntable {
  private playing = false;
  private omega = 0; // rad/s
  private progress = 0;
  private readonly arm: Spring;
  private readonly lift = new Spring(0, 2.2, 0.9);
  private wobble = 0;
  private readonly REST = THREE.MathUtils.degToRad(25);
  private readonly START = THREE.MathUtils.degToRad(11);
  private readonly END = THREE.MathUtils.degToRad(1);
  private static readonly RPM33 = (33.333 / 60) * Math.PI * 2;

  constructor(
    private readonly platter: THREE.Object3D | undefined,
    private readonly record: THREE.Object3D | undefined,
    private readonly tonearm: THREE.Object3D | undefined,
  ) {
    if (record) {
      const top = new THREE.Mesh(
        new THREE.CircleGeometry(0.1475, 128),
        new THREE.MeshStandardMaterial({ map: vinylTexture(), roughness: 0.35, metalness: 0.05 }),
      );
      top.rotation.x = -Math.PI / 2;
      top.position.y = 0.0014;
      top.raycast = () => {};
      record.add(top);
    }
    this.arm = new Spring(this.REST, 0.9, 0.85);
    if (tonearm) tonearm.rotation.y = this.REST;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  setPlaying(on: boolean): void {
    this.playing = on;
    if (on) this.progress = 0;
  }

  get busy(): boolean {
    return this.playing || this.omega > 0.001 || !this.arm.settled || !this.lift.settled;
  }

  /** Physics step (fixed rate). */
  step(h: number): void {
    // platter: belt torque towards 33⅓ when the motor runs, friction otherwise
    if (this.playing) this.omega += (Turntable.RPM33 - this.omega) * 1.6 * h;
    else this.omega = Math.max(0, this.omega - (0.55 + this.omega * 0.35) * h);
    this.wobble += h;
    const flutter = this.playing ? 1 + Math.sin(this.wobble * 2.1) * 0.002 : 1;
    const d = this.omega * flutter * h;
    if (this.platter) this.platter.rotation.y -= d;
    if (this.record) this.record.rotation.y -= d;
    // tonearm: swing to the lead-in once the platter is up to speed, then follow the groove
    const upToSpeed = this.omega > Turntable.RPM33 * 0.85;
    if (this.playing && upToSpeed) this.progress = Math.min(1, this.progress + h / 240);
    const goal = this.playing && upToSpeed ? THREE.MathUtils.lerp(this.START, this.END, this.progress) : this.REST;
    this.arm.target = goal;
    this.arm.step(h);
    // cue lever: up while the arm travels, down when it has (nearly) arrived
    this.lift.target = Math.abs(this.arm.value - goal) > THREE.MathUtils.degToRad(1.2) ? 1 : 0;
    this.lift.step(h);
  }

  update(): void {
    if (this.tonearm) {
      this.tonearm.rotation.y = this.arm.value;
      this.tonearm.rotation.x = -THREE.MathUtils.degToRad(2.2) * THREE.MathUtils.clamp(this.lift.value, 0, 1.2);
    }
  }
}
