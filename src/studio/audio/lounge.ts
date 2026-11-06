// "Budapest sessions": a generative lounge deep house track, synthesised live with the Web
// Audio API. Nothing is downloaded and nothing is sampled: every sound is built here.
//
//   118 BPM, swung sixteenths. A soft four-on-the-floor kick that pumps the pads and bass
//   (sidechain), offbeat hats, a shaker, claps on two and four, a round syncopated sub bass,
//   Rhodes-style electric piano stabs (FM), warm detuned pads, sparse plucks into a ping-pong
//   delay, and the record's crackle. Jazzy rootless voicings over Dm9 - Gm9 - Cmaj9 - Am9.
//   The arrangement moves in sections (intro, groove, lift, breakdown) with small random
//   variations, so it does not loop note for note.
//
// Scheduling follows the lookahead pattern: a timer wakes every 25 ms and queues the notes of
// the next ~150 ms on the audio clock, so timing never depends on frame rate.

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

const BPM = 118;
const SWING = 0.13; // fraction of a sixteenth that off-sixteenths are pushed late

interface Chord {
  root: number; // bass note
  voicing: number[]; // rootless, mid register
  scale: number[]; // for plucks
}

const PROGRESSION: Chord[] = [
  { root: 38, voicing: [53, 57, 60, 64], scale: [62, 65, 67, 69, 72, 74] }, // Dm9
  { root: 43, voicing: [53, 57, 58, 62], scale: [62, 65, 67, 70, 72, 74] }, // Gm9
  { root: 36, voicing: [52, 55, 59, 62], scale: [60, 62, 64, 67, 69, 71] }, // Cmaj9
  { root: 45, voicing: [55, 59, 60, 64], scale: [60, 64, 67, 69, 71, 72] }, // Am9
];

type Section = 'intro' | 'groove' | 'lift' | 'break';
const FORM: [Section, number][] = [
  ['intro', 8],
  ['groove', 16],
  ['lift', 16],
  ['break', 8],
  ['groove', 16],
  ['lift', 16],
];

// bass lines over one bar: [sixteenth, semitones above the root, length in sixteenths]
const BASS: [number, number, number][][] = [
  [[0, 0, 2], [3, 0, 1], [6, 7, 2], [10, 0, 1], [11, 12, 1], [14, 10, 2]],
  [[0, 0, 3], [4, 0, 1], [7, 0, 2], [10, 7, 1], [12, 0, 2], [15, 12, 1]],
  [[0, 0, 2], [3, 12, 1], [6, 0, 1], [8, 0, 2], [11, 7, 2], [14, 0, 1]],
];

// electric piano stabs over one bar: [sixteenth, length in sixteenths, velocity]
const STABS: [number, number, number][][] = [
  [[3, 2, 0.7], [6, 2, 0.55], [10, 3, 0.65]],
  [[2, 2, 0.6], [7, 2, 0.7], [11, 1, 0.45], [14, 2, 0.6]],
  [[0, 6, 0.6], [10, 2, 0.55], [13, 2, 0.5]],
];

export class Lounge {
  private ctx: BaseAudioContext | null = null;
  private out: GainNode | null = null; // master volume (fades)
  private tone: BiquadFilterNode | null = null; // master low-pass (intro, breakdown)
  private drums: GainNode | null = null;
  private music: GainNode | null = null; // pads, bass, keys: ducked by the kick
  private duck: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private delay: DelayNode | null = null;
  private noise: AudioBuffer | null = null;
  private crackle: AudioBufferSourceNode | null = null;
  private timer = 0;
  private nextTime = 0;
  private sixteenth = 0; // since start
  private on = false;
  private bassVar = 0;
  private stabVar = 0;
  analyser: AnalyserNode | null = null;

  get playing(): boolean {
    return this.on;
  }

  private ensure(): AudioContext {
    if (this.ctx) return this.ctx as AudioContext;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    this.build(ctx);
    return ctx;
  }

