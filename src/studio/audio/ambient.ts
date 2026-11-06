// A small generative ambient piece, synthesised live with the Web Audio API.
// Slow chords on soft pads, occasional bell notes drawn from the chord, a hint of tape
// wobble and vinyl crackle. Nothing is downloaded; it starts only after a click.

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

// D major-ish, all open voicings: Dmaj9, Bm11, Gmaj7(#11), Asus2/E
const CHORDS: number[][] = [
  [50, 57, 61, 64, 66],
  [47, 54, 61, 62, 66],
  [43, 54, 57, 61, 62],
  [45, 52, 57, 59, 64],
];

export class Ambient {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private timer = 0;
  private step = 0;
  private crackle: AudioBufferSourceNode | null = null;
  private on = false;
  analyser: AnalyserNode | null = null;

  get playing(): boolean {
    return this.on;
  }

  private ensure(): AudioContext {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    master.connect(comp).connect(analyser).connect(ctx.destination);
    this.analyser = analyser;
    this.master = master;
    // a generated room: decaying stereo noise as the impulse response
    const len = Math.floor(ctx.sampleRate * 3.2);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    const reverb = ctx.createConvolver();
    reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    reverb.connect(wet).connect(master);
    this.reverb = reverb;
    return ctx;
  }

  async start(): Promise<void> {
    const ctx = this.ensure();
    if (ctx.state === 'suspended') await ctx.resume();
    if (this.on) return;
    this.on = true;
    const now = ctx.currentTime;
    this.master!.gain.cancelScheduledValues(now);
    this.master!.gain.setValueAtTime(this.master!.gain.value, now);
    this.master!.gain.linearRampToValueAtTime(0.7, now + 2.5);
    this.startCrackle();
    this.step = 0;
    this.playChord();
    this.timer = window.setInterval(() => this.playChord(), 7600);
  }

  stop(): void {
    if (!this.ctx || !this.on) return;
    this.on = false;
    window.clearInterval(this.timer);
    const now = this.ctx.currentTime;
    this.master!.gain.cancelScheduledValues(now);
    this.master!.gain.setValueAtTime(this.master!.gain.value, now);
    this.master!.gain.linearRampToValueAtTime(0, now + 1.6);
    const c = this.crackle;
    this.crackle = null;
    window.setTimeout(() => c?.stop(), 1800);
  }

  dispose(): void {
    this.stop();
    const ctx = this.ctx;
    this.ctx = null;
    window.setTimeout(() => ctx?.close(), 2000);
  }

  private voice(freq: number, t0: number, dur: number, gain: number, type: OscillatorType, pan: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = (Math.random() - 0.5) * 8;
    // slow tape wobble
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.18 + Math.random() * 0.1;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 3;
    lfo.connect(lfoGain).connect(osc.detune);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900 + Math.random() * 500;
    filter.Q.value = 0.4;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + dur * 0.35);
    env.gain.setValueAtTime(gain, t0 + dur * 0.6);
    env.gain.linearRampToValueAtTime(0, t0 + dur);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    osc.connect(filter).connect(env).connect(panner);
    panner.connect(this.master!);
    panner.connect(this.reverb!);
    osc.start(t0);
    lfo.start(t0);
    osc.stop(t0 + dur + 0.1);
    lfo.stop(t0 + dur + 0.1);
  }

  private bell(freq: number, t0: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const over = ctx.createOscillator();
    over.type = 'sine';
    over.frequency.value = freq * 3.01;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.07, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + 3.4);
    const og = ctx.createGain();
    og.gain.value = 0.18;
    const panner = ctx.createStereoPanner();
    panner.pan.value = (Math.random() - 0.5) * 0.8;
    osc.connect(g);
    over.connect(og).connect(g);
    g.connect(panner);
    panner.connect(this.master!);
    panner.connect(this.reverb!);
    osc.start(t0);
    over.start(t0);
    osc.stop(t0 + 3.6);
    over.stop(t0 + 3.6);
  }

  private playChord(): void {
    if (!this.ctx || !this.on) return;
    const t0 = this.ctx.currentTime + 0.05;
    const chord = CHORDS[this.step % CHORDS.length];
    chord.forEach((n, i) => this.voice(midi(n), t0, 9.5, i === 0 ? 0.075 : 0.045, i === 0 ? 'sine' : 'triangle', (i / (chord.length - 1)) * 1.2 - 0.6));
    // a sub an octave down on the root
    this.voice(midi(chord[0] - 12), t0, 9.5, 0.05, 'sine', 0);
    // two or three bell notes from the chord's upper tones
    const bells = 2 + Math.floor(Math.random() * 2);
    for (let b = 0; b < bells; b++) {
      const n = chord[1 + Math.floor(Math.random() * (chord.length - 1))] + 12;
      this.bell(midi(n), t0 + 0.8 + b * (1.4 + Math.random() * 1.6));
    }
    this.step++;
  }

  private startCrackle(): void {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const pop = Math.random() < 0.0009 ? (Math.random() * 2 - 1) * 0.9 : 0;
      d[i] = (Math.random() * 2 - 1) * 0.012 + pop;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.value = 0.22;
    src.connect(hp).connect(g).connect(this.master!);
    src.start();
    this.crackle = src;
  }
}
