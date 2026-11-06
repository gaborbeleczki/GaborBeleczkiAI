import * as THREE from 'three';

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

export class Turntable {
  private playing = false;
  private speed = 0;
  private arm = 0; // 0 = rest, 1 = on the record
  private progress = 0;
  private readonly REST = THREE.MathUtils.degToRad(25);
  private readonly START = THREE.MathUtils.degToRad(11);
  private readonly END = THREE.MathUtils.degToRad(1);

  constructor(
    private readonly platter: THREE.Object3D | undefined,
    private readonly record: THREE.Object3D | undefined,
    private readonly tonearm: THREE.Object3D | undefined,
  ) {
    if (record) {
      const top = new THREE.Mesh(
        new THREE.CircleGeometry(0.1475, 96),
        new THREE.MeshStandardMaterial({ map: vinylTexture(), roughness: 0.35, metalness: 0.05 }),
      );
      top.rotation.x = -Math.PI / 2;
      top.position.y = 0.0014;
      top.raycast = () => {};
      record.add(top);
    }
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
    return this.playing || this.speed > 0.001 || (this.arm > 0.001 && this.arm < 0.999);
  }

  update(dt: number): void {
    const target = this.playing ? 1 : 0;
    // platter spins up/down like a belt drive (33⅓ rpm = 3.49 rad/s)
    this.speed = THREE.MathUtils.damp(this.speed, target * 3.49, this.playing ? 1.4 : 0.9, dt);
    if (this.platter) this.platter.rotation.y -= this.speed * dt;
    if (this.record) this.record.rotation.y -= this.speed * dt;
    this.arm = THREE.MathUtils.damp(this.arm, target, 2.2, dt);
    if (this.playing) this.progress = Math.min(1, this.progress + dt / 240);
    const play = THREE.MathUtils.lerp(this.START, this.END, this.progress);
    if (this.tonearm) this.tonearm.rotation.y = THREE.MathUtils.lerp(this.REST, play, this.arm);
  }
}