  /** Render the opening `seconds` offline (QA: levels and clipping, no speakers involved). */
  static async render(seconds: number, sampleRate = 44100): Promise<AudioBuffer> {
    const l = new Lounge();
    const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
    l.build(ctx);
    l.on = true;
    l.out!.gain.value = 0.66;
    l.startCrackle();
    const s16 = 60 / BPM / 4;
    for (let n = 0, t = 0.05; t < seconds; n++, t += s16) l.play(n, t + (n % 2 === 1 ? SWING * s16 : 0));
    return ctx.startRendering();
  }

  private build(ctx: BaseAudioContext): void {
    this.ctx = ctx;

    // master: tone filter -> glue compressor -> limiter -> volume -> analyser -> speakers
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 900;
    tone.Q.value = 0.5;
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -20;
    glue.ratio.value = 2.5;
    glue.attack.value = 0.02;
    glue.release.value = 0.2;
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -4;
    limit.knee.value = 2;
    limit.ratio.value = 18;
    limit.attack.value = 0.002;
    limit.release.value = 0.12;
    const out = ctx.createGain();
    out.gain.value = 0;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    tone.connect(glue).connect(limit).connect(out).connect(analyser).connect(ctx.destination);
    this.tone = tone;
    this.out = out;
    this.analyser = analyser;

    const drums = ctx.createGain();
    drums.gain.value = 0.9;
    drums.connect(tone);
    this.drums = drums;
    const duck = ctx.createGain();
    duck.connect(tone);
    this.duck = duck;
    const music = ctx.createGain();
    music.gain.value = 0.85;
    music.connect(duck);
    this.music = music;

    // a generated room for the reverb
    const len = Math.floor(ctx.sampleRate * 2.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    const reverb = ctx.createConvolver();
    reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    reverb.connect(wet).connect(duck);
    this.reverb = reverb;

    // ping-pong delay, dotted eighth
    const beat = 60 / BPM;
    const dl = ctx.createDelay(2);
    const dr = ctx.createDelay(2);
    dl.delayTime.value = beat * 0.75;
    dr.delayTime.value = beat * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 3200;
    const pl = ctx.createStereoPanner();
    pl.pan.value = -0.6;
    const pr = ctx.createStereoPanner();
    pr.pan.value = 0.6;
    dl.connect(pl).connect(duck);
    dr.connect(pr).connect(duck);
    dl.connect(dr);
    dr.connect(damp).connect(fb).connect(dl);
    this.delay = dl;

    // one second of white noise, reused by every noisy instrument
    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noise = nb;
  }

  async start(): Promise<void> {
    const ctx = this.ensure();
    if (ctx.state === 'suspended') await ctx.resume();
    if (this.on) return;
    this.on = true;
    const now = ctx.currentTime;
    const g = this.out!.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0.66, now + 1.5);
    this.startCrackle();
    this.sixteenth = 0;
    this.nextTime = now + 0.08;
    this.bassVar = Math.floor(Math.random() * BASS.length);
    this.stabVar = Math.floor(Math.random() * STABS.length);
    this.timer = window.setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  stop(): void {
    if (!this.ctx || !this.on) return;
    this.on = false;
    window.clearInterval(this.timer);
    const now = this.ctx.currentTime;
    const g = this.out!.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + 1.4);
    const c = this.crackle;
    this.crackle = null;
    window.setTimeout(() => c?.stop(), 1600);
  }

  dispose(): void {
    this.stop();
    const ctx = this.ctx as AudioContext | null;
    this.ctx = null;
    window.setTimeout(() => ctx?.close?.(), 2000);
  }

  // ------------------------------------------------------------------ arrangement

  private sectionAt(bar: number): { name: Section; bar: number; len: number } {
    const total = FORM.reduce((s, [, n]) => s + n, 0);
    // after the first pass skip the intro: groove, lift, break, groove, lift...
    let b = bar < total ? bar : FORM[0][1] + ((bar - total) % (total - FORM[0][1]));
    for (const [name, len] of FORM) {
      if (b < len) return { name, bar: b, len };
      b -= len;
    }
    return { name: 'groove', bar: 0, len: 16 };
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.on) return;
    const s16 = 60 / BPM / 4;
    while (this.nextTime < ctx.currentTime + 0.15) {
      const swing = this.sixteenth % 2 === 1 ? SWING * s16 : 0;
      this.play(this.sixteenth, this.nextTime + swing);
      this.nextTime += s16;
      this.sixteenth++;
    }
  }

  private play(n: number, t: number): void {
    const step = n % 16;
    const bar = Math.floor(n / 16);
    const sec = this.sectionAt(bar);
    const chord = PROGRESSION[Math.floor(bar / 2) % PROGRESSION.length];
    const s16 = 60 / BPM / 4;
    const name = sec.name;
    const r = Math.random();

    // section-level moves, on the first sixteenth of a bar
    if (step === 0) {
      if (sec.bar === 0) this.sectionStart(name, t, sec.len * 16 * s16);
      if (bar % 4 === 0) {
        this.bassVar = Math.random() < 0.35 ? Math.floor(Math.random() * BASS.length) : this.bassVar;
        this.stabVar = Math.random() < 0.4 ? Math.floor(Math.random() * STABS.length) : this.stabVar;
      }
      // pads hold each chord for two bars
      if (bar % 2 === 0) this.pad(chord.voicing, t, 2 * 16 * s16, name === 'break' ? 0.32 : name === 'intro' ? 0.26 : 0.06);
    }
    const lastBarOfPhrase = sec.bar === sec.len - 1;

    // drums
    const groove = name === 'groove' || name === 'lift';
    if (groove && step % 4 === 0) this.kick(t, step === 0 ? 1 : 0.92);
    if (name === 'intro' && sec.bar >= sec.len - 2 && step % 4 === 0) this.kick(t, 0.5 + (sec.bar - sec.len + 2) * 0.2);
    if (groove && (step === 4 || step === 12)) this.clap(t, 0.8);
    if (groove && lastBarOfPhrase && step >= 12 && step % 2 === 0) this.clap(t, 0.35 + (step - 12) * 0.08);
    if (name !== 'break' || sec.bar >= sec.len - 4) {
      if (step % 4 === 2) this.hat(t, step === 14 && (bar % 2 === 1 || name === 'lift') ? 'open' : 'closed', name === 'intro' ? 0.6 : 0.7);
      else if (step % 2 === 1 && (name === 'lift' || r < 0.55)) this.hat(t, 'closed', 0.14 + Math.random() * 0.12);
    }
    if (name !== 'intro' && name !== 'break') this.shaker(t, [0.5, 0.18, 0.32, 0.2][step % 4] * (name === 'lift' ? 1 : 0.75));

    // bass
    if (name !== 'intro' && name !== 'break') {
      for (const [st, semis, len] of BASS[this.bassVar]) {
        if (st === step) this.bass(midi(chord.root + semis), t, len * s16 * 0.92, st === 0 ? 1 : 0.85);
      }
    }

    // electric piano stabs (sparser in the intro, longer and softer in the break)
    const stabs = name === 'break' ? STABS[2] : STABS[this.stabVar];
    for (const [st, len, vel] of stabs) {
      if (st !== step) continue;
      if (name === 'intro' && r < 0.35) continue;
      this.keys(chord.voicing, t, len * s16 * (name === 'break' ? 2.4 : 1), vel * (name === 'intro' ? 0.9 : name === 'break' ? 1.25 : 1));
    }

    // plucks: a few notes from the scale, into the delay
    if (name === 'lift' && step % 2 === 1 && Math.random() < 0.16) {
      const note = chord.scale[Math.floor(Math.random() * chord.scale.length)] + (Math.random() < 0.3 ? 12 : 0);
      this.pluck(midi(note), t, 0.5);
    }
    if (name === 'break' && step % 8 === 0) this.pluck(midi(chord.scale[(sec.bar * 2 + step / 8) % chord.scale.length] + 12), t, 0.45);
  }

  /** Master tone moves at the start of a section: the intro and the breakdown open the filter. */
  private sectionStart(name: Section, t: number, dur: number): void {
    const f = this.tone!.frequency;
    f.cancelScheduledValues(t);
    if (name === 'intro') {
      f.setValueAtTime(1500, t);
      f.exponentialRampToValueAtTime(14000, t + dur);
    } else if (name === 'break') {
      f.setValueAtTime(14000, t);
      f.exponentialRampToValueAtTime(2400, t + dur * 0.35);
      f.exponentialRampToValueAtTime(14000, t + dur);
    } else f.setValueAtTime(14000, t);
  }

  // ------------------------------------------------------------------ instruments

  private noiseSource(t: number, dur: number): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.start(t, Math.random() * 0.8, dur + 0.05);
    return src;
  }

  private kick(t: number, vel: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(128, t);
    osc.frequency.exponentialRampToValueAtTime(47, t + 0.075);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.95 * vel, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    osc.connect(g).connect(this.drums!);
    osc.start(t);
    osc.stop(t + 0.45);
    // a soft click on top
    const click = this.noiseSource(t, 0.012);
    const cf = ctx.createBiquadFilter();
    cf.type = 'bandpass';
    cf.frequency.value = 3500;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.08 * vel, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
    click.connect(cf).connect(cg).connect(this.drums!);
    // sidechain: the music dips and swells back with every kick
    const d = this.duck!.gain;
    d.cancelScheduledValues(t);
    d.setValueAtTime(0.42, t);
    d.linearRampToValueAtTime(1, t + 0.27);
  }

  private clap(t: number, vel: number): void {
    const ctx = this.ctx!;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1350;
    bp.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    // three quick hands, then the tail
    [0, 0.011, 0.023].forEach((o) => {
      g.gain.setValueAtTime(0.42 * vel, t + o);
      g.gain.exponentialRampToValueAtTime(0.05 * vel, t + o + 0.009);
    });
    g.gain.setValueAtTime(0.32 * vel, t + 0.031);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    const pan = ctx.createStereoPanner();
    pan.pan.value = 0.08;
    const src = this.noiseSource(t, 0.22);
    src.connect(bp).connect(g).connect(pan);
    pan.connect(this.drums!);
    const send = ctx.createGain();
    send.gain.value = 0.35;
    pan.connect(send).connect(this.reverb!);
  }

  private hat(t: number, kind: 'closed' | 'open', vel: number): void {
    const ctx = this.ctx!;
    const dur = kind === 'open' ? 0.24 : 0.04;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7200;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 10500;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22 * vel, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const pan = ctx.createStereoPanner();
    pan.pan.value = kind === 'open' ? 0.25 : -0.18;
    this.noiseSource(t, dur).connect(hp).connect(bp).connect(g).connect(pan).connect(this.drums!);
  }

  private shaker(t: number, vel: number): void {
    const ctx = this.ctx!;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 6200;
    bp.Q.value = 1.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.07 * vel, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    const pan = ctx.createStereoPanner();
    pan.pan.value = 0.35;
    this.noiseSource(t, 0.08).connect(bp).connect(g).connect(pan).connect(this.drums!);
  }

  private bass(freq: number, t: number, len: number, vel: number): void {
    const ctx = this.ctx!;
    const a = ctx.createOscillator();
    a.type = 'sine';
    a.frequency.value = freq;
    const b = ctx.createOscillator();
    b.type = 'triangle';
    b.frequency.value = freq;
    const bg = ctx.createGain();
    bg.gain.value = 0.35;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(520, t);
    lp.frequency.exponentialRampToValueAtTime(240, t + len);
    lp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.42 * vel, t + 0.006);
    g.gain.setValueAtTime(0.38 * vel, t + len * 0.8);
    g.gain.exponentialRampToValueAtTime(0.001, t + len + 0.05);
    a.connect(g);
    b.connect(bg).connect(g);
    g.connect(lp).connect(this.music!);
    a.start(t);
    b.start(t);
    a.stop(t + len + 0.1);
    b.stop(t + len + 0.1);
  }

  /** Electric piano: two-operator FM with a short bright tine, a slow tremolo pan. */
  private keys(notes: number[], t: number, len: number, vel: number): void {
    const ctx = this.ctx!;
    const pan = ctx.createStereoPanner();
    const trem = ctx.createOscillator();
    trem.frequency.value = 4.2;
    const tg = ctx.createGain();
    tg.gain.value = 0.35;
    trem.connect(tg).connect(pan.pan);
    const bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(pan);
    pan.connect(this.music!);
    const rs = ctx.createGain();
    rs.gain.value = 0.3;
    pan.connect(rs).connect(this.reverb!);
    const ds = ctx.createGain();
    ds.gain.value = 0.12;
    pan.connect(ds).connect(this.delay!);
    const end = t + len + 0.8;
    notes.forEach((n, i) => {
      const f = midi(n);
      const car = ctx.createOscillator();
      car.type = 'sine';
      car.frequency.value = f;
      car.detune.value = (Math.random() - 0.5) * 6;
      const mod = ctx.createOscillator();
      mod.type = 'sine';
      mod.frequency.value = f;
      const idx = ctx.createGain();
      idx.gain.setValueAtTime(f * 1.6, t);
      idx.gain.exponentialRampToValueAtTime(f * 0.25, t + 0.5);
      mod.connect(idx).connect(car.frequency);
      const g = ctx.createGain();
      const peak = (0.075 * vel) / (1 + i * 0.12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
      g.gain.exponentialRampToValueAtTime(peak * 0.35, t + Math.min(len, 0.9));
      g.gain.setValueAtTime(peak * 0.35, t + len);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.5);
      car.connect(g).connect(bus);
      for (const o of [car, mod]) {
        o.start(t);
        o.stop(end);
      }
      if (i === notes.length - 1) {
        // the bright tine of the top note
        const tine = ctx.createOscillator();
        tine.type = 'sine';
        tine.frequency.value = f * 14;
        const tineG = ctx.createGain();
        tineG.gain.setValueAtTime(0.014 * vel, t);
        tineG.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        tine.connect(tineG).connect(bus);
        tine.start(t);
        tine.stop(t + 0.15);
      }
    });
    trem.start(t);
    trem.stop(end);
  }

  private pad(notes: number[], t: number, dur: number, level: number): void {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(700, t);
    lp.frequency.linearRampToValueAtTime(1500, t + dur * 0.5);
    lp.frequency.linearRampToValueAtTime(800, t + dur);
    lp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(level, t + 0.9);
    g.gain.setValueAtTime(level, t + dur - 0.2);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.2);
    lp.connect(g);
    g.connect(this.music!);
    const rs = ctx.createGain();
    rs.gain.value = 0.5;
    g.connect(rs).connect(this.reverb!);
    const sides = [-0.45, 0.45].map((v) => {
      const p = ctx.createStereoPanner();
      p.pan.value = v;
      const pg = ctx.createGain();
      pg.gain.value = 0.22;
      pg.connect(p).connect(lp);
      return pg;
    });
    notes.forEach((n) => {
      [-8, 7].forEach((det, k) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midi(n);
        o.detune.value = det + (Math.random() - 0.5) * 4;
        o.connect(sides[k]);
        o.start(t);
        o.stop(t + dur + 1.3);
      });
    });
  }

  private pluck(freq: number, t: number, vel: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4200, t);
    lp.frequency.exponentialRampToValueAtTime(900, t + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(lp).connect(g);
    g.connect(this.music!);
    const ds = ctx.createGain();
    ds.gain.value = 0.55;
    g.connect(ds).connect(this.delay!);
    const rs = ctx.createGain();
    rs.gain.value = 0.25;
    g.connect(rs).connect(this.reverb!);
    o.start(t);
    o.stop(t + 0.5);
  }

  /** The record's surface: a quiet hiss with the odd pop, looped. */
  private startCrackle(): void {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const pop = Math.random() < 0.0008 ? (Math.random() * 2 - 1) * 0.9 : 0;
      d[i] = (Math.random() * 2 - 1) * 0.01 + pop;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1500;
    const g = ctx.createGain();
    g.gain.value = 0.14;
    src.connect(hp).connect(g).connect(this.out!);
    src.start();
    this.crackle = src;
  }
}
